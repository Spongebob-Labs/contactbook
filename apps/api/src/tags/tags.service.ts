import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Tag } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateTagDto, UpdateTagDto } from "./dto/tag.dto";

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<Tag[]> {
    return this.prisma.tag.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });
  }

  async create(userId: string, dto: CreateTagDto): Promise<Tag> {
    const name = dto.name.trim();
    try {
      return await this.prisma.tag.create({
        data: { userId, name },
      });
    } catch {
      throw new ConflictException(`Tag "${name}" already exists`);
    }
  }

  async update(userId: string, tagId: string, dto: UpdateTagDto): Promise<Tag> {
    await this.requireOwned(userId, tagId);
    const name = dto.name.trim();
    try {
      return await this.prisma.tag.update({
        where: { id: tagId },
        data: { name },
      });
    } catch {
      throw new ConflictException(`Tag "${name}" already exists`);
    }
  }

  async remove(userId: string, tagId: string): Promise<void> {
    await this.requireOwned(userId, tagId);
    await this.prisma.tag.delete({ where: { id: tagId } });
  }

  async requireOwned(userId: string, tagId: string): Promise<Tag> {
    const tag = await this.prisma.tag.findFirst({
      where: { id: tagId, userId },
    });
    if (!tag) {
      throw new NotFoundException("Tag not found");
    }
    return tag;
  }

  async requireOwnedMany(userId: string, tagIds: string[]): Promise<Tag[]> {
    if (tagIds.length === 0) {
      return [];
    }
    const tags = await this.prisma.tag.findMany({
      where: { userId, id: { in: tagIds } },
    });
    if (tags.length !== tagIds.length) {
      throw new NotFoundException("One or more tags not found");
    }
    return tags;
  }
}
