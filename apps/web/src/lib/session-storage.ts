export const GOOGLE_OAUTH_PENDING_KEY = "contactbook:google-oauth-pending";
export const GOOGLE_CONNECTED_KEY = "contactbook:google-connected";
export const GOOGLE_IMPORT_NEXT_KEY = "contactbook:google-import-next";
export const IMPORT_ONBOARDING_GOOGLE_DONE_KEY =
  "contactbook:import-onboarding-google-done";
export const IMPORT_ONBOARDING_VCF_DONE_KEY =
  "contactbook:import-onboarding-vcf-done";

import { clearAllCardFieldSelections } from "@/lib/card-field-selection";
import { clearAllCardTourSeen } from "@/lib/product-tour";

export function clearContactBookSessionState() {
  sessionStorage.removeItem(GOOGLE_OAUTH_PENDING_KEY);
  sessionStorage.removeItem(GOOGLE_IMPORT_NEXT_KEY);
  sessionStorage.removeItem(IMPORT_ONBOARDING_GOOGLE_DONE_KEY);
  sessionStorage.removeItem(IMPORT_ONBOARDING_VCF_DONE_KEY);
  localStorage.removeItem(GOOGLE_CONNECTED_KEY);
  // Both are user-scoped, but the next account to sign in on this browser must
  // not inherit another user's card selections or a suppressed tour.
  clearAllCardFieldSelections();
  clearAllCardTourSeen();
  // Dynamic import avoided — keep sync clear for logout paths.
  try {
    sessionStorage.removeItem("cb_client_access_token");
    sessionStorage.removeItem("cb_client_refresh_token");
  } catch {
    // ignore
  }
}
