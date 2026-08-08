import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  WhatsappTemplateApprovalStatus,
  WhatsappTemplateSyncStatus,
  WhatsappTemplateUseCase,
  type WhatsappTemplate,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { GcsTemplateImageService } from "../storage/gcs-template-image.service";
import { TwilioContentApiService } from "./twilio-content-api.service";
import {
  WhatsappTemplateSyncService,
  approvalStatusToEnum,
} from "./whatsapp-template-sync.service";
import {
  SHARE_TEMPLATE_BUTTON_TITLE,
  findShareTemplateVariant,
} from "./share-template-variants";
import type { CreateWhatsappTemplateDto } from "./dto/create-whatsapp-template.dto";
import type { UpdateWhatsappTemplateDto } from "./dto/update-whatsapp-template.dto";
import type { WhatsappTemplateResponseDto } from "./dto/whatsapp-template-response.dto";

const SENDABLE_SYNC_STATUSES: WhatsappTemplateSyncStatus[] = [
  WhatsappTemplateSyncStatus.IN_SYNC,
  WhatsappTemplateSyncStatus.DRIFT_REPAIRED,
];

/** How many templates one user may create (global templates don't count). */
export const MAX_USER_TEMPLATES = 3;

const TEMPLATE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

@Injectable()
export class WhatsappTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly twilioContent: TwilioContentApiService,
    private readonly sync: WhatsappTemplateSyncService,
    private readonly templateImages: GcsTemplateImageService,
  ) {}

  /**
   * Resolves the template for a send. The key is REQUIRED — there is no default
   * fallback: the template the user picked is exactly what gets sent. Blocks unless
   * the template is active, WhatsApp-approved, and verified in sync with Twilio.
   */
  async resolveForSend(
    useCase: WhatsappTemplateUseCase,
    key: string,
    userId?: string,
  ): Promise<WhatsappTemplate> {
    const row = await this.prisma.whatsappTemplate.findFirst({
      where: { key, useCase },
    });
    // User-created templates are private to their creator; report them as not found
    // to other users rather than leaking their existence.
    if (
      !row ||
      (row.createdByUserId !== null && row.createdByUserId !== userId)
    ) {
      throw new BadRequestException(
        `No ${useCase} template found for key "${key}"`,
      );
    }
    if (!row.isActive) {
      throw new ConflictException(`Template "${key}" is deactivated`);
    }

    const template = await this.sync.ensureFresh(row);

    if (template.approvalStatus !== WhatsappTemplateApprovalStatus.APPROVED) {
      throw new ConflictException(
        `Template "${key}" is not WhatsApp-approved (status: ${template.approvalStatus})`,
      );
    }
    if (!SENDABLE_SYNC_STATUSES.includes(template.syncStatus)) {
      throw new ConflictException(
        `Template "${key}" is out of sync with Twilio (status: ${template.syncStatus})`,
      );
    }
    if (!template.isActive) {
      // ensureFresh can deactivate (deleted on Twilio, broken button base URL).
      throw new ConflictException(`Template "${key}" is no longer available`);
    }
    return template;
  }

  /**
   * Templates eligible for the user-facing picker: active, approved, and verified in
   * sync with Twilio. Stale rows are re-synced first so the picker never shows a
   * preview older than the freshness TTL.
   */
  async listForPicker(
    useCase: WhatsappTemplateUseCase = WhatsappTemplateUseCase.CARD_SHARE,
    userId?: string,
  ): Promise<WhatsappTemplate[]> {
    const rows = await this.prisma.whatsappTemplate.findMany({
      where: {
        useCase,
        isActive: true,
        // Global templates for everyone + the caller's own creations.
        OR: [
          { createdByUserId: null },
          ...(userId ? [{ createdByUserId: userId }] : []),
        ],
      },
      orderBy: { createdAt: "asc" },
    });
    const synced = [];
    for (const row of rows) {
      synced.push(await this.sync.ensureFresh(row));
    }
    return synced.filter(
      (t) =>
        t.isActive &&
        t.approvalStatus === WhatsappTemplateApprovalStatus.APPROVED &&
        SENDABLE_SYNC_STATUSES.includes(t.syncStatus),
    );
  }

  async listAll(
    useCase?: WhatsappTemplateUseCase,
  ): Promise<WhatsappTemplateResponseDto[]> {
    const rows = await this.prisma.whatsappTemplate.findMany({
      where: useCase ? { useCase } : undefined,
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    });
    return rows.map((r) => this.toDto(r));
  }

  /** Fetches one template, reconciling it against Twilio first (a GET also repairs). */
  async getOne(key: string): Promise<WhatsappTemplateResponseDto> {
    const row = await this.prisma.whatsappTemplate.findUnique({
      where: { key },
    });
    if (!row) throw new NotFoundException(`Template "${key}" not found`);

    const synced = await this.sync.syncOne(row);
    return this.toDto(synced);
  }

  /** Force an immediate Twilio reconciliation for one template. */
  async syncNow(key: string): Promise<WhatsappTemplateResponseDto> {
    return this.getOne(key);
  }

  /**
   * User-created share template: a fixed body variant + optional header image, with the
   * "Get Contact" QUICK_REPLY button (tap → VCF document follow-up). Capped per user;
   * visible/sendable only by the creator until an admin promotes it (createdByUserId
   * null). Joins the creator's picker automatically once Meta approves.
   */
  async createUserTemplate(
    userId: string,
    variantId: string,
    image?: { buffer: Buffer; mimeType: string; sizeBytes: number },
  ): Promise<WhatsappTemplate> {
    const variant = findShareTemplateVariant(variantId);
    if (!variant) {
      throw new BadRequestException(`Unknown template variant "${variantId}"`);
    }

    const owned = await this.prisma.whatsappTemplate.count({
      where: { createdByUserId: userId },
    });
    if (owned >= MAX_USER_TEMPLATES) {
      throw new ConflictException(
        `You can create at most ${MAX_USER_TEMPLATES} templates`,
      );
    }

    if (image) {
      if (image.sizeBytes > TEMPLATE_IMAGE_MAX_BYTES) {
        throw new BadRequestException("Header image must be 5 MB or smaller");
      }
      if (!this.templateImages.extensionForMime(image.mimeType)) {
        throw new BadRequestException(
          "Header image must be image/jpeg, image/png, or image/webp",
        );
      }
    }

    // Key doubles as the Twilio friendly_name (lowercase alnum + underscores).
    const key = `user_${userId.replace(/-/g, "").slice(0, 8)}_${variantId}_${Date.now().toString(36)}`;

    const headerImageUrl = image
      ? await this.templateImages.upload(key, image.buffer, image.mimeType)
      : undefined;

    const contentSid = await this.twilioContent.create({
      name: key,
      body: variant.body,
      buttonTitle: SHARE_TEMPLATE_BUTTON_TITLE,
      buttonType: "QUICK_REPLY",
      category: "UTILITY",
      headerImageUrl,
    });

    const approvalStatus = await this.twilioContent.submitForApproval(
      contentSid,
      key,
      "UTILITY",
    );

    return this.prisma.whatsappTemplate.create({
      data: {
        key,
        useCase: WhatsappTemplateUseCase.CARD_SHARE,
        contentSid,
        locale: "en",
        bodyPreview: variant.body,
        buttonTitle: SHARE_TEMPLATE_BUTTON_TITLE,
        headerImageUrl: headerImageUrl ?? null,
        isActive: true,
        approvalStatus: approvalStatusToEnum(approvalStatus),
        // Just pushed to Twilio, so in sync by construction.
        syncStatus: WhatsappTemplateSyncStatus.IN_SYNC,
        syncedAt: new Date(),
        createdByUserId: userId,
      },
    });
  }

  /**
   * Creates a new Content Template on Twilio, submits it for WhatsApp approval, and
   * registers it in the DB. The row is active immediately — the approval gate (not
   * isActive) keeps it out of the picker and blocks sends until Meta approves it.
   */
  async create(
    dto: CreateWhatsappTemplateDto,
  ): Promise<WhatsappTemplateResponseDto> {
    const useCase = dto.useCase ?? "CARD_SHARE";
    const locale = dto.locale ?? "en";
    const buttonTitle = dto.buttonTitle ?? "Save Contact";
    const category = dto.category ?? "UTILITY";

    const existing = await this.prisma.whatsappTemplate.findUnique({
      where: { key: dto.key },
    });
    if (existing) {
      throw new BadRequestException(
        `Template with key "${dto.key}" already exists. Use PATCH to update it.`,
      );
    }

    const contentSid = await this.twilioContent.create({
      name: dto.key,
      body: dto.body,
      buttonTitle,
      category,
      headerImageUrl: dto.headerImageUrl,
    });

    const approvalStatus = await this.twilioContent.submitForApproval(
      contentSid,
      dto.key,
      category,
    );

    const row = await this.prisma.whatsappTemplate.create({
      data: {
        key: dto.key,
        useCase,
        contentSid,
        locale,
        bodyPreview: dto.body,
        buttonTitle,
        headerImageUrl: dto.headerImageUrl ?? null,
        isActive: true,
        approvalStatus: approvalStatusToEnum(approvalStatus),
        // We just pushed this exact content to Twilio, so it's in sync by construction.
        syncStatus: WhatsappTemplateSyncStatus.IN_SYNC,
        syncedAt: new Date(),
      },
    });

    return this.toDto(row);
  }

  /**
   * Updates a template. If body/buttonTitle/headerImageUrl changes, a new Twilio
   * Content Template is created and submitted for re-approval (contentSid is swapped;
   * the approval gate blocks sends until Meta approves the new content).
   * isActive changes are a DB-only update.
   */
  async update(
    key: string,
    dto: UpdateWhatsappTemplateDto,
  ): Promise<WhatsappTemplateResponseDto> {
    const row = await this.prisma.whatsappTemplate.findUnique({
      where: { key },
    });
    if (!row) throw new NotFoundException(`Template "${key}" not found`);

    const contentChanged =
      dto.body !== undefined ||
      dto.buttonTitle !== undefined ||
      dto.headerImageUrl !== undefined;

    let contentData = {};
    if (contentChanged) {
      const newBody = dto.body ?? row.bodyPreview;
      const newButtonTitle = dto.buttonTitle ?? row.buttonTitle;
      const newHeaderImageUrl = dto.headerImageUrl ?? row.headerImageUrl;

      const newContentSid = await this.twilioContent.create({
        name: `${key}_${Date.now()}`,
        body: newBody,
        buttonTitle: newButtonTitle,
        category: "UTILITY",
        headerImageUrl: newHeaderImageUrl ?? undefined,
      });

      const approvalStatus = await this.twilioContent.submitForApproval(
        newContentSid,
        `${key}_updated`,
        "UTILITY",
      );

      contentData = {
        contentSid: newContentSid,
        bodyPreview: newBody,
        buttonTitle: newButtonTitle,
        headerImageUrl: newHeaderImageUrl,
        approvalStatus: approvalStatusToEnum(approvalStatus),
        rejectionReason: null,
        syncStatus: WhatsappTemplateSyncStatus.IN_SYNC,
        syncedAt: new Date(),
      };
    }

    const updated = await this.prisma.whatsappTemplate.update({
      where: { key },
      data: {
        ...contentData,
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    return this.toDto(updated);
  }

  /**
   * Deletes the Content Template from Twilio and deactivates it in the DB.
   * Blocks if it is the only active template for its use case (would break all sends).
   */
  async delete(key: string): Promise<{ ok: true }> {
    const row = await this.prisma.whatsappTemplate.findUnique({
      where: { key },
    });
    if (!row) throw new NotFoundException(`Template "${key}" not found`);

    if (row.isActive) {
      const activeCount = await this.prisma.whatsappTemplate.count({
        where: { useCase: row.useCase, isActive: true },
      });
      if (activeCount <= 1) {
        throw new BadRequestException(
          `Cannot delete the only active ${row.useCase} template — activate another template first.`,
        );
      }
    }

    await this.twilioContent.delete(row.contentSid);

    await this.prisma.whatsappTemplate.update({
      where: { key },
      data: {
        isActive: false,
        syncStatus: WhatsappTemplateSyncStatus.MISSING_ON_TWILIO,
        syncedAt: new Date(),
      },
    });

    return { ok: true };
  }

  private toDto(row: WhatsappTemplate): WhatsappTemplateResponseDto {
    return {
      id: row.id,
      key: row.key,
      useCase: row.useCase,
      locale: row.locale,
      bodyPreview: row.bodyPreview,
      buttonTitle: row.buttonTitle,
      headerImageUrl: row.headerImageUrl,
      contentSid: row.contentSid,
      isActive: row.isActive,
      approvalStatus: row.approvalStatus,
      rejectionReason: row.rejectionReason,
      syncStatus: row.syncStatus,
      syncedAt: row.syncedAt,
      createdAt: row.createdAt,
    };
  }
}
