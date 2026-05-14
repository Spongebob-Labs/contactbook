import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { JwtUserPayload } from "../common/decorators/current-user.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CardService } from "./card.service";
import { AddCardFieldMappingDto } from "./dto/add-card-field-mapping.dto";
import { CreateContactCardDto } from "./dto/create-contact-card.dto";
import { UpdateContactCardDto } from "./dto/update-contact-card.dto";

@ApiTags("Cards")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@Controller({ path: "cards", version: "1" })
export class CardController {
  constructor(private readonly cards: CardService) {}

  @Get()
  @ApiOperation({ summary: "List contact cards" })
  list(@CurrentUser() user: JwtUserPayload) {
    return this.cards.listCards(user.sub);
  }

  @Post()
  @ApiOperation({ summary: "Create contact card" })
  create(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateContactCardDto) {
    return this.cards.createCard(user.sub, dto);
  }

  @Get(":cardId")
  @ApiOperation({ summary: "Get contact card" })
  get(
    @CurrentUser() user: JwtUserPayload,
    @Param("cardId", ParseUUIDPipe) cardId: string,
  ) {
    return this.cards.getCard(user.sub, cardId);
  }

  @Patch(":cardId")
  @ApiOperation({ summary: "Update contact card" })
  update(
    @CurrentUser() user: JwtUserPayload,
    @Param("cardId", ParseUUIDPipe) cardId: string,
    @Body() dto: UpdateContactCardDto,
  ) {
    return this.cards.updateCard(user.sub, cardId, dto);
  }

  @Delete(":cardId")
  @ApiOperation({ summary: "Delete contact card" })
  async delete(
    @CurrentUser() user: JwtUserPayload,
    @Param("cardId", ParseUUIDPipe) cardId: string,
  ): Promise<{ ok: true }> {
    await this.cards.deleteCard(user.sub, cardId);
    return { ok: true };
  }

  @Get(":cardId/field-mappings")
  @ApiOperation({ summary: "List field mappings on a card" })
  listMappings(
    @CurrentUser() user: JwtUserPayload,
    @Param("cardId", ParseUUIDPipe) cardId: string,
  ) {
    return this.cards.listMappings(user.sub, cardId);
  }

  @Post(":cardId/field-mappings")
  @ApiOperation({ summary: "Map a profile field onto this card" })
  addMapping(
    @CurrentUser() user: JwtUserPayload,
    @Param("cardId", ParseUUIDPipe) cardId: string,
    @Body() dto: AddCardFieldMappingDto,
  ) {
    return this.cards.addMapping(user.sub, cardId, dto);
  }

  @Delete(":cardId/field-mappings/:fieldId")
  @ApiOperation({ summary: "Remove a field mapping from this card" })
  async removeMapping(
    @CurrentUser() user: JwtUserPayload,
    @Param("cardId", ParseUUIDPipe) cardId: string,
    @Param("fieldId", ParseUUIDPipe) fieldId: string,
  ): Promise<{ ok: true }> {
    await this.cards.removeMapping(user.sub, cardId, fieldId);
    return { ok: true };
  }
}
