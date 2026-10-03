import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { WalletPassService } from './wallet-pass.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

/**
 * Apple PassKit web service endpoints. Apple builds all URLs as
 * `${webServiceURL}/v1/...`. Our global prefix is `/api` with URI versioning,
 * which would land a normal controller at `/api/v1/wallet/...`. Using
 * VERSION_NEUTRAL keeps the base at `/api/wallet` so routes resolve as
 * `/api/wallet/v1/...` with the `v1` part in each @Get/@Post path.
 *
 * No JWT — Apple devices authenticate with ApplePass tokens derived via HMAC.
 * No global error envelope: these endpoints return bare HTTP statuses per
 * Apple's specification.
 *
 * @Header() decorators are intentionally absent: all endpoints use @Res()
 * (non-passthrough), so headers are set inline via res.setHeader().
 */
@ApiExcludeController()
@Controller({ path: 'wallet', version: VERSION_NEUTRAL })
export class WalletWebServiceController {
  private readonly logger = new Logger(WalletWebServiceController.name);

  constructor(private readonly walletPass: WalletPassService) {}

  /** Apple calls this when a device adds the pass. Body: {pushToken}. */
  @Post('v1/devices/:deviceId/registrations/:passTypeId/:serial')
  async registerDevice(
    @Param('deviceId') deviceId: string,
    @Param('passTypeId') passTypeId: string,
    @Param('serial') serial: string,
    @Body() body: RegisterDeviceDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');

    const authToken = extractApplePassToken(req);
    if (!authToken) {
      res.status(401).end();
      return;
    }

    const created = await this.walletPass.registerDevice(
      passTypeId,
      serial,
      deviceId,
      authToken,
      body.pushToken,
    );

    if (created === false) {
      res.status(401).end();
      return;
    }

    res.status(created ? 201 : 200).end();
  }

  /** Apple calls this when the user removes the pass from Wallet. */
  @Delete('v1/devices/:deviceId/registrations/:passTypeId/:serial')
  async unregisterDevice(
    @Param('deviceId') deviceId: string,
    @Param('passTypeId') passTypeId: string,
    @Param('serial') serial: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');

    const authToken = extractApplePassToken(req);
    if (!authToken) {
      res.status(401).end();
      return;
    }

    const ok = await this.walletPass.unregisterDevice(
      passTypeId,
      serial,
      deviceId,
      authToken,
    );

    res.status(ok ? 200 : 401).end();
  }

  /**
   * Apple calls this to check whether any passes on this device have been
   * updated since a given tag. No auth on this endpoint per Apple's spec.
   */
  @Get('v1/devices/:deviceId/registrations/:passTypeId')
  async getUpdatedPasses(
    @Param('deviceId') deviceId: string,
    @Param('passTypeId') passTypeId: string,
    @Query('passesUpdatedSince') passesUpdatedSince: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');

    const result = await this.walletPass.getUpdatedPasses(
      passTypeId,
      deviceId,
      passesUpdatedSince,
    );

    if (!result || result.serialNumbers.length === 0) {
      res.status(204).end();
      return;
    }

    res.status(200).json({
      serialNumbers: result.serialNumbers,
      lastUpdated: result.lastUpdated,
    });
  }

  /**
   * Apple calls this to fetch the latest version of a pass. Supports
   * If-Modified-Since for conditional 304 responses.
   */
  @Get('v1/passes/:passTypeId/:serial')
  async getLatestPass(
    @Param('passTypeId') passTypeId: string,
    @Param('serial') serial: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');

    const authToken = extractApplePassToken(req);
    if (!authToken) {
      res.status(401).end();
      return;
    }

    const result = await this.walletPass.buildPassForApple(
      passTypeId,
      serial,
      authToken,
    );

    if (!result) {
      res.status(404).end();
      return;
    }

    const ifModifiedSince = req.headers['if-modified-since'];
    if (ifModifiedSince) {
      const sinceMs = new Date(ifModifiedSince).getTime();
      const lastModifiedMs = parseInt(result.lastModifiedTag, 10);
      if (
        !isNaN(sinceMs) &&
        !isNaN(lastModifiedMs) &&
        lastModifiedMs <= sinceMs
      ) {
        res.status(304).end();
        return;
      }
    }

    res.setHeader(
      'Last-Modified',
      new Date(parseInt(result.lastModifiedTag, 10)).toUTCString(),
    );
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.status(200).send(result.buffer);
  }

  /** Apple devices report pass errors here. */
  @Post('v1/log')
  @HttpCode(200)
  logErrors(@Body() body: { logs?: string[] }): void {
    const logs = body?.logs ?? [];
    this.logger.log({ event: 'wallet.device_log', logs });
  }
}

function extractApplePassToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('ApplePass ')) return null;
  return auth.slice('ApplePass '.length).trim() || null;
}
