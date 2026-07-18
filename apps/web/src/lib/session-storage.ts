export const GOOGLE_OAUTH_PENDING_KEY = "contactbook:google-oauth-pending";
export const GOOGLE_CONNECTED_KEY = "contactbook:google-connected";
export const GOOGLE_IMPORT_NEXT_KEY = "contactbook:google-import-next";
export const IMPORT_ONBOARDING_GOOGLE_DONE_KEY =
  "contactbook:import-onboarding-google-done";
export const IMPORT_ONBOARDING_VCF_DONE_KEY =
  "contactbook:import-onboarding-vcf-done";

export function clearContactBookSessionState() {
  sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);
  sessionStorage.removeItem(GOOGLE_IMPORT_NEXT_KEY);
  sessionStorage.removeItem(IMPORT_ONBOARDING_GOOGLE_DONE_KEY);
  sessionStorage.removeItem(IMPORT_ONBOARDING_VCF_DONE_KEY);
  localStorage.removeItem(GOOGLE_CONNECTED_KEY);
}
