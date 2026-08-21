import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { setLogContext } from '../common/logging/log-context.storage';
import { readAuthCookie } from './auth-cookies.util';

export interface AuthenticatedUser {
  id: string;
  phoneE164: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);

    if (!token || !this.config.jwt.accessSecret) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Sign in required.',
      });
    }

    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        phoneE164: string;
      }>(token, {
        secret: this.config.jwt.accessSecret,
      });
      req.user = { id: payload.sub, phoneE164: payload.phoneE164 };
      // Every subsequent log line for this request is now attributable
      // without threading the user id through every call signature.
      setLogContext({ userId: payload.sub });
      return true;
    } catch {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Invalid or expired session.',
      });
    }
  }

  private extractToken(req: Request): string | null {
    const header = req.header('authorization');
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return readAuthCookie(req, 'cb_access_token');
  }
}
