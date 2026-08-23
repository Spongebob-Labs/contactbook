import { Injectable } from '@nestjs/common';
import { MessagePurpose, WhatsAppTemplate } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApiError } from '../common/errors/api-error';
import { CreateWhatsAppTemplateDto } from './dto/create-whatsapp-template.dto';
import { UpdateWhatsAppTemplateDto } from './dto/update-whatsapp-template.dto';
import { WhatsAppTemplateResponseDto } from './dto/whatsapp-template-response.dto';

/**
 * The DB-backed registry described in docs/architecture/lld.md §1 — templates
 * rotate without a deploy. There is no Twilio-side verification here: this
 * only records what a human confirmed in Twilio Console. The lookup used by
 * an actual send path (once one exists) is `findActive`, below.
 */
@Injectable()
export class WhatsAppTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async list(purpose?: MessagePurpose): Promise<WhatsAppTemplateResponseDto[]> {
    const rows = await this.prisma.whatsAppTemplate.findMany({
      where: purpose ? { purpose } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toResponseDto(r));
  }

  async create(
    dto: CreateWhatsAppTemplateDto,
  ): Promise<WhatsAppTemplateResponseDto> {
    const existing = await this.prisma.whatsAppTemplate.findFirst({
      where: { OR: [{ key: dto.key }, { contentSid: dto.contentSid }] },
    });
    if (existing) {
      throw ApiError.conflict(
        'TEMPLATE_ALREADY_REGISTERED',
        existing.key === dto.key
          ? `A template with key "${dto.key}" is already registered.`
          : 'That contentSid is already registered under a different key.',
      );
    }

    const row = await this.prisma.whatsAppTemplate.create({
      data: {
        key: dto.key,
        purpose: dto.purpose,
        contentSid: dto.contentSid,
        locale: dto.locale ?? 'en',
        bodyPreview: dto.bodyPreview,
        buttonLabel: dto.buttonLabel,
        variableSchema: dto.variableSchema,
        approvalStatus: dto.approvalStatus,
      },
    });
    return this.toResponseDto(row);
  }

  async update(
    id: string,
    dto: UpdateWhatsAppTemplateDto,
  ): Promise<WhatsAppTemplateResponseDto> {
    const existing = await this.prisma.whatsAppTemplate.findUnique({
      where: { id },
    });
    if (!existing) {
      throw ApiError.notFound(
        'TEMPLATE_NOT_FOUND',
        'No WhatsApp template with that id.',
      );
    }

    const row = await this.prisma.whatsAppTemplate.update({
      where: { id },
      data: {
        ...(dto.approvalStatus !== undefined && {
          approvalStatus: dto.approvalStatus,
          syncedAt: new Date(),
        }),
        ...(dto.rejectionReason !== undefined && {
          rejectionReason: dto.rejectionReason,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    return this.toResponseDto(row);
  }

  /** The lookup a real send path uses: the one active, approved template for a purpose. */
  async findActive(purpose: MessagePurpose): Promise<WhatsAppTemplate | null> {
    return this.prisma.whatsAppTemplate.findFirst({
      where: { purpose, isActive: true, approvalStatus: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
    });
  }

  private toResponseDto(row: WhatsAppTemplate): WhatsAppTemplateResponseDto {
    return {
      id: row.id,
      key: row.key,
      purpose: row.purpose,
      contentSid: row.contentSid,
      locale: row.locale,
      bodyPreview: row.bodyPreview,
      buttonLabel: row.buttonLabel,
      variableSchema: row.variableSchema as Record<string, string>,
      approvalStatus: row.approvalStatus,
      rejectionReason: row.rejectionReason,
      isActive: row.isActive,
      createdAt: row.createdAt,
    };
  }
}
