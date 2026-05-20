import { registrationIdentity } from "./profile-payloads";
import type { ProfileMeResponse } from "../../src/profile/profile-me.types";

export const emptyProfileMeResponse: ProfileMeResponse = {
  profileOnboardingCompletedAt: null,
  identity: registrationIdentity,
  personal: { groupId: "", tag: "" },
  work: [],
  business: [],
  socials: [],
  financial: {
    bankAccounts: [],
    digitalWallets: [],
    cryptoWallets: [],
  },
};
