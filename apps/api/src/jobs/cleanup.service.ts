import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConnectionStatus, FieldAccessRequestStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    const now = new Date();
    const connections = await this.prisma.connection.updateMany({
      where: {
        status: ConnectionStatus.ACCEPTED,
        shareExpiresAt: { not: null, lt: now },
      },
      data: { status: ConnectionStatus.REVOKED },
    });
    const sensitive = await this.prisma.sensitiveFieldAccessRequest.updateMany({
      where: {
        status: FieldAccessRequestStatus.PENDING,
        expiresAt: { not: null, lt: now },
      },
      data: {
        status: FieldAccessRequestStatus.EXPIRED,
        resolvedAt: now,
      },
    });
    const otp = await this.prisma.otpSession.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    const wa = await this.prisma.whatsappSession.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    this.logger.log(
      `Cleanup: connections=${connections.count} sensitive=${sensitive.count} otp=${otp.count} wa=${wa.count}`,
    );
  }
}
