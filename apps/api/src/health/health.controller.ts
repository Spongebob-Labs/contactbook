import {
  Controller,
  Get,
  HttpCode,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Two endpoints, not one.
 *
 * The previous implementation had a single /health that returned HTTP 200 with
 * `status: "degraded"` when a dependency was down — so the container healthcheck
 * could never fail on a dependency outage, only on a dead process.
 *
 * Excluded from the public doc — this is infra plumbing (the uptime check, the
 * deploy script's gate) rather than a route any API consumer calls.
 */
@ApiExcludeController()
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: is the process up? No dependency checks — restarting the
   *  container cannot fix a downstream outage, so failing here would only
   *  cause a pointless restart loop. */
  @Get('live')
  @HttpCode(200)
  live() {
    return { status: 'ok', time: new Date().toISOString() };
  }

  /** Readiness: can we actually serve? Gated on Postgres only.
   *
   *  Twilio is deliberately NOT checked. An instance that cannot reach Twilio
   *  still serves the dashboard and every recipient page; sends queue in the
   *  outbox and drain later. Failing readiness there would take the whole
   *  product down over a partial outage. */
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Database is not reachable.',
      });
    }
    return { status: 'ok', time: new Date().toISOString() };
  }
}
