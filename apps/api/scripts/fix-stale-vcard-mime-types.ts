/**
 * One-off: re-uploads every existing VCardAsset's GCS object with the corrected
 * text/x-vcard Content-Type (the original upload happened before that fix landed, and
 * content-hash dedup means getOrCreateAsset never re-uploads an unchanged card's file,
 * so those older objects are stuck with the stale text/vcard header otherwise).
 * Also backfills the DB row's mimeType column to match, for consistency.
 *
 * Usage (from repo root):
 *   pnpm -C apps/api exec ts-node --transpile-only scripts/fix-stale-vcard-mime-types.ts
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { GcsUploadService } from "../src/storage/gcs-upload.service";

const apiDir = resolve(__dirname, "..");
loadEnv({ path: resolve(apiDir, ".env") });
loadEnv({ path: resolve(apiDir, ".env.local"), override: true });

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true })],
    providers: [GcsUploadService],
  }).compile();
  const gcsUpload = moduleRef.get(GcsUploadService);
  const bucket = process.env.GCS_CARD_SHARES_BUCKET ?? "";

  try {
    const stale = await prisma.vCardAsset.findMany({
      where: { mimeType: { not: "text/x-vcard" } },
    });
    console.log(`Found ${stale.length} stale asset(s).`);

    for (const asset of stale) {
      const res = await fetch(asset.storageUrl);
      const buffer = Buffer.from(await res.arrayBuffer());
      await gcsUpload.upload(bucket, asset.objectKey, buffer, "text/x-vcard", {
        cacheControl: "public, max-age=31536000, immutable",
      });
      await prisma.vCardAsset.update({
        where: { id: asset.id },
        data: { mimeType: "text/x-vcard" },
      });
      console.log(`Fixed ${asset.objectKey}`);
    }
  } finally {
    await moduleRef.close();
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
