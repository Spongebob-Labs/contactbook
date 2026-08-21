import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import type { Request } from 'express';
import { AppConfigService } from '../config/app-config.service';

/**
 * There is no IAM layer in front of this endpoint — the VM is plain HTTPS
 * behind Caddy, so anyone who finds the URL can POST to it. The application
 * verifies the caller itself: the token must be a genuine Google-signed OIDC
 * token (signature + issuer + expiry, via verifyIdToken), minted for OUR
 * audience, AND belonging to the specific invoker service account.
 *
 * Checking the signature alone is not enough — that would accept a valid
 * token from ANY Google service account on the internet. The email check is
 * what actually restricts the caller to Cloud Tasks.
 */
@Injectable()
export class TasksOidcGuard implements CanActivate {
  private readonly client = new OAuth2Client();

  constructor(private readonly config: AppConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

    const { oidcAudience, invokerServiceAccount } = this.config.tasks;
    if (!token || !oidcAudience || !invokerServiceAccount) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Missing or unconfigured OIDC auth.',
      });
    }

    try {
      const ticket = await this.client.verifyIdToken({
        idToken: token,
        audience: oidcAudience,
      });
      const payload = ticket.getPayload();
      if (
        !payload?.email ||
        payload.email !== invokerServiceAccount ||
        !payload.email_verified
      ) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Unrecognised caller.',
        });
      }
      return true;
    } catch {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Invalid OIDC token.',
      });
    }
  }
}
