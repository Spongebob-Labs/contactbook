import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";

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
    this.logger.log(`Cleanup: otp=${otp.count} wa=${wa.count}`);
  }
}
