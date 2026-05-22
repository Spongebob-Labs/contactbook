import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { JwtUserPayload } from "../../src/common/decorators/current-user.decorator";
import { TEST_USER_ID } from "../fixtures/profile-payloads";

export const testJwtUser: JwtUserPayload = {
  sub: TEST_USER_ID,
  email: "jane@example.com",
  phone: "2025551234",
  countryCode: "+1",
};

export const mockJwtGuard: CanActivate = {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: JwtUserPayload }>();
    req.user = testJwtUser;
    return true;
  },
};

@Injectable()
export class MockJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    return mockJwtGuard.canActivate(context);
  }
}

@Injectable()
export class RejectJwtAuthGuard implements CanActivate {
  canActivate(): never {
    throw new UnauthorizedException();
  }
}
