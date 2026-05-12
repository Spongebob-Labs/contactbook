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
import { CreateContactCardDto } from "./dto/create-contact-card.dto";
import { CreateProfileFieldDto } from "./dto/create-profile-field.dto";
import { CreateSensitiveFieldRequestDto } from "./dto/create-sensitive-field-request.dto";
import { UpdateContactCardDto } from "./dto/update-contact-card.dto";
import { UpdateProfileFieldDto } from "./dto/update-profile-field.dto";
import { ProfileService } from "./profile.service";

@ApiTags("Profile")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@Controller({ path: "profile", version: "1" })
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get("cards")
  @ApiOperation({ summary: "List contact cards" })
  listCards(@CurrentUser() user: JwtUserPayload) {
    return this.profile.listCards(user.sub);
  }

  @Post("cards")
  @ApiOperation({ summary: "Create contact card" })
  createCard(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: CreateContactCardDto,
  ) {
    return this.profile.createCard(user.sub, dto);
  }

  @Get("cards/:cardId")
  @ApiOperation({ summary: "Get contact card" })
  getCard(
    @CurrentUser() user: JwtUserPayload,
    @Param("cardId", ParseUUIDPipe) cardId: string,
  ) {
    return this.profile.getCard(user.sub, cardId);
  }

  @Patch("cards/:cardId")
  @ApiOperation({ summary: "Update contact card" })
  updateCard(
    @CurrentUser() user: JwtUserPayload,
    @Param("cardId", ParseUUIDPipe) cardId: string,
    @Body() dto: UpdateContactCardDto,
  ) {
    return this.profile.updateCard(user.sub, cardId, dto);
  }

  @Delete("cards/:cardId")
  @ApiOperation({ summary: "Delete contact card" })
  async deleteCard(
    @CurrentUser() user: JwtUserPayload,
    @Param("cardId", ParseUUIDPipe) cardId: string,
  ): Promise<{ ok: true }> {
    await this.profile.deleteCard(user.sub, cardId);
    return { ok: true };
  }

  @Get("cards/:cardId/fields")
  @ApiOperation({ summary: "List profile fields on a card" })
  listFields(
    @CurrentUser() user: JwtUserPayload,
    @Param("cardId", ParseUUIDPipe) cardId: string,
  ) {
    return this.profile.listFields(user.sub, cardId);
  }

  @Post("cards/:cardId/fields")
  @ApiOperation({ summary: "Add profile field" })
  createField(
    @CurrentUser() user: JwtUserPayload,
    @Param("cardId", ParseUUIDPipe) cardId: string,
    @Body() dto: CreateProfileFieldDto,
  ) {
    return this.profile.createField(user.sub, cardId, dto);
  }

  @Patch("fields/:fieldId")
  @ApiOperation({ summary: "Update profile field" })
  updateField(
    @CurrentUser() user: JwtUserPayload,
    @Param("fieldId", ParseUUIDPipe) fieldId: string,
    @Body() dto: UpdateProfileFieldDto,
  ) {
    return this.profile.updateField(user.sub, fieldId, dto);
  }

  @Delete("fields/:fieldId")
  @ApiOperation({ summary: "Delete profile field" })
  async deleteField(
    @CurrentUser() user: JwtUserPayload,
    @Param("fieldId", ParseUUIDPipe) fieldId: string,
  ): Promise<{ ok: true }> {
    await this.profile.deleteField(user.sub, fieldId);
    return { ok: true };
  }

  @Post("sensitive-field-requests")
  @ApiOperation({
    summary: "Request access to a sensitive field (WhatsApp approval)",
  })
  createSensitiveRequest(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: CreateSensitiveFieldRequestDto,
  ) {
    return this.profile.createSensitiveFieldRequest(user.sub, dto);
  }
}
