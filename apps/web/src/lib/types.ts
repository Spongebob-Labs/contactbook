/** Twilio OTP verify (`POST /auth/otp/whatsapp/verify`). */
export type VerifyCodeResponse =
  | {
      verified?: true;
      registered: true;
      isOnboarded?: boolean;
      userId?: string;
      accessToken?: string;
      refreshToken?: string;
    }
  | {
      verified?: true;
      registered: false;
      message?: string;
      /**
       * Required for POST /auth/register. Issued by OTP verify for
       * unregistered phones.
       */
      phoneVerificationToken?: string;
    };

export type SendOtpResponse = {
  message: string;
  expiresInSeconds?: number;
  resendAfterSeconds?: number;
};

export type ContactSource =
  | "GOOGLE"
  | "ICLOUD"
  | "VCARD"
  | "CONTACTBOOK";

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

export type ContactCardType = "BUSINESS" | "PERSONAL" | "CUSTOM";

/**
 * A shareable card. The server owns everything here: a card is a name, a type,
 * and the set of profile fields mapped onto it. There is no client-side styling
 * — what a recipient sees is the WhatsApp template message plus the generated
 * vCard, both produced server-side.
 */
export type ContactCard = {
  id: string;
  userId: string;
  name: string;
  type: ContactCardType;
  isSensitive: boolean;
  createdAt: string;
  updatedAt: string;
  /**
   * Profile field UUIDs mapped to this card. They decide what lands in the
   * vCard. The API exposes no labels for them, so surface the count, never the
   * ids themselves.
   */
  mappedFieldIds?: string[];
};

export type ContactImportSummary = {
  totalActive: number;
  totalDeleted: number;
  bySource: Array<{
    source: ContactSource;
    activeCount: number;
    deletedCount: number;
    lastSync?: {
      at?: string | null;
      hasSyncToken?: boolean;
      runStats?: {
        added: number;
        updated: number;
        deleted: number;
        duplicatesFound: number;
      };
    };
    /** @deprecated use lastSync.at */
    lastSyncAt?: string | null;
    /** @deprecated use lastSync.hasSyncToken */
    hasSyncToken?: boolean;
  }>;
};

export type ContactLabel = {
  id: string;
  name: string;
};

export type ContactGroup = ContactLabel & {
  source?: ContactSource | null;
  externalId?: string | null;
};

export type ContactProviderLink = {
  source: ContactSource;
  externalId: string;
  sourceRevision?: string | null;
  isPrimary: boolean;
  firstLinkedAt: string;
  lastUpdatedAt: string;
};

export type ContactImport = {
  id: string;
  source: ContactSource;
  externalId: string;
  mergeGroupId?: string | null;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  primaryPhone?: ContactPhone | null;
  primaryEmail?: ContactEmail | null;
  tags: ContactLabel[];
  groups: ContactGroup[];
  providerLinks?: ContactProviderLink[];
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

export type ContactListResponse = {
  items: ContactDetail[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type GoogleSyncResponse = {
  syncMode: "full" | "delta";
  processedCount: number;
  totalContacts: number;
  lastSyncAt: string | null;
};

export type ContactImportResult = ContactImportSummary & {
  completedAt?: string;
  created?: number;
  updated?: number;
  /** New API import counters */
  imported?: number;
  merged?: number;
  skipped?: Array<{ reason: string; externalId?: string }>;
  importedCount?: number;
  processedCount?: number;
  createdCount?: number;
  updatedCount?: number;
  skippedCount?: number;
  totalContacts?: number;
  lastSyncAt?: string | null;
  message?: string;
  summary?: ContactImportSummary;
};

export type PostalAddress = {
  street: string;
  city: string;
  state?: string | null;
  pincode?: string | null;
  country: string;
};

export type ProfileMeResponse = {
  profileOnboardingCompletedAt?: string | null;
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
    /** Stored as a URL field and shared in the vCard. */
    website?: string | null;
    workPostalAddress?: PostalAddress;
    employeeId?: string | null;
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
    /** Stored as a URL field and shared in the vCard. */
    website?: string | null;
    businessPostalAddress?: PostalAddress;
    businessType?: string | null;
    gstin?: string | null;
    custom?: Record<string, string>;
  }>;
  socials: Array<{
    groupId: string;
    tag: string;
    skype?: string | null;
    facebook?: string | null;
    twitter?: string | null;
    whatsApp?: string | null;
    blog?: string | null;
    website?: string | null;
    linkedin?: string | null;
    github?: string | null;
    custom?: Record<string, string>;
  }>;
  financial: {
    bankAccounts: Array<{
      groupId: string;
      fieldId?: string;
      tag: string;
      bankName?: string | null;
      accountHolder?: string | null;
      accountNumber?: string | null;
      iban?: string | null;
      swiftBic?: string | null;
      routingNumber?: string | null;
      ifsc?: string | null;
      currency: string;
      isSensitive: boolean;
    }>;
    digitalWallets: Array<{
      groupId: string;
      fieldId?: string;
      tag: string;
      platform: string;
      handleOrLink: string;
      isSensitive: boolean;
    }>;
    cryptoWallets: Array<{
      groupId: string;
      fieldId?: string;
      tag: string;
      network: string;
      address: string;
      isSensitive: boolean;
    }>;
  };
};

/** A WhatsApp template as shown in the share picker (mirrors Twilio content exactly). */
export type ShareTemplate = {
  key: string;
  locale: string;
  /** Body with WhatsApp variables: {{1}} sender name, {{2}} card name, {{3}} note. */
  body: string;
  buttonTitle: string;
  headerImageUrl: string | null;
  syncedAt: string | null;
};

export type ShareRecipientInput = {
  countryCode: string;
  phone: string;
  contactId?: string;
};

export type ShareBatchRecipient = {
  id: string;
  countryCode: string;
  phone: string;
  contactId: string | null;
  dispatchStatus: "PENDING" | "RETRYING" | "DISPATCHED" | "FAILED";
  deliveryStatus: "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED" | null;
  lastDispatchError: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  createdAt: string;
};

export type ShareBatch = {
  id: string;
  cardId: string | null;
  cardName: string;
  cardType: ContactCardType;
  note: string | null;
  createdAt: string;
  recipients: ShareBatchRecipient[];
};
