/**
 * Frontend → API path contract map.
 * Live production is the source of truth; integration tests assert clients use these paths.
 */
export const FRONTEND_API_CONTRACT = {
  health: { method: "GET", path: "/v1/health" },
  auth: {
    sendOtp: { method: "POST", path: "/v1/auth/otp/whatsapp/send" },
    verifyOtp: { method: "POST", path: "/v1/auth/otp/whatsapp/verify" },
    register: { method: "POST", path: "/v1/auth/register" },
    refresh: { method: "POST", path: "/v1/auth/refresh" },
    logout: { method: "POST", path: "/v1/auth/logout" },
    /** Outdated — do not call from web clients. */
    outdatedRequestCode: {
      method: "POST",
      path: "/v1/auth/whatsapp/request-code",
    },
    outdatedVerifyCode: {
      method: "POST",
      path: "/v1/auth/whatsapp/verify-code",
    },
  },
  profile: {
    me: { method: "GET", path: "/v1/profile/me" },
    patchMe: { method: "PATCH", path: "/v1/profile/me" },
    onboarding: { method: "POST", path: "/v1/profile/onboarding" },
    deleteGroup: { method: "DELETE", path: "/v1/profile/me/groups" },
    photo: { method: "POST", path: "/v1/photo" },
    deletePhoto: { method: "DELETE", path: "/v1/photo" },
  },
  contacts: {
    list: { method: "GET", pathPrefix: "/v1/contacts?" },
    detail: { method: "GET", pathPrefix: "/v1/contacts/" },
    patch: { method: "PATCH", pathPrefix: "/v1/contacts/" },
    importSummary: { method: "GET", path: "/v1/contacts/import/summary" },
    sync: { method: "GET", pathPrefix: "/v1/contacts/sync?source=" },
    importGoogle: { method: "GET", path: "/v1/contacts/import/google" },
    importIcloud: { method: "POST", path: "/v1/contacts/import/icloud" },
    tags: { method: "GET", path: "/v1/contacts/tags" },
    groups: { method: "GET", path: "/v1/contacts/groups" },
  },
  integrations: {
    googleDisconnect: {
      method: "DELETE",
      path: "/v1/integrations/google/disconnect",
    },
  },
  cards: {
    list: { method: "GET", path: "/v1/cards" },
    create: { method: "POST", path: "/v1/cards" },
    detail: { method: "GET", pathPrefix: "/v1/cards/" },
    fieldMappings: { methodSuffix: "/field-mappings" },
    vcard: { method: "POST", pathSuffix: "/vcard" },
  },
  connections: {
    list: { method: "GET", path: "/v1/connections" },
    request: { method: "POST", path: "/v1/connections/requests" },
    resend: {
      method: "POST",
      pathPrefix: "/v1/connections/requests/",
      pathSuffix: "/resend",
    },
  },
} as const;

export function allContractPaths(): string[] {
  return [
    FRONTEND_API_CONTRACT.health.path,
    FRONTEND_API_CONTRACT.auth.sendOtp.path,
    FRONTEND_API_CONTRACT.auth.verifyOtp.path,
    FRONTEND_API_CONTRACT.auth.register.path,
    FRONTEND_API_CONTRACT.auth.refresh.path,
    FRONTEND_API_CONTRACT.auth.logout.path,
    FRONTEND_API_CONTRACT.profile.me.path,
    FRONTEND_API_CONTRACT.profile.onboarding.path,
    FRONTEND_API_CONTRACT.profile.deleteGroup.path,
    FRONTEND_API_CONTRACT.profile.photo.path,
    FRONTEND_API_CONTRACT.contacts.importSummary.path,
    FRONTEND_API_CONTRACT.contacts.importGoogle.path,
    FRONTEND_API_CONTRACT.contacts.importIcloud.path,
    FRONTEND_API_CONTRACT.contacts.tags.path,
    FRONTEND_API_CONTRACT.contacts.groups.path,
    FRONTEND_API_CONTRACT.integrations.googleDisconnect.path,
    FRONTEND_API_CONTRACT.cards.list.path,
    FRONTEND_API_CONTRACT.connections.list.path,
    FRONTEND_API_CONTRACT.connections.request.path,
  ];
}
