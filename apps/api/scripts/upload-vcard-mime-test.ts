/**
 * One-off diagnostic: uploads the same small sample vCard twice to the card-shares
 * bucket, once as text/vcard and once as application/octet-stream, so we can test
 * whether WhatsApp's "Unsupported media file type" rejection (Twilio error 63013) is
 * caused by the text/vcard MIME type specifically. Uses the app's own GCS credentials
 * (Application Default Credentials) — the same ones the running app already uses
 * successfully — not the separate `gcloud` CLI login.
 *
 * Usage (from repo root):
 *   pnpm -C apps/api exec ts-node --transpile-only scripts/upload-vcard-mime-test.ts
 */
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { GcsUploadService } from "../src/storage/gcs-upload.service";

const apiDir = resolve(__dirname, "..");
loadEnv({ path: resolve(apiDir, ".env") });
loadEnv({ path: resolve(apiDir, ".env.local"), override: true });

const SAMPLE_VCARD = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "FN:Ada Lovelace",
  "N:Lovelace;Ada;;;",
  "TEL;TYPE=CELL:+15550001111",
  "END:VCARD",
].join("\r\n");

async function main() {
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true })],
    providers: [GcsUploadService],
  }).compile();

  const gcsUpload = moduleRef.get(GcsUploadService);
  const bucket = "contactbook-card-shares";

  await gcsUpload.upload(
    bucket,
    "test-octet-stream.vcf",
    Buffer.from(SAMPLE_VCARD, "utf-8"),
    "application/octet-stream",
  );
  console.log(
    `Uploaded: https://storage.googleapis.com/${bucket}/test-octet-stream.vcf (application/octet-stream)`,
  );

  await moduleRef.close();
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
