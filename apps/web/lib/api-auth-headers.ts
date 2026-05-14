/** Must match `apps/api/src/auth/auth.constants.ts` (CORS exposes these to the browser). */
export const CONTACTBOOK_USER_ID_HEADER = "X-Contactbook-User-Id";
export const CONTACTBOOK_ACCESS_TOKEN_HEADER = "X-Contactbook-Access-Token";
export const CONTACTBOOK_REFRESH_TOKEN_HEADER = "X-Contactbook-Refresh-Token";

export function readSessionFromResponseHeaders(headers: Headers): {
  userId: string;
  accessToken: string;
  refreshToken: string;
} | null {
  const userId = headers.get(CONTACTBOOK_USER_ID_HEADER);
  const accessToken = headers.get(CONTACTBOOK_ACCESS_TOKEN_HEADER);
  const refreshToken = headers.get(CONTACTBOOK_REFRESH_TOKEN_HEADER);
  if (!userId || !accessToken || !refreshToken) {
    return null;
  }
  return { userId, accessToken, refreshToken };
}
