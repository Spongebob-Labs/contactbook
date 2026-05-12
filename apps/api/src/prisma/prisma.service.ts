import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const ssl = PrismaService.resolveSslConfig(connectionString);

    const pool = new Pool({
      connectionString,
      ssl,
    });

    const adapter = new PrismaPg(pool);

    super({
      adapter,
      log: [
        { emit: "event", level: "query" },
        { emit: "event", level: "error" },
        { emit: "event", level: "warn" },
      ],
    });

    this.pool = pool;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Prisma connected to database");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
    this.logger.log("Prisma disconnected from database");
  }

  private static resolveSslConfig(
    connectionString: string | undefined,
  ): false | { rejectUnauthorized: boolean } {
    if (!connectionString) {
      return false;
    }

    try {
      const url = new URL(connectionString);
      const host = url.hostname.toLowerCase();
      const sslMode = url.searchParams.get("sslmode")?.toLowerCase();

      if (sslMode === "disable") {
        return false;
      }

      const isLocalHost =
        host === "localhost" || host === "127.0.0.1" || host === "::1";

      if (isLocalHost) {
        return false;
      }

      return { rejectUnauthorized: false };
    } catch {
      return false;
    }
  }
}
