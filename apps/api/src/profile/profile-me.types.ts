/** GET /v1/profile/me — stable JSON contract for clients. */

export type PostalAddress = {
  street: string;
  city: string;
  state: string | null;
  pincode: string | null;
  country: string;
};

export type ProfileMeIdentity = {
  firstName: string;
  lastName: string;
  primaryPhone: string;
  primaryEmail: string;
  profilePhoto?: string | null;
};

export type ProfileMePersonal = {
  groupId: string;
  tag: string;
} & Record<string, unknown>;

export type ProfileMeWorkItem = {
  groupId: string;
  tag: string;
} & Record<string, unknown>;

export type ProfileMeBusinessItem = {
  groupId: string;
  tag: string;
} & Record<string, unknown>;

/** Social row: fixed keys (e.g. skype) plus optional `custom` for unmapped labels. */
export type ProfileMeSocialItem = {
  groupId: string;
  tag: string;
  custom?: Record<string, string>;
} & Record<string, unknown>;

export type ProfileMeBankRow = {
  groupId: string;
  fieldId?: string;
  tag: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  iban?: string | null;
  swiftBic?: string | null;
  routingNumber?: string | null;
  ifsc?: string | null;
  currency: string;
  isSensitive: boolean;
};

export type ProfileMeWalletRow = {
  groupId: string;
  fieldId?: string;
  tag: string;
  platform: string;
  handleOrLink: string;
  isSensitive: boolean;
};

export type ProfileMeCryptoRow = {
  groupId: string;
  fieldId?: string;
  tag: string;
  network: string;
  address: string;
  isSensitive: boolean;
};

export type ProfileMeFinancial = {
  bankAccounts: ProfileMeBankRow[];
  digitalWallets: ProfileMeWalletRow[];
  cryptoWallets: ProfileMeCryptoRow[];
};

export type ProfileMeResponse = {
  profileOnboardingCompletedAt: string | null;
  identity: ProfileMeIdentity;
  personal: ProfileMePersonal;
  work: ProfileMeWorkItem[];
  business: ProfileMeBusinessItem[];
  socials: ProfileMeSocialItem[];
  financial: ProfileMeFinancial;
};
