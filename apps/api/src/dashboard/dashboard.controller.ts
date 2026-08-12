import { Controller, Get, UseFilters, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ApiExceptionFilter } from "../common/filters/api-exception.filter";
import type { JwtUserPayload } from "../common/decorators/current-user.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { DashboardService } from "./dashboard.service";
import { DashboardStatsDto } from "./dto/dashboard-stats.dto";

@ApiTags("Dashboard")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@UseFilters(ApiExceptionFilter)
@Controller({ path: "dashboard", version: "1" })
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("stats")
  @ApiOperation({
    summary: "Get dashboard stats",
    description:
      "Returns aggregate counts and top-N lists for the authenticated user's cards, contacts, and WhatsApp shares.",
  })
  @ApiOkResponse({ type: DashboardStatsDto })
  getStats(@CurrentUser() user: JwtUserPayload): Promise<DashboardStatsDto> {
    return this.dashboard.getStats(user.sub);
  }
}
