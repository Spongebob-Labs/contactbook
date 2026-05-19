export type VerifyCodeResponse =
  | { registered: true }
  | {
      registered: false;
      message: string;
      phoneVerificationToken: string;
    };

export type ContactSource = "GOOGLE" | "ICLOUD" | "CSV" | "MANUAL";

export type ContactPhone = {
  value: string;
  label?: string | null;
  isPrimary: boolean;
};

export type ContactEmail = {
  value: string;
  label?: string | null;
  isPrimary: boolean;
};

export type ContactOrganization = {
  companyName?: string | null;
  department?: string | null;
  title?: string | null;
  isPrimary: boolean;
};

export type ContactAddress = {
  street?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  label?: string | null;
  isPrimary: boolean;
};

export type ContactUrl = {
  value: string;
  label?: string | null;
};

export type ContactCardType = "BUSINESS" | "PERSONAL" | "PAYMENT" | "CUSTOM";

export type ContactCard = {
  id: string;
  userId: string;
  name: string;
  type: ContactCardType;
  createdAt: string;
  updatedAt: string;
};

export type ContactImportSummary = {
  totalActive: number;
  totalDeleted: number;
  bySource: Array<{
    source: ContactSource;
    activeCount: number;
    deletedCount: number;
    lastSyncAt?: string | null;
    hasSyncToken?: boolean;
  }>;
};

export type ContactImport = {
  id: string;
  source: ContactSource;
  externalId: string;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  primaryPhone?: ContactPhone | null;
  primaryEmail?: ContactEmail | null;
  createdAt: string;
  updatedAt: string;
};

export type ContactDetail = ContactImport & {
  sourceRevision?: string | null;
  middleName?: string | null;
  nickname?: string | null;
  notes?: string | null;
  phones: ContactPhone[];
  emails: ContactEmail[];
  organizations: ContactOrganization[];
  addresses: ContactAddress[];
  urls: ContactUrl[];
  deletedAt?: string | null;
};

export type GoogleSyncResponse = {
  syncMode: "full" | "delta";
  processedCount: number;
  totalContacts: number;
  lastSyncAt: string | null;
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
    mobile?: string | null;
    landline?: string | null;
    email?: string | null;
    dateOfBirth?: string | null;
    yearOfBirth?: string | null;
    currentLocation?: string | null;
    relationshipStatus?: string | null;
    custom?: Record<string, string>;
  };
  work: Array<{
    groupId: string;
    tag: string;
    companyName?: string | null;
    companyLogo?: string | null;
    companyRegNumber?: string | null;
    workTitle?: string | null;
    workMobile?: string | null;
    workLandline?: string | null;
    workFax?: string | null;
    workEmail?: string | null;
    workPostalAddress?: PostalAddress;
    custom?: Record<string, string>;
  }>;
  business: Array<{
    groupId: string;
    tag: string;
    businessName?: string | null;
    businessLogo?: string | null;
    businessRegNumber?: string | null;
    businessTitle?: string | null;
    businessMobile?: string | null;
    businessLandline?: string | null;
    businessFax?: string | null;
    businessEmail?: string | null;
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
