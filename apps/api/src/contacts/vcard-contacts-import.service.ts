import { BadRequestException, Injectable } from "@nestjs/common";
import { ContactSource } from "@prisma/client";
import type { Express } from "express";
import { emptyContactSyncStats } from "./contact-sync-stats";
import type { ContactImportRun } from "./contact-import-result.mapper";
import { ContactUpsertService } from "./contact-upsert.service";
import { PrismaService } from "../prisma/prisma.service";
import { parseVcfImport } from "./vcard-contact.adapter";
import { VCF_IMPORT_BATCH_SIZE } from "./vcard-import.constants";
import { assertVcfUploadFile } from "./vcard-file.validation";

@Injectable()
export class VcardContactsImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contactUpsert: ContactUpsertService,
  ) {}

  async importFromFile(
    userId: string,
    file: Express.Multer.File | undefined,
    options?: { contentType?: string },
  ): Promise<ContactImportRun> {
    assertVcfUploadFile(file, options);
    const text = file!.buffer.toString("utf8");
    const { contacts, skipped } = parseVcfImport(text);
    if (contacts.length === 0 && skipped.length === 0) {
      throw new BadRequestException(
        "No valid vCards found in the uploaded file.",
      );
    }

    const stats =
      contacts.length > 0
        ? await this.contactUpsert.upsertBatch(userId, contacts, {
            batchSize: VCF_IMPORT_BATCH_SIZE,
          })
        : emptyContactSyncStats();

    const completedAt = new Date();

    await this.prisma.integrationState.upsert({
      where: {
        userId_source: { userId, source: ContactSource.VCARD },
      },
      create: {
        userId,
        source: ContactSource.VCARD,
        lastSyncAt: completedAt,
        lastSyncAdded: stats.added,
        lastSyncUpdated: stats.updated,
        lastSyncDeleted: stats.deleted,
        lastSyncDuplicates: stats.duplicatesFound,
      },
      update: {
        lastSyncAt: completedAt,
        lastSyncAdded: stats.added,
        lastSyncUpdated: stats.updated,
        lastSyncDeleted: stats.deleted,
        lastSyncDuplicates: stats.duplicatesFound,
      },
    });

    return { stats, skipped, completedAt };
  }
}
