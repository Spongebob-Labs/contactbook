import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { WebhookDlqStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/** Retain resolved/failed DLQ records for 30 days for auditing, then purge. */
const DLQ_RETENTION_DAYS = 30;

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    const now = new Date();
    const otp = await this.prisma.otpSession.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    const wa = await this.prisma.whatsappSession.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    const dlqCutoff = new Date(
      now.getTime() - DLQ_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    const dlq = await this.prisma.webhookDeadLetter.deleteMany({
      where: {
        status: { in: [WebhookDlqStatus.SUCCEEDED, WebhookDlqStatus.FAILED] },
        updatedAt: { lt: dlqCutoff },
      },
    });
    this.logger.log(
      `Cleanup: otp=${otp.count} wa=${wa.count} dlq=${dlq.count}`,
    );
  }
}
