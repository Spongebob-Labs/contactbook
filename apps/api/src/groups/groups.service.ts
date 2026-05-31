import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ContactSource, type ContactGroup } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateContactGroupDto,
  UpdateContactGroupDto,
} from "./dto/group.dto";

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<ContactGroup[]> {
    return this.prisma.contactGroup.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });
  }

  async create(
    userId: string,
    dto: CreateContactGroupDto,
  ): Promise<ContactGroup> {
    const name = dto.name.trim();
    try {
      return await this.prisma.contactGroup.create({
        data: { userId, name, source: null, externalId: null },
      });
    } catch {
      throw new ConflictException(`Group "${name}" already exists`);
    }
  }

  async update(
    userId: string,
    groupId: string,
    dto: UpdateContactGroupDto,
  ): Promise<ContactGroup> {
    const existing = await this.requireOwned(userId, groupId);
    if (existing.source != null) {
      throw new ConflictException("Imported provider groups cannot be renamed");
    }
    const name = dto.name.trim();
    try {
      return await this.prisma.contactGroup.update({
        where: { id: groupId },
        data: { name },
      });
    } catch {
      throw new ConflictException(`Group "${name}" already exists`);
    }
  }

  async remove(userId: string, groupId: string): Promise<void> {
    const existing = await this.requireOwned(userId, groupId);
    if (existing.source != null) {
      throw new ConflictException(
        "Imported provider groups are removed on the next provider sync",
      );
    }
    await this.prisma.contactGroup.delete({ where: { id: groupId } });
  }

  async requireOwned(userId: string, groupId: string): Promise<ContactGroup> {
    const group = await this.prisma.contactGroup.findFirst({
      where: { id: groupId, userId },
    });
    if (!group) {
      throw new NotFoundException("Group not found");
    }
    return group;
  }

  async requireOwnedMany(
    userId: string,
    groupIds: string[],
  ): Promise<ContactGroup[]> {
    if (groupIds.length === 0) {
      return [];
    }
    const groups = await this.prisma.contactGroup.findMany({
      where: { userId, id: { in: groupIds } },
    });
    if (groups.length !== groupIds.length) {
      throw new NotFoundException("One or more groups not found");
    }
    return groups;
  }

  async upsertProviderGroup(
    userId: string,
    source: ContactSource,
    externalId: string,
    name: string,
  ): Promise<ContactGroup> {
    return this.prisma.contactGroup.upsert({
      where: {
        userId_source_externalId: { userId, source, externalId },
      },
      create: { userId, source, externalId, name },
      update: { name },
    });
  }
}
