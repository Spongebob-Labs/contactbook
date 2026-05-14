import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export type JwtUserPayload = {
  sub: string;
  email?: string;
  /** National digits (no country calling code). */
  phone: string;
  /** E.164 country calling prefix (e.g. +1). */
  countryCode: string;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUserPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtUserPayload }>();
    return request.user;
  },
);
