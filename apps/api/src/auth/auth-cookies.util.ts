import type { CookieOptions, Request, Response } from 'express';
import { AppConfigService } from '../config/app-config.service';
import type { IssuedTokens } from './token.service';

export function setAuthCookies(
  res: Response,
  config: AppConfigService,
  tokens: IssuedTokens,
): void {
  const base: CookieOptions = {
    httpOnly: true,
    secure: config.authCookie.secure,
    sameSite: config.authCookie.sameSite,
    domain: config.authCookie.domain,
    path: '/',
  };

  res.cookie('cb_access_token', tokens.accessToken, {
    ...base,
    maxAge: tokens.accessTtlSeconds * 1000,
  });

  res.cookie('cb_refresh_token', tokens.refreshToken, {
    ...base,
    maxAge: tokens.refreshTtlSeconds * 1000,
    // Scoped narrower than the access cookie: only the two endpoints that
    // ever need to read a refresh token get it sent to them.
    path: '/api/v1/auth',
  });
}

export function clearAuthCookies(
  res: Response,
  config: AppConfigService,
): void {
  const base: CookieOptions = {
    httpOnly: true,
    secure: config.authCookie.secure,
    sameSite: config.authCookie.sameSite,
    domain: config.authCookie.domain,
  };
  res.clearCookie('cb_access_token', { ...base, path: '/' });
  res.clearCookie('cb_refresh_token', { ...base, path: '/api/v1/auth' });
}

/** The one place `req.cookies` is read — cookie-parser's types leave it
 *  untyped, so every other read site would otherwise be an unsafe `any`
 *  access flagged by eslint. */
export function readAuthCookie(
  req: Request,
  name: 'cb_access_token' | 'cb_refresh_token',
): string | null {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[name] ?? null;
}
