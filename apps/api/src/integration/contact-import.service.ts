import { Injectable, NotFoundException } from "@nestjs/common";
import { ContactImport, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type UserOverridesShape = {
  locks?: Record<string, boolean>;
  values?: Record<string, string>;
};

@Injectable()
export class ContactImportService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<ContactImport[]> {
    return this.prisma.contactImport.findMany({
      where: { userId, deletedAt: null },
      orderBy: { displayNameSnapshot: "asc" },
    });
  }

  async patchOverrides(
    userId: string,
    id: string,
    userOverrides: Prisma.JsonValue,
  ): Promise<ContactImport> {
    const row = await this.prisma.contactImport.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new NotFoundException("Contact import not found");
    }
    return this.prisma.contactImport.update({
      where: { id },
      data: { userOverrides: userOverrides as Prisma.InputJsonValue },
    });
  }

  mergeDisplayNameSnapshot(
    rawPerson: unknown,
    userOverrides: Prisma.JsonValue | null,
  ): string {
    const person = rawPerson as {
      names?: Array<{ metadata?: { primary?: boolean }; displayName?: string }>;
    };
    const primary =
      person.names?.find((n) => n.metadata?.primary) ?? person.names?.[0];
    const fromGoogle =
      primary?.displayName ??
      (primary as { unstructuredName?: string } | undefined)
        ?.unstructuredName ??
      person.names?.[0]?.displayName ??
      "Unknown";
    const overrides = (userOverrides ?? null) as UserOverridesShape | null;
    const locked = overrides?.locks?.displayName === true;
    if (locked && overrides?.values?.displayName) {
      return overrides.values.displayName;
    }
    return fromGoogle;
  }
}
