import { Injectable, NotFoundException } from "@nestjs/common";
import { ContactImport } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ContactImportService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<ContactImport[]> {
    return this.prisma.contactImport.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
  }

  async get(userId: string, id: string): Promise<ContactImport> {
    const row = await this.prisma.contactImport.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new NotFoundException("Contact import not found");
    }
    return row;
  }
}
