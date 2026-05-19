export type VerifyCodeResponse =
  | { registered: true }
  | {
      registered: false;
      message: string;
      phoneVerificationToken: string;
    };

export type ContactImport = {
  id: string;
  source: "GOOGLE" | "ICLOUD" | "CSV";
  status?: "PENDING" | "PROCESSED" | "FAILED" | "IGNORED";
  displayNameSnapshot: string | null;
  rawPerson: unknown;
  lastSyncedAt: string | null;
  processedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GoogleSyncResponse = {
  imported: number;
};

export type PostalAddress = {
  street: string;
  city: string;
  state?: string | null;
  pincode?: string | null;
  country: string;
};

export type ProfileMeResponse = {
  identity: {
    firstName: string;
    lastName: string;
    primaryPhone: string;
    primaryEmail: string;
    profilePhoto?: string | null;
  };
  personal: {
    groupId: string;
    tag: string;
    postalAddress?: PostalAddress;
    custom?: Record<string, string>;
  };
  work: Array<{
    groupId: string;
    tag: string;
    companyName?: string | null;
    companyLogo?: string | null;
    workTitle?: string | null;
    workPostalAddress?: PostalAddress;
    custom?: Record<string, string>;
  }>;
  business: Array<{
    groupId: string;
    tag: string;
    businessName?: string | null;
    businessLogo?: string | null;
    businessTitle?: string | null;
    businessPostalAddress?: PostalAddress;
    custom?: Record<string, string>;
  }>;
  socials: Array<{
    groupId: string;
    tag: string;
    custom?: Record<string, string>;
  }>;
  financial: {
    bankAccounts: Array<{
      groupId: string;
      tag: string;
      bankName: string;
      accountHolder: string;
      accountNumber: string;
      ifsc?: string | null;
      currency: string;
      isSensitive: boolean;
    }>;
    digitalWallets: Array<{
      groupId: string;
      tag: string;
      platform: string;
      handleOrLink: string;
      isSensitive: boolean;
    }>;
    cryptoWallets: Array<{
      groupId: string;
      tag: string;
      network: string;
      address: string;
      isSensitive: boolean;
    }>;
  };
};
