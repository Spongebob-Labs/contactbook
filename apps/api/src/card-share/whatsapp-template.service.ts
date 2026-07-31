import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { WhatsappTemplate, WhatsappTemplateUseCase } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TwilioContentApiService } from "./twilio-content-api.service";
import type { CreateWhatsappTemplateDto } from "./dto/create-whatsapp-template.dto";
import type { UpdateWhatsappTemplateDto } from "./dto/update-whatsapp-template.dto";
import type { WhatsappTemplateResponseDto } from "./dto/whatsapp-template-response.dto";

@Injectable()
export class WhatsappTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly twilioContent: TwilioContentApiService,
  ) {}

  /**
   * Resolves the template to use for a send. An explicit `key` must match an active
   * template for the given use case (400 otherwise). Omitted `key` picks the active
   * template flagged `isDefault`, tie-broken by oldest `createdAt` if more than one
   * default somehow exists.
   */
  async resolveActive(
    useCase: WhatsappTemplateUseCase,
    key?: string,
  ): Promise<WhatsappTemplate> {
    if (key) {
      const template = await this.prisma.whatsappTemplate.findFirst({
        where: { key, useCase, isActive: true },
      });
      if (!template) {
        throw new BadRequestException(
          `No active ${useCase} template found for key "${key}"`,
        );
      }
      return template;
    }

    const template = await this.prisma.whatsappTemplate.findFirst({
      where: { useCase, isActive: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    if (!template) {
      throw new BadRequestException(
        `No active ${useCase} template is configured`,
      );
    }
    return template;
  }

  async listAll(
    useCase?: WhatsappTemplateUseCase,
  ): Promise<WhatsappTemplateResponseDto[]> {
    const rows = await this.prisma.whatsappTemplate.findMany({
      where: useCase ? { useCase } : undefined,
      orderBy: [{ isActive: "desc" }, { isDefault: "desc" }, { createdAt: "asc" }],
    });
    return rows.map((r) => this.toDto(r));
  }

  async getOne(key: string): Promise<WhatsappTemplateResponseDto> {
    const row = await this.prisma.whatsappTemplate.findUnique({
      where: { key },
    });
    if (!row) throw new NotFoundException(`Template "${key}" not found`);

    const approval = await this.twilioContent.fetchApprovalStatus(row.contentSid);
    return {
      ...this.toDto(row),
      approvalStatus: approval.approvalStatus,
      rejectionReason: approval.rejectionReason,
    };
  }

  /**
   * Creates a new Content Template on Twilio, submits it for WhatsApp approval, and
   * registers it in the DB with isActive: false. Activate it via PATCH once approved.
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

    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.whatsappTemplate.updateMany({
          where: { useCase, locale, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.whatsappTemplate.create({
        data: {
          key: dto.key,
          useCase,
          contentSid,
          locale,
          bodyPreview: dto.body,
          // isActive: false — template needs WhatsApp approval before it can be used.
          // Activate via PATCH once Twilio shows approvalStatus: "approved".
          isActive: false,
          isDefault: dto.isDefault ?? false,
        },
      });
    });

    return {
      ...this.toDto(row),
      approvalStatus,
    };
  }

  /**
   * Updates a template. If body or buttonTitle changes, a new Twilio Content Template is
   * created and submitted for re-approval (contentSid is swapped, isActive reset to false).
   * Metadata-only changes (isDefault, isActive) are a DB-only update.
   */
  async update(
    key: string,
    dto: UpdateWhatsappTemplateDto,
  ): Promise<WhatsappTemplateResponseDto> {
    const row = await this.prisma.whatsappTemplate.findUnique({ where: { key } });
    if (!row) throw new NotFoundException(`Template "${key}" not found`);

    const contentChanged = dto.body !== undefined || dto.buttonTitle !== undefined;
    let newContentSid = row.contentSid;
    let approvalStatus: string | undefined;

    if (contentChanged) {
      const newBody = dto.body ?? row.bodyPreview;
      const newButtonTitle = dto.buttonTitle ?? "Save Contact";

      newContentSid = await this.twilioContent.create({
        name: `${key}_${Date.now()}`,
        body: newBody,
        buttonTitle: newButtonTitle,
        category: "UTILITY",
      });

      approvalStatus = await this.twilioContent.submitForApproval(
        newContentSid,
        `${key}_updated`,
        "UTILITY",
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.whatsappTemplate.updateMany({
          where: {
            useCase: row.useCase,
            locale: row.locale,
            isDefault: true,
            key: { not: key },
          },
          data: { isDefault: false },
        });
      }
      return tx.whatsappTemplate.update({
        where: { key },
        data: {
          ...(dto.body !== undefined ? { bodyPreview: dto.body } : {}),
          ...(contentChanged ? { contentSid: newContentSid, isActive: false } : {}),
          ...(dto.isActive !== undefined && !contentChanged ? { isActive: dto.isActive } : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        },
      });
    });

    return {
      ...this.toDto(updated),
      ...(approvalStatus ? { approvalStatus } : {}),
    };
  }

  /**
   * Deletes the Content Template from Twilio and deactivates it in the DB.
   * Blocks if it is the only active template for its use case (would break all sends).
   */
  async delete(key: string): Promise<{ ok: true }> {
    const row = await this.prisma.whatsappTemplate.findUnique({ where: { key } });
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
      data: { isActive: false, isDefault: false },
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
      contentSid: row.contentSid,
      isDefault: row.isDefault,
      isActive: row.isActive,
      createdAt: row.createdAt,
    };
  }
}
