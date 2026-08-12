/**
 * Client-held session tokens for cross-origin API calls.
 * Live API accepts `Authorization: Bearer <accessToken>` or httpOnly cookies.
 * Absolute `https://api.getcontactbook.com` often cannot rely on cookies alone
 * from localhost, so we persist tokens from verify (and refresh) responses.
 */

const ACCESS_TOKEN_KEY = "cb_client_access_token";
const REFRESH_TOKEN_KEY = "cb_client_refresh_token";

export type SessionTokens = {
  accessToken?: string | null;
  refreshToken?: string | null;
};

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

export function getAccessToken(): string | null {
  if (!canUseSessionStorage()) {
    return null;
  }
  const value = sessionStorage.getItem(ACCESS_TOKEN_KEY)?.trim() ?? "";
  return value.length > 0 ? value : null;
}

export function getRefreshToken(): string | null {
  if (!canUseSessionStorage()) {
    return null;
  }
  const value = sessionStorage.getItem(REFRESH_TOKEN_KEY)?.trim() ?? "";
  return value.length > 0 ? value : null;
}

export function setSessionTokens(tokens: SessionTokens): void {
  if (!canUseSessionStorage()) {
    return;
  }
  const access = tokens.accessToken?.trim() ?? "";
  const refresh = tokens.refreshToken?.trim() ?? "";
  if (access) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, access);
  }
  if (refresh) {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }
}

export function clearSessionTokens(): void {
  if (!canUseSessionStorage()) {
    return;
  }
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function hasClientSessionHint(): boolean {
  return Boolean(getAccessToken() || getRefreshToken());
}
