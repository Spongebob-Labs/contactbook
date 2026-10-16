import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { validateRequest } from 'twilio';
import type { Request } from 'express';
import { AppConfigService } from '../config/app-config.service';

/**
 * Twilio signs every webhook request with an X-Twilio-Signature header —
 * HMAC-SHA1 over the exact URL it POSTed to plus the sorted form params,
 * keyed with the account's auth token. `twilio.validateRequest()` recomputes
 * that same signature and compares.
 *
 * The URL matters as much as the token: it must be the exact public URL
 * Twilio used, not whatever Express thinks the request's URL is internally
 * (which can differ behind a reverse proxy). Rather than trust `req.protocol`/
 * `req.hostname` — trust-proxy misconfiguration is exactly the kind of thing
 * that silently breaks signature validation only in production, behind
 * Caddy — this reuses TASKS_TARGET_BASE_URL, the same "what's my own public
 * base URL" config value Cloud Tasks callbacks already rely on for the
 * identical reason (see outbox/task-enqueuer.ts). One deployment, one public
 * base URL, used by both.
 */
@Injectable()
export class TwilioSignatureGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip signature validation in local dev — lets you curl the endpoint
    // without a real Twilio signature. Never runs in production because
    // APP_ENV is validated to be 'production' | 'staging' there.
    if (this.config.appEnv === 'local') {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const signature = req.header('x-twilio-signature');
    const { authToken } = this.config.twilio;
    const { targetBaseUrl } = this.config.tasks;

    if (!signature || !authToken || !targetBaseUrl) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message:
          'Missing signature or unconfigured Twilio webhook verification.',
      });
    }

    const url = `${targetBaseUrl.replace(/\/+$/, '')}${req.originalUrl}`;
    const params = (req.body ?? {}) as Record<string, string>;

    const valid = validateRequest(authToken, signature, url, params);
    if (!valid) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Invalid Twilio signature.',
      });
    }
    return true;
  }
}
