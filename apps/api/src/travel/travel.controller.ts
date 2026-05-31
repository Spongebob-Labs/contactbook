import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { JwtUserPayload } from "../common/decorators/current-user.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TravelService } from "./travel.service";

class UpdateTravelSettingsDto {
  homeCity?: string | null;
  homeCountry?: string | null;
  calendarSyncEnabled?: boolean;
}

class SetTravelNotificationContactsDto {
  contactIds!: string[];
}

class DispatchTravelNotificationDto {
  message!: string;
}

@ApiTags("Travel")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@Controller({ path: "travel", version: "1" })
export class TravelController {
  constructor(private readonly travel: TravelService) {}

  @Get("settings")
  @ApiOperation({ summary: "Get travel settings" })
  getSettings(@CurrentUser() user: JwtUserPayload) {
    return this.travel.getSettings(user.sub);
  }

  @Patch("settings")
  @ApiOperation({ summary: "Update travel settings" })
  updateSettings(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: UpdateTravelSettingsDto,
  ) {
    return this.travel.updateSettings(user.sub, dto);
  }

  @Get("events")
  @ApiOperation({ summary: "List upcoming and past travel events" })
  listEvents(@CurrentUser() user: JwtUserPayload) {
    return this.travel.listEvents(user.sub);
  }

  @Get("notifications/contacts")
  @ApiOperation({ summary: "List contacts selected for travel notifications" })
  listNotifyContacts(@CurrentUser() user: JwtUserPayload) {
    return this.travel.listNotificationContacts(user.sub);
  }

  @Put("notifications/contacts")
  @ApiOperation({ summary: "Replace travel notification contact list" })
  setNotifyContacts(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: SetTravelNotificationContactsDto,
  ) {
    return this.travel.setNotificationContacts(user.sub, dto.contactIds ?? []);
  }

  @Post("notifications/dispatch")
  @ApiOperation({
    summary: "Dispatch travel notification to selected contacts",
  })
  @ApiOkResponse({ description: "Number of contacts targeted" })
  dispatch(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: DispatchTravelNotificationDto,
  ) {
    return this.travel.dispatchTravelNotifications(user.sub, dto.message);
  }
}
