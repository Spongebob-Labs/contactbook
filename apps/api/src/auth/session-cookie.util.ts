import type { ConfigService } from "@nestjs/config";
import type { CookieOptions, Response } from "express";
import { parseRelativeMs } from "./parse-relative-ms";

export const CB_ACCESS_TOKEN_COOKIE = "cb_access_token";
export const CB_REFRESH_TOKEN_COOKIE = "cb_refresh_token";
export const CB_USER_ID_COOKIE = "cb_user_id";

export type SessionCookieRuntime = {
  accessMaxAgeMs: number;
  refreshMaxAgeMs: number;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
  domain?: string;
};

function parseSameSite(v: string | undefined): "lax" | "strict" | "none" {
  const normalized = (v ?? "lax").toLowerCase();
  if (normalized === "none" || normalized === "strict" || normalized === "lax") {
    return normalized;
  }
  return "lax";
}

export function resolveSessionCookieRuntime(
  config: ConfigService,
): SessionCookieRuntime {
  const accessMaxAgeMs = parseRelativeMs(
    config.get<string>("JWT_EXPIRES_IN", "7d"),
    7 * 86_400_000,
  );
  const refreshMaxAgeMs = parseRelativeMs(
    config.get<string>("JWT_REFRESH_EXPIRES_IN", "30d"),
    30 * 86_400_000,
  );
  let secure =
    config.get<string>("COOKIE_SECURE", "").toLowerCase() === "true" ||
    process.env.NODE_ENV === "production";
  const sameSite = parseSameSite(config.get<string>("AUTH_COOKIE_SAME_SITE"));
  if (sameSite === "none") {
    secure = true;
  }
  const domainRaw = config.get<string>("AUTH_COOKIE_DOMAIN")?.trim();
  const domain = domainRaw && domainRaw.length > 0 ? domainRaw : undefined;
  return { accessMaxAgeMs, refreshMaxAgeMs, sameSite, secure, domain };
}

function baseCookieOptions(runtime: SessionCookieRuntime): CookieOptions {
  return {
    path: "/",
    sameSite: runtime.sameSite,
    secure: runtime.secure,
    ...(runtime.domain !== undefined ? { domain: runtime.domain } : {}),
  };
}

export type SessionPayload = {
  userId: string;
  accessToken: string;
  refreshToken: string;
};

export function setSessionCookies(
  res: Response,
  session: SessionPayload,
  runtime: SessionCookieRuntime,
): void {
  const base = baseCookieOptions(runtime);
  res.cookie(CB_ACCESS_TOKEN_COOKIE, session.accessToken, {
    ...base,
    httpOnly: true,
    maxAge: runtime.accessMaxAgeMs,
  });
  res.cookie(CB_REFRESH_TOKEN_COOKIE, session.refreshToken, {
    ...base,
    httpOnly: true,
    maxAge: runtime.refreshMaxAgeMs,
  });
  res.cookie(CB_USER_ID_COOKIE, session.userId, {
    ...base,
    httpOnly: false,
    maxAge: runtime.accessMaxAgeMs,
  });
}

export function clearSessionCookies(res: Response, runtime: SessionCookieRuntime): void {
  const base = baseCookieOptions(runtime);
  res.clearCookie(CB_ACCESS_TOKEN_COOKIE, base);
  res.clearCookie(CB_REFRESH_TOKEN_COOKIE, base);
  res.clearCookie(CB_USER_ID_COOKIE, base);
}

/** Parse a single cookie value from the raw `Cookie` header (first match wins). */
export function getCookieFromHeader(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) {
    return undefined;
  }
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (key !== name) {
      continue;
    }
    try {
      return decodeURIComponent(trimmed.slice(eq + 1).trim());
    } catch {
      return trimmed.slice(eq + 1).trim();
    }
  }
  return undefined;
}
