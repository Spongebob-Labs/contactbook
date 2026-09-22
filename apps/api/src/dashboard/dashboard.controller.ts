import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';

@ApiTags('dashboard')
@ApiBearerAuth('access-token')
@ApiCookieAuth('cb_access_token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Everything the dashboard screen needs, in one call',
    description:
      'Replaces the client-side assembly of GET /cards + GET /contacts + GET /share-links + ' +
      'one GET /cards/:id/audience per card (an N+1 on every load). Every count here is ' +
      "computed from the caller's own non-archived cards and their ACTIVE ShareLinks only — " +
      'see DashboardResponseDto for the exact contract each field follows.',
  })
  @ApiResponse({ status: 200, type: DashboardResponseDto })
  async get(@Req() req: Request): Promise<DashboardResponseDto> {
    return this.dashboard.getDashboard(req.user!.id);
  }
}
