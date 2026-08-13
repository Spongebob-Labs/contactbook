/**
 * Client-held session tokens for cross-origin API calls.
 * Live API accepts `Authorization: Bearer <accessToken>` or httpOnly cookies.
 * The app and `https://api.getcontactbook.com` are different sites, so the API's
 * `SameSite=lax` cookies are never sent back from the browser — these tokens are
 * the only session the deployed app has. They live in `localStorage` so the
 * session survives closing the tab (the access token is valid for 7 days and the
 * refresh token for 30); `clearSessionTokens` on logout is what ends it.
 */

const ACCESS_TOKEN_KEY = "cb_client_access_token";
const REFRESH_TOKEN_KEY = "cb_client_refresh_token";

export type SessionTokens = {
  accessToken?: string | null;
  refreshToken?: string | null;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readStored(key: string): string | null {
  if (!canUseStorage()) {
    return null;
  }

  const persisted = localStorage.getItem(key)?.trim() ?? "";
  if (persisted.length > 0) {
    return persisted;
  }

  // Sessions signed in before tokens were persisted still have them in the
  // per-tab store; adopt those instead of forcing a fresh OTP after deploy.
  const carriedOver = sessionStorage.getItem(key)?.trim() ?? "";
  if (carriedOver.length === 0) {
    return null;
  }
  localStorage.setItem(key, carriedOver);
  sessionStorage.removeItem(key);
  return carriedOver;
}

export function getAccessToken(): string | null {
  return readStored(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return readStored(REFRESH_TOKEN_KEY);
}

export function setSessionTokens(tokens: SessionTokens): void {
  if (!canUseStorage()) {
    return;
  }
  const access = tokens.accessToken?.trim() ?? "";
  const refresh = tokens.refreshToken?.trim() ?? "";
  if (access) {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
  }
  if (refresh) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }
}

export function clearSessionTokens(): void {
  if (!canUseStorage()) {
    return;
  }
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function hasClientSessionHint(): boolean {
  return Boolean(getAccessToken() || getRefreshToken());
}
