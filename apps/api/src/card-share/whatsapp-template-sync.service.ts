import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  WhatsappTemplateApprovalStatus,
  WhatsappTemplateSyncStatus,
  type WhatsappTemplate,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  TwilioContentApiService,
  type TwilioApprovalStatus,
} from "./twilio-content-api.service";

/** How old a successful sync can be before ensureFresh() re-syncs inline. */
const FRESHNESS_TTL_MS = 15 * 60_000;
/**
 * How long a previously in-sync template stays sendable while Twilio is unreachable.
 * Transient outages must not block sends; only persistent failure or deletion should.
 */
const OUTAGE_GRACE_MS = 24 * 60 * 60_000;

const SENDABLE_SYNC_STATUSES: WhatsappTemplateSyncStatus[] = [
  WhatsappTemplateSyncStatus.IN_SYNC,
  WhatsappTemplateSyncStatus.DRIFT_REPAIRED,
];

export function approvalStatusToEnum(
  raw: TwilioApprovalStatus,
): WhatsappTemplateApprovalStatus {
  switch (raw) {
    case "approved":
      return WhatsappTemplateApprovalStatus.APPROVED;
    case "pending":
      return WhatsappTemplateApprovalStatus.PENDING;
    case "received":
      return WhatsappTemplateApprovalStatus.RECEIVED;
    case "rejected":
      return WhatsappTemplateApprovalStatus.REJECTED;
    default:
      return WhatsappTemplateApprovalStatus.UNKNOWN;
  }
}

/**
 * Keeps the WhatsappTemplate registry a faithful mirror of Twilio. Twilio is the source
 * of truth for template content — it is literally what gets sent — so on drift the DB
 * copy is repaired FROM Twilio, never the other way around. Templates deleted on Twilio
 * are flagged MISSING_ON_TWILIO and deactivated.
 */
@Injectable()
export class WhatsappTemplateSyncService {
  private readonly logger = new Logger(WhatsappTemplateSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly twilioContent: TwilioContentApiService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async syncAll(): Promise<void> {
    // All use cases, not just CARD_SHARE — OTP templates are registered here too so
    // the login flow's ContentSid stays consistent with what actually exists on Twilio.
    const rows = await this.prisma.whatsappTemplate.findMany();
    for (const row of rows) {
      await this.syncOne(row);
    }
  }

  /** Re-syncs the row inline if its last successful sync is older than the TTL. */
  async ensureFresh(
    template: WhatsappTemplate,
    ttlMs: number = FRESHNESS_TTL_MS,
  ): Promise<WhatsappTemplate> {
    const fresh =
      template.syncedAt !== null &&
      Date.now() - template.syncedAt.getTime() < ttlMs;
    return fresh ? template : this.syncOne(template);
  }

  /**
   * Reconciles one template against Twilio and persists the outcome. Never throws:
   * transient Twilio failures degrade to SYNC_ERROR (after a grace window) rather
   * than crashing cron runs or request handlers.
   */
  async syncOne(template: WhatsappTemplate): Promise<WhatsappTemplate> {
    try {
      const [content, approval] = await Promise.all([
        this.twilioContent.fetchContent(template.contentSid),
        this.twilioContent.fetchApprovalStatus(template.contentSid),
      ]);

      if (!content.exists) {
        this.logger.warn(
          `Template ${template.key} (${template.contentSid}) no longer exists on Twilio — deactivating`,
        );
        return this.prisma.whatsappTemplate.update({
          where: { id: template.id },
          data: {
            syncStatus: WhatsappTemplateSyncStatus.MISSING_ON_TWILIO,
            isActive: false,
            syncedAt: new Date(),
          },
        });
      }

      // The vCard button URL base is baked into the template at creation. If it no
      // longer matches our configured bucket, every send would produce broken links —
      // unrepairable from our side, so flag + deactivate.
      const baseUrl = this.twilioContent.vcardBaseUrl;
      if (
        baseUrl &&
        content.buttonUrl &&
        !content.buttonUrl.startsWith(`${baseUrl}/`)
      ) {
        this.logger.error(
          `Template ${template.key} button URL "${content.buttonUrl}" does not match configured vCard base "${baseUrl}" — deactivating`,
        );
        return this.prisma.whatsappTemplate.update({
          where: { id: template.id },
          data: {
            syncStatus: WhatsappTemplateSyncStatus.SYNC_ERROR,
            isActive: false,
            syncedAt: new Date(),
          },
        });
      }

      const twilioBody = content.body ?? template.bodyPreview;
      const twilioButtonTitle = content.buttonTitle ?? template.buttonTitle;
      const twilioHeaderImageUrl = content.headerImageUrl ?? null;
      const drifted =
        twilioBody !== template.bodyPreview ||
        twilioButtonTitle !== template.buttonTitle ||
        twilioHeaderImageUrl !== template.headerImageUrl;

      if (drifted) {
        this.logger.warn(
          `Template ${template.key} drifted from Twilio — repairing DB copy from Twilio`,
        );
      }

      return this.prisma.whatsappTemplate.update({
        where: { id: template.id },
        data: {
          bodyPreview: twilioBody,
          buttonTitle: twilioButtonTitle,
          headerImageUrl: twilioHeaderImageUrl,
          approvalStatus: approvalStatusToEnum(approval.approvalStatus),
          rejectionReason: approval.rejectionReason ?? null,
          syncStatus: drifted
            ? WhatsappTemplateSyncStatus.DRIFT_REPAIRED
            : WhatsappTemplateSyncStatus.IN_SYNC,
          syncedAt: new Date(),
        },
      });
    } catch (error) {
      return this.recordSyncFailure(template, error);
    }
  }

  private async recordSyncFailure(
    template: WhatsappTemplate,
    error: unknown,
  ): Promise<WhatsappTemplate> {
    const message = error instanceof Error ? error.message : String(error);
    const withinGrace =
      SENDABLE_SYNC_STATUSES.includes(template.syncStatus) &&
      template.syncedAt !== null &&
      Date.now() - template.syncedAt.getTime() < OUTAGE_GRACE_MS;

    if (withinGrace) {
      // Keep the last known-good state (and syncedAt) so sends aren't blocked by a
      // transient Twilio outage; the next cron run will retry.
      this.logger.warn(
        `Sync failed for template ${template.key} (keeping last known-good state): ${message}`,
      );
      return template;
    }

    this.logger.error(
      `Sync failed for template ${template.key} beyond grace window — marking SYNC_ERROR: ${message}`,
    );
    return this.prisma.whatsappTemplate.update({
      where: { id: template.id },
      data: { syncStatus: WhatsappTemplateSyncStatus.SYNC_ERROR },
    });
  }
}
