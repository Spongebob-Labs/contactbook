/**
 * Google scopes for ContactBook: profile + People + Calendar (read-only).
 * Must stay aligned with API usage in `apps/api/src/integration/google.service.ts`.
 */
export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");
