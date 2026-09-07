import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { TwilioSignatureGuard } from './twilio-signature.guard';
import { WebhooksService } from './webhooks.service';

/**
 * Public by necessity — Twilio calls this, not a logged-in user — but never
 * unauthenticated in practice: TwilioSignatureGuard rejects anything not
 * carrying a valid X-Twilio-Signature before this handler ever runs.
 *
 * Twilio POSTs application/x-www-form-urlencoded, which Express's default
 * body parser already turns into a plain object on `req.body` — no special
 * parsing needed here, and no typed class-validator DTO either: Twilio's
 * payload shape varies by message type (media, location, etc.) and a
 * whitelist-enforcing DTO (this app's global ValidationPipe has
 * forbidNonWhitelisted: true) would reject a legitimate webhook the moment
 * Twilio includes a field this endpoint didn't enumerate in advance.
 */
@ApiExcludeController()
@Controller({ path: 'webhooks/twilio', version: '1' })
export class TwilioInboundController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post('inbound')
  @UseGuards(TwilioSignatureGuard)
  @HttpCode(200)
  async inbound(@Body() body: Record<string, string>): Promise<{ ok: true }> {
    // Always 200 once the signature is valid — a genuine processing error
    // (not the known duplicate-delivery case, which the service itself
    // treats as success) is left to propagate as a 500, which is the one
    // outcome that SHOULD make Twilio retry.
    await this.webhooks.recordInbound(body);
    return { ok: true };
  }
}
