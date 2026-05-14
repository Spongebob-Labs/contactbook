/** JWT `typ` claim for short-lived phone verification after WhatsApp OTP. */
export const PHONE_VERIFICATION_JWT_TYP = "phone_verification";

/** Response headers carrying session credentials (not in JSON body). */
export const CONTACTBOOK_USER_ID_HEADER = "X-Contactbook-User-Id";
export const CONTACTBOOK_ACCESS_TOKEN_HEADER = "X-Contactbook-Access-Token";
export const CONTACTBOOK_REFRESH_TOKEN_HEADER = "X-Contactbook-Refresh-Token";

export const CONTACTBOOK_AUTH_EXPOSED_HEADERS = [
  CONTACTBOOK_USER_ID_HEADER,
  CONTACTBOOK_ACCESS_TOKEN_HEADER,
  CONTACTBOOK_REFRESH_TOKEN_HEADER,
] as const;
