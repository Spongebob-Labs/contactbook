import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { ApiError, apiFetch } from "@/lib/api";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import type { PostalAddress, ProfileMeResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

type AddressForm = {
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
};

type BankForm = {
  groupId?: string;
  fieldId?: string;
  tag: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  iban: string;
  swiftBic: string;
  routingNumber: string;
  ifsc: string;
  currency: string;
};

type WalletForm = {
  groupId?: string;
  fieldId?: string;
  tag: string;
  platform: string;
  handleOrLink: string;
};

type CryptoForm = {
  groupId?: string;
  fieldId?: string;
  tag: string;
  network: string;
  address: string;
};

type WorkForm = {
  groupId?: string;
  tag: string;
  companyName: string;
  companyLogo: string;
  companyRegNumber: string;
  workTitle: string;
  workMobile: string;
  workLandline: string;
  workFax: string;
  workEmail: string;
  workPostalAddress: AddressForm;
  employeeId: string;
};

type BusinessForm = {
  groupId?: string;
  tag: string;
  businessName: string;
  businessLogo: string;
  businessRegNumber: string;
  businessTitle: string;
  businessMobile: string;
  businessLandline: string;
  businessFax: string;
  businessEmail: string;
  businessDescription: string;
  businessPostalAddress: AddressForm;
  businessType: string;
  gstin: string;
};

type SocialsForm = {
  groupId?: string;
  tag: string;
  skype: string;
  facebook: string;
  instagram: string;
  twitter: string;
  whatsapp: string;
  blog: string;
  website: string;
  linkedin: string;
  github: string;
};

type OnboardingForm = {
  identity: {
    firstName: string;
    lastName: string;
    primaryEmail: string;
    primaryPhone: string;
    profilePhoto: string;
  };
  personal: {
    groupId?: string;
    tag: string;
    title: string;
    nickname: string;
    mobile: string;
    landline: string;
    email: string;
    postalAddress: AddressForm;
    dateOfBirth: string;
    yearOfBirth: string;
    currentLocation: string;
    kidsNames: string;
    partnerName: string;
    petNames: string;
    relationshipStatus: string;
    bloodGroup: string;
  };
  work: WorkForm[];
  business: BusinessForm[];
  socials: SocialsForm[];
  financial: {
    bankAccounts: BankForm[];
    digitalWallets: WalletForm[];
    cryptoWallets: CryptoForm[];
  };
};

type ValidationErrors = Record<string, string>;

type LogoBucket = "work" | "business";

type LogoMutationState = {
  work: Record<number, string>;
  business: Record<number, string>;
};

type NullableAddressPayload = {
  street: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
};

type NullableCustomPayload = Record<string, string | null | undefined>;

type FullProfilePayload = {
  identity: {
    firstName: string;
    lastName: string;
    primaryPhone: string;
    primaryEmail: string;
    profilePhoto?: string | null;
  };
  personal: {
    groupId: string | undefined;
    tag: string | null | undefined;
    postalAddress: NullableAddressPayload;
    mobile: string | null | undefined;
    landline: string | null | undefined;
    email: string | null | undefined;
    dateOfBirth: string | null | undefined;
    currentLocation: string | null | undefined;
    relationshipStatus: string | null | undefined;
    custom: NullableCustomPayload;
  };
  work: Array<{
    groupId: string | undefined;
    tag: string | null;
    custom: NullableCustomPayload;
  }>;
  business: Array<{
    groupId: string | undefined;
    tag: string | null;
    custom: NullableCustomPayload;
  }>;
  socials: Array<{
    groupId: string | undefined;
    tag: string | null;
    custom: NullableCustomPayload;
  }>;
  financial: {
    bankAccounts: Array<{
      groupId: string | undefined;
      fieldId: string | undefined;
      tag: string | null;
      bankName: string | null;
      accountHolder: string | null;
      accountNumber: string | null;
      iban: string | null;
      swiftBic: string | null;
      routingNumber: string | null;
      ifsc: string | null;
      currency: string | null;
    }>;
    digitalWallets: Array<{
      groupId: string | undefined;
      fieldId: string | undefined;
      tag: string | null;
      platform: string | null;
      handleOrLink: string | null;
    }>;
    cryptoWallets: Array<{
      groupId: string | undefined;
      fieldId: string | undefined;
      tag: string | null;
      network: string | null;
      address: string | null;
    }>;
  };
};

const emptyAddress: AddressForm = {
  street: "",
  city: "",
  state: "",
  pincode: "",
  country: "",
};

const emptyWork = (): WorkForm => ({
  tag: "Current Work",
  companyName: "",
  companyLogo: "",
  companyRegNumber: "",
  workTitle: "",
  workMobile: "",
  workLandline: "",
  workFax: "",
  workEmail: "",
  workPostalAddress: { ...emptyAddress },
  employeeId: "",
});

const emptyBusiness = (): BusinessForm => ({
  tag: "Primary Business",
  businessName: "",
  businessLogo: "",
  businessRegNumber: "",
  businessTitle: "",
  businessMobile: "",
  businessLandline: "",
  businessFax: "",
  businessEmail: "",
  businessDescription: "",
  businessPostalAddress: { ...emptyAddress },
  businessType: "",
  gstin: "",
});

const emptySocials = (): SocialsForm => ({
  tag: "Main Digital Presence",
  skype: "",
  facebook: "",
  instagram: "",
  twitter: "",
  whatsapp: "",
  blog: "",
  website: "",
  linkedin: "",
  github: "",
});

const emptyBank = (): BankForm => ({
  tag: "Bank account",
  bankName: "",
  accountHolder: "",
  accountNumber: "",
  iban: "",
  swiftBic: "",
  routingNumber: "",
  ifsc: "",
  currency: "INR",
});

const emptyWallet = (): WalletForm => ({
  tag: "Digital wallet",
  platform: "",
  handleOrLink: "",
});

const emptyCrypto = (): CryptoForm => ({
  tag: "Crypto wallet",
  network: "",
  address: "",
});

const initialForm: OnboardingForm = {
  identity: {
    firstName: "",
    lastName: "",
    primaryEmail: "",
    primaryPhone: "",
    profilePhoto: "",
  },
  personal: {
    groupId: undefined,
    tag: "Primary Personal Details",
    title: "",
    nickname: "",
    mobile: "",
    landline: "",
    email: "",
    postalAddress: { ...emptyAddress },
    dateOfBirth: "",
    yearOfBirth: "",
    currentLocation: "",
    kidsNames: "",
    partnerName: "",
    petNames: "",
    relationshipStatus: "",
    bloodGroup: "",
  },
  work: [emptyWork()],
  business: [emptyBusiness()],
  socials: [emptySocials()],
  financial: {
    bankAccounts: [emptyBank()],
    digitalWallets: [emptyWallet()],
    cryptoWallets: [emptyCrypto()],
  },
};

const steps = [
  {
    key: "personal",
    title: "Personal",
    description: "Capture the personal details you may choose to share.",
  },
  {
    key: "work",
    title: "Work",
    description: "Add your current professional profile.",
  },
  {
    key: "business",
    title: "Business",
    description: "Show business ownership or public company details.",
  },
] as const;

function clean(value: string): string {
  return value.trim();
}

function hasText(value: string): boolean {
  return clean(value).length > 0;
}

function hasAnyText(values: Array<string | null | undefined>): boolean {
  return values.some((value) => hasText(value ?? ""));
}

function deriveYearOfBirth(dateOfBirth: string | null | undefined): string {
  const match = /^(\d{4})-\d{2}-\d{2}/.exec(clean(dateOfBirth ?? ""));
  return match?.[1] ?? "";
}

function hasAddressText(address: AddressForm): boolean {
  return hasAnyText([
    address.street,
    address.city,
    address.state,
    address.pincode,
    address.country,
  ]);
}

function hasPersonalDetails(personal: OnboardingForm["personal"]): boolean {
  return (
    hasAnyText([
      personal.title,
      personal.nickname,
      personal.mobile,
      personal.landline,
      personal.email,
      personal.dateOfBirth,
      personal.currentLocation,
      personal.kidsNames,
      personal.partnerName,
      personal.petNames,
      personal.relationshipStatus,
      personal.bloodGroup,
    ]) || hasAddressText(personal.postalAddress)
  );
}

function hasWorkDetails(row: WorkForm): boolean {
  return (
    hasAnyText([
      row.companyName,
      row.companyLogo,
      row.companyRegNumber,
      row.workTitle,
      row.workMobile,
      row.workLandline,
      row.workFax,
      row.workEmail,
      row.employeeId,
    ]) || hasAddressText(row.workPostalAddress)
  );
}

function hasBusinessDetails(row: BusinessForm): boolean {
  return (
    hasAnyText([
      row.businessName,
      row.businessLogo,
      row.businessRegNumber,
      row.businessTitle,
      row.businessMobile,
      row.businessLandline,
      row.businessFax,
      row.businessEmail,
      row.businessDescription,
      row.businessType,
      row.gstin,
    ]) || hasAddressText(row.businessPostalAddress)
  );
}

function hasSocialDetails(row: SocialsForm): boolean {
  return hasAnyText([
    row.skype,
    row.facebook,
    row.instagram,
    row.twitter,
    row.whatsapp,
    row.blog,
    row.website,
    row.linkedin,
    row.github,
  ]);
}

function hasBankDetails(row: BankForm): boolean {
  return hasAnyText([
    row.bankName,
    row.accountHolder,
    row.accountNumber,
    row.iban,
    row.swiftBic,
    row.routingNumber,
    row.ifsc,
  ]);
}

function hasWalletDetails(row: WalletForm): boolean {
  return hasAnyText([row.platform, row.handleOrLink]);
}

function hasCryptoDetails(row: CryptoForm): boolean {
  return hasAnyText([row.network, row.address]);
}

function toNullableAddressPayload(address: AddressForm): NullableAddressPayload {
  return {
    street: nullableText(address.street),
    city: nullableText(address.city),
    state: nullableText(address.state),
    pincode: nullableText(address.pincode),
    country: nullableText(address.country),
  };
}

function nullableText(value: string | null | undefined): string | null {
  const next = clean(value ?? "");
  return next || null;
}

function profilePhotoForSave(value: string | null | undefined): string | null | undefined {
  const next = optionalText(value);
  if (!next) {
    return null;
  }
  if (next.startsWith("data:")) {
    return undefined;
  }
  return next;
}

function optionalText(value: string | null | undefined): string | undefined {
  const next = clean(value ?? "");
  return next || undefined;
}

function nullableTextForSave(
  value: string | null | undefined,
  keepEmptyAsNull: boolean,
): string | null | undefined {
  const next = clean(value ?? "");
  if (next) {
    return next;
  }
  return keepEmptyAsNull ? null : undefined;
}

function nullableCustom(values: Record<string, string>): NullableCustomPayload {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, nullableText(value)]),
  );
}

function nullableCustomForSave(
  values: Record<string, string>,
  keepEmptyAsNull: boolean,
): NullableCustomPayload {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      nullableTextForSave(value, keepEmptyAsNull),
    ]),
  );
}

function nullableAddressCustom(
  prefix: string,
  address: AddressForm,
): NullableCustomPayload {
  return nullableCustom({
    [`${prefix}Street`]: address.street,
    [`${prefix}City`]: address.city,
    [`${prefix}State`]: address.state,
    [`${prefix}Pincode`]: address.pincode,
    [`${prefix}Country`]: address.country,
  });
}

function nullableAddressCustomForSave(
  prefix: string,
  address: AddressForm,
  keepEmptyAsNull: boolean,
): NullableCustomPayload {
  return nullableCustomForSave(
    {
      [`${prefix}Street`]: address.street,
      [`${prefix}City`]: address.city,
      [`${prefix}State`]: address.state,
      [`${prefix}Pincode`]: address.pincode,
      [`${prefix}Country`]: address.country,
    },
    keepEmptyAsNull,
  );
}

function valueOrEmpty(value: string | null | undefined): string {
  return value ?? "";
}

function readString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return typeof value === "string" ? value : String(value);
}

function objectValue(source: unknown, key: string): string {
  if (!source || typeof source !== "object") {
    return "";
  }
  return readString((source as Record<string, unknown>)[key]);
}

function customFrom(source: unknown): Record<string, unknown> | undefined {
  if (!source || typeof source !== "object") {
    return undefined;
  }
  const custom = (source as Record<string, unknown>).custom;
  return custom && typeof custom === "object"
    ? (custom as Record<string, unknown>)
    : undefined;
}

function labelFromCamelKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function customValue(
  custom: Record<string, unknown> | undefined,
  ...keys: string[]
): string {
  const expandedKeys = keys.flatMap((key) => [key, labelFromCamelKey(key)]);
  for (const key of expandedKeys) {
    const value = readString(custom?.[key]);
    if (value) {
      return value;
    }
  }
  return "";
}

function profileFieldValue(
  source: unknown,
  key: string,
  ...customKeys: string[]
) {
  return (
    objectValue(source, key) || customValue(customFrom(source), key, ...customKeys)
  );
}

function addressToForm(address: PostalAddress | undefined): AddressForm {
  return {
    street: valueOrEmpty(address?.street),
    city: valueOrEmpty(address?.city),
    state: valueOrEmpty(address?.state),
    pincode: valueOrEmpty(address?.pincode),
    country: valueOrEmpty(address?.country),
  };
}

function addressToFormWithCustom(
  address: PostalAddress | undefined,
  custom: Record<string, unknown> | undefined,
  prefix: string,
): AddressForm {
  const formAddress = addressToForm(address);
  return {
    street: formAddress.street || customValue(custom, `${prefix}Street`),
    city: formAddress.city || customValue(custom, `${prefix}City`),
    state: formAddress.state || customValue(custom, `${prefix}State`),
    pincode: formAddress.pincode || customValue(custom, `${prefix}Pincode`),
    country: formAddress.country || customValue(custom, `${prefix}Country`),
  };
}

function ensureRows<T>(rows: T[], createEmpty: () => T): T[] {
  return rows.length > 0 ? rows : [createEmpty()];
}

function profileToForm(profile: ProfileMeResponse): OnboardingForm {
  const dateOfBirth = profileFieldValue(profile.personal, "dateOfBirth");

  return {
    identity: {
      firstName: valueOrEmpty(profile.identity.firstName),
      lastName: valueOrEmpty(profile.identity.lastName),
      primaryEmail: valueOrEmpty(profile.identity.primaryEmail),
      primaryPhone: valueOrEmpty(profile.identity.primaryPhone),
      profilePhoto: valueOrEmpty(profile.identity.profilePhoto),
    },
    personal: {
      ...initialForm.personal,
      groupId: profile.personal.groupId,
      tag: valueOrEmpty(profile.personal.tag) || initialForm.personal.tag,
      title: profileFieldValue(profile.personal, "title"),
      nickname: profileFieldValue(profile.personal, "nickname"),
      mobile: profileFieldValue(profile.personal, "mobile"),
      landline: profileFieldValue(profile.personal, "landline"),
      email: profileFieldValue(profile.personal, "email"),
      postalAddress: addressToFormWithCustom(
        profile.personal.postalAddress,
        customFrom(profile.personal),
        "postal",
      ),
      dateOfBirth,
      yearOfBirth:
        deriveYearOfBirth(dateOfBirth) ||
        profileFieldValue(profile.personal, "yearOfBirth"),
      currentLocation: profileFieldValue(profile.personal, "currentLocation"),
      kidsNames: profileFieldValue(profile.personal, "kidsNames"),
      partnerName: profileFieldValue(profile.personal, "partnerName"),
      petNames: profileFieldValue(profile.personal, "petNames"),
      relationshipStatus: profileFieldValue(
        profile.personal,
        "relationshipStatus",
      ),
      bloodGroup: profileFieldValue(profile.personal, "bloodGroup"),
    },
    work: ensureRows(
      profile.work.map((item) => ({
        ...emptyWork(),
        groupId: item.groupId,
        tag: valueOrEmpty(item.tag) || emptyWork().tag,
        companyName: profileFieldValue(item, "companyName"),
        companyLogo: profileFieldValue(item, "companyLogo"),
        companyRegNumber: profileFieldValue(item, "companyRegNumber"),
        workTitle: profileFieldValue(item, "workTitle"),
        workMobile: profileFieldValue(item, "workMobile"),
        workLandline: profileFieldValue(item, "workLandline"),
        workFax: profileFieldValue(item, "workFax"),
        workEmail: profileFieldValue(item, "workEmail"),
        workPostalAddress: addressToFormWithCustom(
          item.workPostalAddress,
          customFrom(item),
          "workPostal",
        ),
        employeeId: profileFieldValue(item, "employeeId"),
      })),
      emptyWork,
    ),
    business: ensureRows(
      profile.business.map((item) => ({
        ...emptyBusiness(),
        groupId: item.groupId,
        tag: valueOrEmpty(item.tag) || emptyBusiness().tag,
        businessName: profileFieldValue(item, "businessName"),
        businessLogo: profileFieldValue(item, "businessLogo"),
        businessRegNumber: profileFieldValue(item, "businessRegNumber"),
        businessTitle: profileFieldValue(item, "businessTitle"),
        businessMobile: profileFieldValue(item, "businessMobile"),
        businessLandline: profileFieldValue(item, "businessLandline"),
        businessFax: profileFieldValue(item, "businessFax"),
        businessEmail: profileFieldValue(item, "businessEmail"),
        businessDescription: profileFieldValue(
          item,
          "businessDescription",
          "description",
        ),
        businessPostalAddress: addressToFormWithCustom(
          item.businessPostalAddress,
          customFrom(item),
          "businessPostal",
        ),
        businessType: profileFieldValue(item, "businessType"),
        gstin: profileFieldValue(item, "gstin"),
      })),
      emptyBusiness,
    ),
    socials: ensureRows(
      profile.socials.map((item) => ({
        ...emptySocials(),
        groupId: item.groupId,
        tag: valueOrEmpty(item.tag) || emptySocials().tag,
        skype: profileFieldValue(item, "skype"),
        facebook: profileFieldValue(item, "facebook"),
        instagram: profileFieldValue(item, "instagram"),
        twitter: profileFieldValue(item, "twitter"),
        whatsapp: profileFieldValue(item, "whatsApp", "whatsapp"),
        blog: profileFieldValue(item, "blog"),
        website: profileFieldValue(item, "website"),
        linkedin: profileFieldValue(item, "linkedin"),
        github: profileFieldValue(item, "github"),
      })),
      emptySocials,
    ),
    financial: {
      bankAccounts: ensureRows(
        profile.financial.bankAccounts.map((item) => ({
          ...emptyBank(),
          groupId: item.groupId,
          fieldId: item.fieldId,
          tag: valueOrEmpty(item.tag) || emptyBank().tag,
          bankName: valueOrEmpty(item.bankName),
          accountHolder: valueOrEmpty(item.accountHolder),
          accountNumber: valueOrEmpty(item.accountNumber),
          iban: valueOrEmpty(item.iban),
          swiftBic: valueOrEmpty(item.swiftBic),
          routingNumber: valueOrEmpty(item.routingNumber),
          ifsc: valueOrEmpty(item.ifsc),
          currency: valueOrEmpty(item.currency) || emptyBank().currency,
        })),
        emptyBank,
      ),
      digitalWallets: ensureRows(
        profile.financial.digitalWallets.map((item) => ({
          ...emptyWallet(),
          groupId: item.groupId,
          fieldId: item.fieldId,
          tag: valueOrEmpty(item.tag) || emptyWallet().tag,
          platform: valueOrEmpty(item.platform),
          handleOrLink: valueOrEmpty(item.handleOrLink),
        })),
        emptyWallet,
      ),
      cryptoWallets: ensureRows(
        profile.financial.cryptoWallets.map((item) => ({
          ...emptyCrypto(),
          groupId: item.groupId,
          fieldId: item.fieldId,
          tag: valueOrEmpty(item.tag) || emptyCrypto().tag,
          network: valueOrEmpty(item.network),
          address: valueOrEmpty(item.address),
        })),
        emptyCrypto,
      ),
    },
  };
}

const MAX_PROFILE_PHOTO_BYTES = 1_048_576;
const ALLOWED_PROFILE_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_LOGO_IMAGE_BYTES = MAX_PROFILE_PHOTO_BYTES;
const ALLOWED_LOGO_IMAGE_TYPES = ALLOWED_PROFILE_PHOTO_TYPES;

type PhotoResponse = {
  url: string;
};

function isHttpUrl(value: string | null | undefined): value is string {
  const next = clean(value ?? "");
  if (!next) {
    return false;
  }
  try {
    const url = new URL(next);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function collectPhotoUrls(form: OnboardingForm): Set<string> {
  return new Set(
    [
      form.identity.profilePhoto,
      ...form.work.map((row) => row.companyLogo),
      ...form.business.map((row) => row.businessLogo),
    ].filter(isHttpUrl),
  );
}

function hasInitializedProfile(profile: ProfileMeResponse) {
  if (profile.profileOnboardingCompletedAt) {
    return true;
  }
  return Boolean(
    profile.personal.groupId ||
      profile.work.length > 0 ||
      profile.business.length > 0 ||
      profile.socials.length > 0,
  );
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function addRequired(
  errors: ValidationErrors,
  path: string,
  value: string,
  label: string,
) {
  if (!hasText(value)) {
    errors[path] = `${label} is required.`;
  }
}

function addMaxLength(
  errors: ValidationErrors,
  path: string,
  value: string | null | undefined,
  max: number,
  label: string,
) {
  if ((value ?? "").length > max) {
    errors[path] = `${label} must be ${max} characters or fewer.`;
  }
}

function addEmail(
  errors: ValidationErrors,
  path: string,
  value: string,
  label: string,
) {
  if (hasText(value) && !EMAIL_PATTERN.test(clean(value))) {
    errors[path] = `${label} must be a valid email address.`;
  }
}

function validateAddress(
  errors: ValidationErrors,
  prefix: string,
  address: AddressForm,
  label: string,
) {
  addMaxLength(errors, `${prefix}.street`, address.street, 500, `${label} street`);
  addMaxLength(errors, `${prefix}.city`, address.city, 200, `${label} city`);
  addMaxLength(errors, `${prefix}.state`, address.state, 120, `${label} state`);
  addMaxLength(
    errors,
    `${prefix}.pincode`,
    address.pincode,
    40,
    `${label} pincode`,
  );
  addMaxLength(errors, `${prefix}.country`, address.country, 120, `${label} country`);
}

function validateProfileForm(form: OnboardingForm): ValidationErrors {
  const errors: ValidationErrors = {};

  addRequired(errors, "identity.firstName", form.identity.firstName, "First name");
  addMaxLength(errors, "identity.firstName", form.identity.firstName, 120, "First name");
  addRequired(errors, "identity.lastName", form.identity.lastName, "Last name");
  addMaxLength(errors, "identity.lastName", form.identity.lastName, 120, "Last name");
  addRequired(errors, "identity.primaryEmail", form.identity.primaryEmail, "Email");
  addEmail(errors, "identity.primaryEmail", form.identity.primaryEmail, "Email");
  addMaxLength(errors, "identity.primaryEmail", form.identity.primaryEmail, 320, "Email");
  addRequired(
    errors,
    "identity.primaryPhone",
    form.identity.primaryPhone,
    "Phone number",
  );
  addMaxLength(
    errors,
    "identity.primaryPhone",
    form.identity.primaryPhone,
    32,
    "Phone number",
  );
  addMaxLength(errors, "personal.tag", form.personal.tag, 200, "Label");
  validateAddress(
    errors,
    "personal.postalAddress",
    form.personal.postalAddress,
    "Postal address",
  );

  form.work.forEach((row, index) => {
    addMaxLength(errors, `work.${index}.tag`, row.tag, 200, "Work label");
    addMaxLength(
      errors,
      `work.${index}.companyLogo`,
      row.companyLogo,
      500,
      "Company logo URL",
    );
  });

  form.business.forEach((row, index) => {
    addMaxLength(errors, `business.${index}.tag`, row.tag, 200, "Business label");
    addMaxLength(
      errors,
      `business.${index}.businessLogo`,
      row.businessLogo,
      500,
      "Business logo URL",
    );
  });

  form.socials.forEach((row, index) => {
    addMaxLength(errors, `socials.${index}.tag`, row.tag, 200, "Social label");
  });

  form.financial.bankAccounts.forEach((row, index) => {
    const prefix = `financial.bankAccounts.${index}`;
    addMaxLength(errors, `${prefix}.tag`, row.tag, 200, "Bank account label");
    addMaxLength(errors, `${prefix}.bankName`, row.bankName, 200, "Bank name");
    addMaxLength(
      errors,
      `${prefix}.accountHolder`,
      row.accountHolder,
      200,
      "Account holder",
    );
    addMaxLength(
      errors,
      `${prefix}.accountNumber`,
      row.accountNumber,
      64,
      "Account number",
    );
    addMaxLength(errors, `${prefix}.iban`, row.iban, 64, "IBAN");
    addMaxLength(errors, `${prefix}.swiftBic`, row.swiftBic, 32, "SWIFT/BIC");
    addMaxLength(
      errors,
      `${prefix}.routingNumber`,
      row.routingNumber,
      32,
      "Routing number",
    );
    addMaxLength(errors, `${prefix}.ifsc`, row.ifsc, 32, "IFSC");
    addMaxLength(errors, `${prefix}.currency`, row.currency, 8, "Currency");
  });

  form.financial.digitalWallets.forEach((row, index) => {
    const prefix = `financial.digitalWallets.${index}`;
    addMaxLength(errors, `${prefix}.tag`, row.tag, 200, "Digital wallet label");
    addMaxLength(errors, `${prefix}.platform`, row.platform, 120, "Platform");
    addMaxLength(
      errors,
      `${prefix}.handleOrLink`,
      row.handleOrLink,
      500,
      "Handle or link",
    );
  });

  form.financial.cryptoWallets.forEach((row, index) => {
    const prefix = `financial.cryptoWallets.${index}`;
    addMaxLength(errors, `${prefix}.tag`, row.tag, 200, "Crypto wallet label");
    addMaxLength(errors, `${prefix}.network`, row.network, 80, "Network");
    addMaxLength(errors, `${prefix}.address`, row.address, 500, "Address");
  });

  return errors;
}

export type ProfileOnboardingResult = {
  identity: FullProfilePayload["identity"];
};

type ProfileOnboardingModalProps = {
  onComplete: (result: ProfileOnboardingResult) => void | Promise<void>;
  onSkip: (result: ProfileOnboardingResult) => void | Promise<void>;
};

export function ProfileOnboardingModal({
  onComplete,
  onSkip,
}: ProfileOnboardingModalProps) {
  const { refreshUser } = useAuth();
  const [form, setForm] = useState<OnboardingForm>(initialForm);
  const [showAdditionalPersonalFields, setShowAdditionalPersonalFields] = useState(false);
  const [showAdditionalWorkFields, setShowAdditionalWorkFields] = useState(false);
  const [showAdditionalBusinessFields, setShowAdditionalBusinessFields] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(() => new Set());
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMutatingProfilePhoto, setIsMutatingProfilePhoto] = useState(false);
  const [logoMutations, setLogoMutations] = useState<LogoMutationState>({
    work: {},
    business: {},
  });
  const pendingPhotoDeletesRef = useRef<Set<string>>(new Set());
  const unsavedPhotoUploadsRef = useRef<Set<string>>(new Set());
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  const [loadedIdentity, setLoadedIdentity] = useState<
    OnboardingForm["identity"] | null
  >(null);
  const step = steps[stepIndex];
  const validationErrors = validateProfileForm(form);
  const validationErrorCount = Object.keys(validationErrors).length;
  const hasValidationErrors = validationErrorCount > 0;
  const isMutatingLogo =
    Object.keys(logoMutations.work).length > 0 ||
    Object.keys(logoMutations.business).length > 0;
  const controlsDisabled =
    isSaving ||
    isMutatingProfilePhoto ||
    isMutatingLogo ||
    isLoadingProfile ||
    Boolean(loadError);
  const saveDisabled = controlsDisabled || hasValidationErrors;

  const markTouched = (path: string) => {
    setTouchedFields((current) => {
      if (current.has(path)) {
        return current;
      }
      const next = new Set(current);
      next.add(path);
      return next;
    });
  };

  const visibleError = (path: string) =>
    showAllErrors || touchedFields.has(path) ? validationErrors[path] : undefined;

  const validationProps = (path: string) => ({
    onBlur: () => markTouched(path),
    "aria-invalid": Boolean(visibleError(path)),
  });

  const deletePhotoUrls = async (
    urls: string[],
    reason: string,
    showFailureToast = false,
  ) => {
    if (urls.length === 0) {
      return;
    }

    const results = await Promise.allSettled(
      urls.map((url) =>
        apiFetch<unknown>("/v1/photo", {
          method: "DELETE",
          body: { url },
        }),
      ),
    );

    const failedCount = results.filter((result) => result.status === "rejected").length;
    if (failedCount > 0) {
      logUiError(reason, results);
      if (showFailureToast) {
        toast.error("Profile saved, but we could not clean up every old image.");
      }
    }
  };

  const cleanupUnsavedPhotoUploads = async () => {
    const urls = [...unsavedPhotoUploadsRef.current];
    unsavedPhotoUploadsRef.current.clear();
    await deletePhotoUrls(urls, "Could not clean up unsaved image uploads");
  };

  const cleanupPhotosAfterSuccessfulSave = async (savedPhotoUrls: Set<string>) => {
    const staleUnsavedUrls = [...unsavedPhotoUploadsRef.current].filter(
      (url) => !savedPhotoUrls.has(url),
    );
    const pendingDeleteUrls = [...pendingPhotoDeletesRef.current].filter(
      (url) => !savedPhotoUrls.has(url),
    );
    const urlsToDelete = [...new Set([...pendingDeleteUrls, ...staleUnsavedUrls])];

    pendingPhotoDeletesRef.current.clear();
    staleUnsavedUrls.forEach((url) => unsavedPhotoUploadsRef.current.delete(url));
    savedPhotoUrls.forEach((url) => unsavedPhotoUploadsRef.current.delete(url));

    await deletePhotoUrls(
      urlsToDelete,
      "Could not clean up replaced or removed image uploads",
      true,
    );
  };

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      setIsLoadingProfile(true);
      setLoadError(null);
      try {
        const profile = await apiFetch<ProfileMeResponse>("/v1/profile/me");
        if (isMounted) {
          const nextForm = profileToForm(profile);
          setForm(nextForm);
          setLoadedIdentity(nextForm.identity);
          setHasExistingProfile(hasInitializedProfile(profile));
        }
      } catch (error) {
        if (isMounted) {
          logUiError("Could not load profile form", error);
          setLoadError(friendlyErrorMessages.load);
        }
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      void cleanupUnsavedPhotoUploads();
    };
  }, []);

  const setLogoMutation = (
    bucket: LogoBucket,
    index: number,
    message: string | null,
  ) => {
    setLogoMutations((current) => {
      const nextBucket = { ...current[bucket] };
      if (message) {
        nextBucket[index] = message;
      } else {
        delete nextBucket[index];
      }

      return { ...current, [bucket]: nextBucket };
    });
  };

  const removeLogoMutationRow = (bucket: LogoBucket, index: number) => {
    setLogoMutations((current) => {
      const nextBucket: Record<number, string> = {};

      Object.entries(current[bucket]).forEach(([key, value]) => {
        const currentIndex = Number(key);
        if (currentIndex === index) {
          return;
        }

        nextBucket[currentIndex > index ? currentIndex - 1 : currentIndex] = value;
      });

      return { ...current, [bucket]: nextBucket };
    });
  };

  const trackPhotoRemoval = (url: string | null | undefined) => {
    if (!isHttpUrl(url)) {
      return;
    }
    if (unsavedPhotoUploadsRef.current.has(url)) {
      return;
    }
    pendingPhotoDeletesRef.current.add(url);
  };

  const getLogoValue = (bucket: LogoBucket, index: number) => {
    return bucket === "work"
      ? form.work[index]?.companyLogo
      : form.business[index]?.businessLogo;
  };

  const selectLogoFile = async (
    bucket: LogoBucket,
    index: number,
    file: File | undefined,
  ) => {
    if (!file) {
      return;
    }

    if (!ALLOWED_LOGO_IMAGE_TYPES.has(file.type)) {
      toast.error("Choose a JPEG, PNG, or WebP logo.");
      return;
    }

    if (file.size > MAX_LOGO_IMAGE_BYTES) {
      toast.error("Choose a logo under 1 MB.");
      return;
    }

    markTouched(
      bucket === "work"
        ? `work.${index}.companyLogo`
        : `business.${index}.businessLogo`,
    );
    setLogoMutation(bucket, index, "Uploading logo...");
    try {
      const previousLogoUrl = getLogoValue(bucket, index);
      const body = new FormData();
      body.append("file", file);
      const response = await apiFetch<PhotoResponse>("/v1/photo", {
        method: "POST",
        body,
      });

      if (!isHttpUrl(response.url)) {
        throw new Error("Logo upload did not return a valid URL.");
      }

      trackPhotoRemoval(previousLogoUrl);
      unsavedPhotoUploadsRef.current.add(response.url);
      if (bucket === "work") {
        setWorkValue(index, "companyLogo", response.url);
      } else {
        setBusinessValue(index, "businessLogo", response.url);
      }
      toast.success(`${bucket === "work" ? "Company" : "Business"} logo uploaded.`);
    } catch (error) {
      logUiError("Could not upload logo", error);
      toast.error("We couldn't upload that logo. Please try again.");
    } finally {
      setLogoMutation(bucket, index, null);
    }
  };

  const clearLogoFile = (bucket: LogoBucket, index: number) => {
    trackPhotoRemoval(getLogoValue(bucket, index));
    if (bucket === "work") {
      setWorkValue(index, "companyLogo", "");
    } else {
      setBusinessValue(index, "businessLogo", "");
    }
  };

  const uploadProfilePhoto = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    markTouched("identity.profilePhoto");

    if (!ALLOWED_PROFILE_PHOTO_TYPES.has(file.type)) {
      toast.error("Choose a JPEG, PNG, or WebP image.");
      return;
    }

    if (file.size > MAX_PROFILE_PHOTO_BYTES) {
      toast.error("Choose an image under 1 MB.");
      return;
    }

    setIsMutatingProfilePhoto(true);
    try {
      const previousPhotoUrl = form.identity.profilePhoto;
      const body = new FormData();
      body.append("file", file);
      const response = await apiFetch<PhotoResponse>("/v1/photo", {
        method: "POST",
        body,
      });

      if (!isHttpUrl(response.url)) {
        throw new Error("Profile photo upload did not return a valid URL.");
      }

      trackPhotoRemoval(previousPhotoUrl);
      unsavedPhotoUploadsRef.current.add(response.url);
      setSectionValue("identity", "profilePhoto", response.url);
      toast.success("Profile photo uploaded. Save your profile to keep it.");
    } catch (error) {
      logUiError("Could not upload profile photo", error);
      toast.error("We couldn't update your profile photo. Please try again.");
    } finally {
      setIsMutatingProfilePhoto(false);
    }
  };

  const deleteProfilePhoto = async () => {
    markTouched("identity.profilePhoto");
    trackPhotoRemoval(form.identity.profilePhoto);
    setSectionValue("identity", "profilePhoto", "");
    toast.success("Profile photo removed. Save your profile to keep this change.");
  };

  const setSectionValue = <Section extends "identity" | "personal">(
    section: Section,
    key: keyof OnboardingForm[Section],
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [key]: value,
      },
    }));
  };

  const setDateOfBirth = (value: string) => {
    setForm((current) => ({
      ...current,
      personal: {
        ...current.personal,
        dateOfBirth: value,
        yearOfBirth: deriveYearOfBirth(value),
      },
    }));
  };

  const setAddressValue = (
    section: "personal",
    key: keyof AddressForm,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      personal:
        section === "personal"
          ? {
              ...current.personal,
              postalAddress: { ...current.personal.postalAddress, [key]: value },
            }
          : current.personal,
    }));
  };

  const setWorkValue = (index: number, key: keyof WorkForm, value: string) => {
    setForm((current) => ({
      ...current,
      work: current.work.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    }));
  };

  const setBusinessValue = (
    index: number,
    key: keyof BusinessForm,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      business: current.business.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    }));
  };

  const setSocialValue = (index: number, key: keyof SocialsForm, value: string) => {
    setForm((current) => ({
      ...current,
      socials: current.socials.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    }));
  };

  const setWorkAddressValue = (
    index: number,
    key: keyof AddressForm,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      work: current.work.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              workPostalAddress: { ...row.workPostalAddress, [key]: value },
            }
          : row,
      ),
    }));
  };

  const setBusinessAddressValue = (
    index: number,
    key: keyof AddressForm,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      business: current.business.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              businessPostalAddress: {
                ...row.businessPostalAddress,
                [key]: value,
              },
            }
          : row,
      ),
    }));
  };

  const addRow = <Bucket extends keyof OnboardingForm>(
    bucket: Bucket,
    createEmpty: () => OnboardingForm[Bucket] extends Array<infer Row> ? Row : never,
  ) => {
    setForm((current) => ({
      ...current,
      [bucket]: [...(current[bucket] as unknown[]), createEmpty()],
    }));
  };

  const removeRow = <Bucket extends keyof OnboardingForm>(
    bucket: Bucket,
    index: number,
    createEmpty: () => OnboardingForm[Bucket] extends Array<infer Row> ? Row : never,
  ) => {
    if (bucket === "work") {
      trackPhotoRemoval(form.work[index]?.companyLogo);
      removeLogoMutationRow(bucket, index);
    }
    if (bucket === "business") {
      trackPhotoRemoval(form.business[index]?.businessLogo);
      removeLogoMutationRow(bucket, index);
    }

    setForm((current) => {
      const rows = (current[bucket] as unknown[]).filter(
        (_, rowIndex) => rowIndex !== index,
      );
      return {
        ...current,
        [bucket]: rows.length > 0 ? rows : [createEmpty()],
      };
    });
  };

  const setFinancialRowValue = <
    Bucket extends keyof OnboardingForm["financial"],
  >(
    bucket: Bucket,
    index: number,
    key: keyof OnboardingForm["financial"][Bucket][number],
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      financial: {
        ...current.financial,
        [bucket]: current.financial[bucket].map((row, rowIndex) =>
          rowIndex === index ? { ...row, [key]: value } : row,
        ),
      },
    }));
  };

  const addFinancialRow = <Bucket extends keyof OnboardingForm["financial"]>(
    bucket: Bucket,
    createEmpty: () => OnboardingForm["financial"][Bucket][number],
  ) => {
    setForm((current) => ({
      ...current,
      financial: {
        ...current.financial,
        [bucket]: [...current.financial[bucket], createEmpty()],
      },
    }));
  };

  const removeFinancialRow = <Bucket extends keyof OnboardingForm["financial"]>(
    bucket: Bucket,
    index: number,
    createEmpty: () => OnboardingForm["financial"][Bucket][number],
  ) => {
    setForm((current) => {
      const rows = current.financial[bucket].filter(
        (_, rowIndex) => rowIndex !== index,
      );
      return {
        ...current,
        financial: {
          ...current.financial,
          [bucket]: rows.length > 0 ? rows : [createEmpty()],
        },
      };
    });
  };

  const validate = (): string | null => {
    if (hasValidationErrors) {
      setShowAllErrors(true);
      return `${validationErrorCount} ${
        validationErrorCount === 1 ? "field needs" : "fields need"
      } attention before saving.`;
    }

    return null;
  };

  const buildProfilePayload = (): FullProfilePayload => {
    const personalGroupId = optionalText(form.personal.groupId);
    const canClearPersonalFields = Boolean(personalGroupId);

    return {
      identity: {
        firstName: form.identity.firstName.trim(),
        lastName: form.identity.lastName.trim(),
        primaryPhone: form.identity.primaryPhone.trim(),
        primaryEmail: form.identity.primaryEmail.trim(),
        profilePhoto: profilePhotoForSave(form.identity.profilePhoto),
      },
      personal: {
        groupId: personalGroupId,
        tag: nullableTextForSave(form.personal.tag, canClearPersonalFields),
        postalAddress: toNullableAddressPayload(form.personal.postalAddress),
        mobile: nullableTextForSave(form.personal.mobile, canClearPersonalFields),
        landline: nullableTextForSave(
          form.personal.landline,
          canClearPersonalFields,
        ),
        email: nullableTextForSave(form.personal.email, canClearPersonalFields),
        dateOfBirth: nullableTextForSave(
          form.personal.dateOfBirth,
          canClearPersonalFields,
        ),
        currentLocation: nullableTextForSave(
          form.personal.currentLocation,
          canClearPersonalFields,
        ),
        relationshipStatus: nullableTextForSave(
          form.personal.relationshipStatus,
          canClearPersonalFields,
        ),
        custom: nullableCustomForSave(
          {
            title: form.personal.title,
            nickname: form.personal.nickname,
            kidsNames: form.personal.kidsNames,
            partnerName: form.personal.partnerName,
            petNames: form.personal.petNames,
            bloodGroup: form.personal.bloodGroup,
          },
          canClearPersonalFields,
        ),
      },
      work: form.work.map((row) => ({
        groupId: optionalText(row.groupId),
        tag: nullableText(row.tag),
        custom: {
          ...nullableCustom({
            companyName: row.companyName,
            companyLogo: row.companyLogo,
            companyRegNumber: row.companyRegNumber,
            workTitle: row.workTitle,
            workMobile: row.workMobile,
            workLandline: row.workLandline,
            workFax: row.workFax,
            workEmail: row.workEmail,
            employeeId: row.employeeId,
          }),
          ...nullableAddressCustom("workPostal", row.workPostalAddress),
        },
      })),
      business: form.business.map((row) => ({
        groupId: optionalText(row.groupId),
        tag: nullableText(row.tag),
        custom: {
          ...nullableCustom({
            businessName: row.businessName,
            businessLogo: row.businessLogo,
            businessRegNumber: row.businessRegNumber,
            businessTitle: row.businessTitle,
            businessMobile: row.businessMobile,
            businessLandline: row.businessLandline,
            businessFax: row.businessFax,
            businessEmail: row.businessEmail,
            businessDescription: row.businessDescription,
            businessType: row.businessType,
            gstin: row.gstin,
          }),
          ...nullableAddressCustom("businessPostal", row.businessPostalAddress),
        },
      })),
      socials: form.socials.map((row) => ({
        groupId: optionalText(row.groupId),
        tag: nullableText(row.tag),
        custom: nullableCustom({
          skype: row.skype,
          facebook: row.facebook,
          instagram: row.instagram,
          twitter: row.twitter,
          whatsApp: row.whatsapp,
          blog: row.blog,
          website: row.website,
          linkedin: row.linkedin,
          github: row.github,
        }),
      })),
      financial: {
        bankAccounts: form.financial.bankAccounts.map((row) => ({
          groupId: optionalText(row.groupId),
          fieldId: optionalText(row.fieldId),
          tag: nullableText(row.tag),
          bankName: nullableText(row.bankName),
          accountHolder: nullableText(row.accountHolder),
          accountNumber: nullableText(row.accountNumber),
          iban: nullableText(row.iban),
          swiftBic: nullableText(row.swiftBic),
          routingNumber: nullableText(row.routingNumber),
          ifsc: nullableText(row.ifsc),
          currency: nullableText(row.currency),
        })),
        digitalWallets: form.financial.digitalWallets.map((row) => ({
          groupId: optionalText(row.groupId),
          fieldId: optionalText(row.fieldId),
          tag: nullableText(row.tag),
          platform: nullableText(row.platform),
          handleOrLink: nullableText(row.handleOrLink),
        })),
        cryptoWallets: form.financial.cryptoWallets.map((row) => ({
          groupId: optionalText(row.groupId),
          fieldId: optionalText(row.fieldId),
          tag: nullableText(row.tag),
          network: nullableText(row.network),
          address: nullableText(row.address),
        })),
      },
    };
  };

  const buildFirstTimeOnboardingPayload = (): FullProfilePayload => {
    const identity = loadedIdentity ?? form.identity;
    const hasPersonal = hasPersonalDetails(form.personal);

    return {
      identity: {
        firstName: identity.firstName.trim(),
        lastName: identity.lastName.trim(),
        primaryPhone: identity.primaryPhone.trim(),
        primaryEmail: identity.primaryEmail.trim(),
        profilePhoto: profilePhotoForSave(form.identity.profilePhoto),
      },
      personal: {
        groupId: undefined,
        tag: hasPersonal ? nullableText(form.personal.tag) : undefined,
        postalAddress: toNullableAddressPayload(form.personal.postalAddress),
        mobile: nullableTextForSave(form.personal.mobile, false),
        landline: nullableTextForSave(form.personal.landline, false),
        email: nullableTextForSave(form.personal.email, false),
        dateOfBirth: nullableTextForSave(form.personal.dateOfBirth, false),
        currentLocation: nullableTextForSave(form.personal.currentLocation, false),
        relationshipStatus: nullableTextForSave(
          form.personal.relationshipStatus,
          false,
        ),
        custom: nullableCustomForSave(
          {
            title: form.personal.title,
            nickname: form.personal.nickname,
            kidsNames: form.personal.kidsNames,
            partnerName: form.personal.partnerName,
            petNames: form.personal.petNames,
            bloodGroup: form.personal.bloodGroup,
          },
          false,
        ),
      },
      work: form.work.filter(hasWorkDetails).map((row) => ({
        groupId: undefined,
        tag: nullableText(row.tag),
        custom: {
          ...nullableCustomForSave(
            {
              companyName: row.companyName,
              companyLogo: row.companyLogo,
              companyRegNumber: row.companyRegNumber,
              workTitle: row.workTitle,
              workMobile: row.workMobile,
              workLandline: row.workLandline,
              workFax: row.workFax,
              workEmail: row.workEmail,
              employeeId: row.employeeId,
            },
            false,
          ),
          ...nullableAddressCustomForSave(
            "workPostal",
            row.workPostalAddress,
            false,
          ),
        },
      })),
      business: form.business.filter(hasBusinessDetails).map((row) => ({
        groupId: undefined,
        tag: nullableText(row.tag),
        custom: {
          ...nullableCustomForSave(
            {
              businessName: row.businessName,
              businessLogo: row.businessLogo,
              businessRegNumber: row.businessRegNumber,
              businessTitle: row.businessTitle,
              businessMobile: row.businessMobile,
              businessLandline: row.businessLandline,
              businessFax: row.businessFax,
              businessEmail: row.businessEmail,
              businessDescription: row.businessDescription,
              businessType: row.businessType,
              gstin: row.gstin,
            },
            false,
          ),
          ...nullableAddressCustomForSave(
            "businessPostal",
            row.businessPostalAddress,
            false,
          ),
        },
      })),
      socials: form.socials.filter(hasSocialDetails).map((row) => ({
        groupId: undefined,
        tag: nullableText(row.tag),
        custom: nullableCustomForSave(
          {
            skype: row.skype,
            facebook: row.facebook,
            instagram: row.instagram,
            twitter: row.twitter,
            whatsApp: row.whatsapp,
            blog: row.blog,
            website: row.website,
            linkedin: row.linkedin,
            github: row.github,
          },
          false,
        ),
      })),
      financial: {
        bankAccounts: form.financial.bankAccounts
          .filter(hasBankDetails)
          .map((row) => ({
            groupId: undefined,
            fieldId: undefined,
            tag: nullableText(row.tag),
            bankName: nullableText(row.bankName),
            accountHolder: nullableText(row.accountHolder),
            accountNumber: nullableText(row.accountNumber),
            iban: nullableText(row.iban),
            swiftBic: nullableText(row.swiftBic),
            routingNumber: nullableText(row.routingNumber),
            ifsc: nullableText(row.ifsc),
            currency: nullableText(row.currency),
          })),
        digitalWallets: form.financial.digitalWallets
          .filter(hasWalletDetails)
          .map((row) => ({
            groupId: undefined,
            fieldId: undefined,
            tag: nullableText(row.tag),
            platform: nullableText(row.platform),
            handleOrLink: nullableText(row.handleOrLink),
          })),
        cryptoWallets: form.financial.cryptoWallets
          .filter(hasCryptoDetails)
          .map((row) => ({
            groupId: undefined,
            fieldId: undefined,
            tag: nullableText(row.tag),
            network: nullableText(row.network),
            address: nullableText(row.address),
          })),
      },
    };
  };

  const hasEditableIdentityChanges = () => {
    if (!loadedIdentity) {
      return false;
    }
    return (
      form.identity.firstName.trim() !== loadedIdentity.firstName.trim() ||
      form.identity.lastName.trim() !== loadedIdentity.lastName.trim() ||
      form.identity.primaryEmail.trim().toLowerCase() !==
        loadedIdentity.primaryEmail.trim().toLowerCase()
    );
  };

  const saveProfile = async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    setIsSaving(true);
    try {
      const payload = buildProfilePayload();
      const shouldInitialize = !hasExistingProfile;
      try {
        if (shouldInitialize) {
          const shouldPatchIdentity = hasEditableIdentityChanges();
          await apiFetch<unknown>("/v1/profile/onboarding", {
            method: "POST",
            body: buildFirstTimeOnboardingPayload(),
          });
          if (shouldPatchIdentity) {
            await apiFetch<unknown>("/v1/profile/me", {
              method: "PATCH",
              body: { identity: payload.identity },
            });
          }
        } else {
          await apiFetch<unknown>("/v1/profile/me", {
            method: "PATCH",
            body: payload,
          });
        }
      } catch (error) {
        if (
          shouldInitialize &&
          error instanceof ApiError &&
          error.status === 409
        ) {
          await apiFetch<unknown>("/v1/profile/me", {
            method: "PATCH",
            body: payload,
          });
        } else {
          throw error;
        }
      }

      await cleanupPhotosAfterSuccessfulSave(collectPhotoUrls(form));
      toast.success("Profile saved.");
      await refreshUser();
      await onComplete({ identity: payload.identity });
    } catch (err) {
      logUiError("Could not save profile", err);
      toast.error(friendlyErrorMessages.save);
    } finally {
      setIsSaving(false);
    }
  };

  const skipProfile = () => {
    void cleanupUnsavedPhotoUploads().finally(() => {
      const identity = loadedIdentity ?? form.identity;
      toast.info("You can complete your profile later.");
      void onSkip({
        identity: {
          firstName: identity.firstName.trim(),
          lastName: identity.lastName.trim(),
          primaryPhone: identity.primaryPhone.trim(),
          primaryEmail: identity.primaryEmail.trim(),
          profilePhoto: profilePhotoForSave(identity.profilePhoto),
        },
      });
    });
  };

  return (
      <section className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-8 backdrop-blur-sm md:px-6">
        <div className="flex max-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl">
          <div className="border-b border-border px-4 py-3 md:px-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Optional onboarding</Badge>
                  <Badge variant="success">
                    Step {stepIndex + 1} of {steps.length}
                  </Badge>
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-normal">
                  {step.title}
                </h1>
	                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
	                  {step.description}
	                </p>
	                {!isLoadingProfile && !loadError && validationErrorCount > 0 && (
	                  <p className="mt-2 text-sm font-medium text-destructive">
	                    {validationErrorCount}{" "}
	                    {validationErrorCount === 1
	                      ? "field needs attention"
	                      : "fields need attention"}{" "}
	                    before saving.
	                  </p>
	                )}
	              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={skipProfile}
                disabled={isSaving || isLoadingProfile || isMutatingProfilePhoto || isMutatingLogo}
                className="self-start"
              >
                Skip for now
              </Button>
            </div>

          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5 [&_input]:h-9 [&_input]:py-1.5 [&_select]:h-9 [&_select]:py-1.5">
          {isLoadingProfile && (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <div className="grid gap-3 md:grid-cols-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full" />
                ))}
              </div>
            </div>
          )}

          {!isLoadingProfile && loadError && (
            <Alert className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
              <div>
                <p className="font-medium">Could not load profile</p>
                <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
              </div>
            </Alert>
          )}

          {!isLoadingProfile && !loadError && step.key === "personal" && (
            <ProfileSection>
              <ProfilePhotoUpload
                disabled={controlsDisabled}
                error={visibleError("identity.profilePhoto")}
                isLoading={isMutatingProfilePhoto}
                value={form.identity.profilePhoto}
                onUpload={(file) => void uploadProfilePhoto(file)}
                onClear={() => void deleteProfilePhoto()}
              />
              <div className="rounded-md border border-border bg-muted/25 p-3">
                <p className="text-sm font-semibold">Create your first personal card</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Add the details people need to keep in touch with you. You can
                  control what you share and add more fields later.
                </p>
              </div>
              <TwoColumn>
                <Field label="First name" error={visibleError("identity.firstName")}>
                  <Input
                    autoComplete="given-name"
                    value={form.identity.firstName}
                    onChange={(event) =>
                      setSectionValue("identity", "firstName", event.target.value)
                    }
                    {...validationProps("identity.firstName")}
                  />
                </Field>
                <Field label="Last name" error={visibleError("identity.lastName")}>
                  <Input
                    autoComplete="family-name"
                    value={form.identity.lastName}
                    onChange={(event) =>
                      setSectionValue("identity", "lastName", event.target.value)
                    }
                    {...validationProps("identity.lastName")}
                  />
                </Field>
                <Field label="Email" error={visibleError("identity.primaryEmail")}>
                  <Input
                    type="email"
                    autoComplete="email"
                    value={form.identity.primaryEmail}
                    onChange={(event) =>
                      setSectionValue("identity", "primaryEmail", event.target.value)
                    }
                    {...validationProps("identity.primaryEmail")}
                  />
                </Field>
                <Field label="Phone number" error={visibleError("identity.primaryPhone")}>
                  <Input
                    value={form.identity.primaryPhone}
                    readOnly
                    aria-readonly="true"
                    className="cursor-default bg-muted text-muted-foreground"
                    {...validationProps("identity.primaryPhone")}
                  />
                </Field>
                <Field label="Nickname">
                  <Input
                    value={form.personal.nickname}
                    onChange={(event) =>
                      setSectionValue("personal", "nickname", event.target.value)
                    }
                    placeholder="Optional nickname"
                  />
                </Field>
              </TwoColumn>
	              <AddressFields
	                title="Home address"
	                address={form.personal.postalAddress}
	                onChange={(key, value) => setAddressValue("personal", key, value)}
	                errorFor={visibleError}
	                onBlurField={markTouched}
	                pathPrefix="personal.postalAddress"
	              />
              <div className="rounded-md border border-dashed border-border p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">More personal fields</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add extra details only when they help people stay connected.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setShowAdditionalPersonalFields((current) => !current)
                    }
                    aria-expanded={showAdditionalPersonalFields}
                  >
                    {showAdditionalPersonalFields ? (
                      <X className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    )}
                    {showAdditionalPersonalFields ? "Hide fields" : "Add fields"}
                  </Button>
                </div>

                {showAdditionalPersonalFields && (
                  <div className="mt-4 space-y-4 border-t border-border pt-4">
                    <TwoColumn>
                      <Field label="Facebook">
                        <Input
                          value={form.socials[0]?.facebook ?? ""}
                          onChange={(event) =>
                            setSocialValue(0, "facebook", event.target.value)
                          }
                        />
                      </Field>
                      <Field label="Instagram">
                        <Input
                          value={form.socials[0]?.instagram ?? ""}
                          onChange={(event) =>
                            setSocialValue(0, "instagram", event.target.value)
                          }
                        />
                      </Field>
                      <Field label="Kids names">
                        <Input
                          value={form.personal.kidsNames}
                          onChange={(event) =>
                            setSectionValue("personal", "kidsNames", event.target.value)
                          }
                          placeholder="Optional"
                        />
                      </Field>
                      <Field label="Partner name">
                        <Input
                          value={form.personal.partnerName}
                          onChange={(event) =>
                            setSectionValue("personal", "partnerName", event.target.value)
                          }
                        />
                      </Field>
                      <Field label="Pet names">
                        <Input
                          value={form.personal.petNames}
                          onChange={(event) =>
                            setSectionValue("personal", "petNames", event.target.value)
                          }
                        />
                      </Field>
                      <Field label="Relationship status">
                        <Input
                          value={form.personal.relationshipStatus}
                          onChange={(event) =>
                            setSectionValue(
                              "personal",
                              "relationshipStatus",
                              event.target.value,
                            )
                          }
                        />
                      </Field>
                      <Field label="Blood group">
                        <Input
                          value={form.personal.bloodGroup}
                          onChange={(event) =>
                            setSectionValue("personal", "bloodGroup", event.target.value)
                          }
                          placeholder="Optional"
                        />
                      </Field>
                      <Field label="Label" error={visibleError("personal.tag")}>
                        <Input
                          value={form.personal.tag}
                          onChange={(event) =>
                            setSectionValue("personal", "tag", event.target.value)
                          }
                          {...validationProps("personal.tag")}
                        />
                      </Field>
                    </TwoColumn>
                  </div>
                )}
              </div>
            </ProfileSection>
          )}

          {!isLoadingProfile && !loadError && step.key === "work" && (
            <ProfileSection>
              <SectionHeader
                actionLabel="Add work profile"
                onAdd={() => addRow("work", emptyWork)}
              />
              {form.work.map((row, index) => (
                <RepeatablePanel
                  key={row.groupId ?? `work-${index}`}
                  canRemove={form.work.length > 1}
                  title={`Work profile ${index + 1}`}
                  onRemove={() => removeRow("work", index, emptyWork)}
                >
                  <TwoColumn>
                    <Field label="Company name">
                      <Input
                        value={row.companyName}
                        onChange={(event) =>
                          setWorkValue(index, "companyName", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Work title">
                      <Input
                        value={row.workTitle}
                        onChange={(event) =>
                          setWorkValue(index, "workTitle", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Work mobile">
                      <Input
                        value={row.workMobile}
                        onChange={(event) =>
                          setWorkValue(index, "workMobile", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Work email">
                      <Input
                        type="email"
                        value={row.workEmail}
                        onChange={(event) =>
                          setWorkValue(index, "workEmail", event.target.value)
                        }
                      />
                    </Field>
                  </TwoColumn>
                  <AddressFields
                    title="Work address"
                    address={row.workPostalAddress}
                    onChange={(key, value) => setWorkAddressValue(index, key, value)}
                  />
                  <div className="rounded-md border border-dashed border-border p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold">More work fields</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Keep this concise, then add secondary work details only
                          when they help people reach you.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setShowAdditionalWorkFields((current) => !current)
                        }
                        aria-expanded={showAdditionalWorkFields}
                      >
                        {showAdditionalWorkFields ? (
                          <X className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        )}
                        {showAdditionalWorkFields ? "Hide fields" : "Add fields"}
                      </Button>
                    </div>

                    {showAdditionalWorkFields && (
                      <div className="mt-4 border-t border-border pt-4">
                        <MediaFieldsLayout
                          media={
                            <LogoUploadField
                              disabled={
                                controlsDisabled || Boolean(logoMutations.work[index])
                              }
                              error={visibleError(`work.${index}.companyLogo`)}
                              isLoading={Boolean(logoMutations.work[index])}
                              label="Company logo"
                              value={row.companyLogo}
                              onClear={() => clearLogoFile("work", index)}
                              onUpload={(file) => void selectLogoFile("work", index, file)}
                            />
                          }
                        >
                          <TwoColumn>
                            <Field label="Company registration number">
                              <Input
                                value={row.companyRegNumber}
                                onChange={(event) =>
                                  setWorkValue(
                                    index,
                                    "companyRegNumber",
                                    event.target.value,
                                  )
                                }
                              />
                            </Field>
                            <Field label="Work landline">
                              <Input
                                value={row.workLandline}
                                onChange={(event) =>
                                  setWorkValue(index, "workLandline", event.target.value)
                                }
                              />
                            </Field>
                            <Field label="Work fax">
                              <Input
                                value={row.workFax}
                                onChange={(event) =>
                                  setWorkValue(index, "workFax", event.target.value)
                                }
                              />
                            </Field>
                            <Field label="Label" error={visibleError(`work.${index}.tag`)}>
                              <Input
                                value={row.tag}
                                onChange={(event) =>
                                  setWorkValue(index, "tag", event.target.value)
                                }
                                {...validationProps(`work.${index}.tag`)}
                              />
                            </Field>
                            <Field label="Employee ID">
                              <Input
                                value={row.employeeId}
                                onChange={(event) =>
                                  setWorkValue(index, "employeeId", event.target.value)
                                }
                              />
                            </Field>
                          </TwoColumn>
                        </MediaFieldsLayout>
                      </div>
                    )}
                  </div>
                </RepeatablePanel>
              ))}
            </ProfileSection>
          )}

          {!isLoadingProfile && !loadError && step.key === "business" && (
            <ProfileSection>
              <SectionHeader
                actionLabel="Add business"
                onAdd={() => addRow("business", emptyBusiness)}
              />
              {form.business.map((row, index) => (
                <RepeatablePanel
                  key={row.groupId ?? `business-${index}`}
                  canRemove={form.business.length > 1}
                  title={`Business Card ${index + 1}`}
                  onRemove={() => removeRow("business", index, emptyBusiness)}
                >
                  <TwoColumn>
                    <Field label="Card name" error={visibleError(`business.${index}.tag`)}>
                      <Input
                        value={row.tag}
                        onChange={(event) =>
                          setBusinessValue(index, "tag", event.target.value)
                        }
                        {...validationProps(`business.${index}.tag`)}
                      />
                    </Field>
                    <Field label="Business name">
                      <Input
                        value={row.businessName}
                        onChange={(event) =>
                          setBusinessValue(index, "businessName", event.target.value)
                        }
                      />
                    </Field>
                  </TwoColumn>
                  <TwoColumn>
                    <Field label="Business mobile">
                      <Input
                        value={row.businessMobile}
                        onChange={(event) =>
                          setBusinessValue(index, "businessMobile", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Business landline">
                      <Input
                        value={row.businessLandline}
                        onChange={(event) =>
                          setBusinessValue(index, "businessLandline", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Business email">
                      <Input
                        type="email"
                        value={row.businessEmail}
                        onChange={(event) =>
                          setBusinessValue(index, "businessEmail", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Short description">
                      <Input
                        maxLength={180}
                        value={row.businessDescription}
                        onChange={(event) =>
                          setBusinessValue(
                            index,
                            "businessDescription",
                            event.target.value,
                          )
                        }
                      />
                    </Field>
                    <Field label="LinkedIn">
                      <Input
                        value={form.socials[0]?.linkedin ?? ""}
                        onChange={(event) =>
                          setSocialValue(0, "linkedin", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Website">
                      <Input
                        value={form.socials[0]?.website ?? ""}
                        onChange={(event) =>
                          setSocialValue(0, "website", event.target.value)
                        }
                      />
                    </Field>
                  </TwoColumn>
                  <AddressFields
                    title="Business address"
                    address={row.businessPostalAddress}
                    onChange={(key, value) =>
                      setBusinessAddressValue(index, key, value)
                    }
                  />
                  <div className="rounded-md border border-dashed border-border p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold">More business fields</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Keep the business card clear, then add extra details only
                          when they make the card more complete.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setShowAdditionalBusinessFields((current) => !current)
                        }
                        aria-expanded={showAdditionalBusinessFields}
                      >
                        {showAdditionalBusinessFields ? (
                          <X className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        )}
                        {showAdditionalBusinessFields ? "Hide fields" : "Add fields"}
                      </Button>
                    </div>

                    {showAdditionalBusinessFields && (
                      <div className="mt-4 border-t border-border pt-4">
                        <MediaFieldsLayout
                          media={
                            <LogoUploadField
                              disabled={
                                controlsDisabled ||
                                Boolean(logoMutations.business[index])
                              }
                              error={visibleError(`business.${index}.businessLogo`)}
                              isLoading={Boolean(logoMutations.business[index])}
                              label="Business logo"
                              value={row.businessLogo}
                              onClear={() => clearLogoFile("business", index)}
                              onUpload={(file) =>
                                void selectLogoFile("business", index, file)
                              }
                            />
                          }
                        >
                          <TwoColumn>
                            <Field label="Business registration number">
                              <Input
                                value={row.businessRegNumber}
                                onChange={(event) =>
                                  setBusinessValue(
                                    index,
                                    "businessRegNumber",
                                    event.target.value,
                                  )
                                }
                              />
                            </Field>
                            <Field label="Business title">
                              <Input
                                value={row.businessTitle}
                                onChange={(event) =>
                                  setBusinessValue(
                                    index,
                                    "businessTitle",
                                    event.target.value,
                                  )
                                }
                              />
                            </Field>
                            <Field label="Business fax">
                              <Input
                                value={row.businessFax}
                                onChange={(event) =>
                                  setBusinessValue(index, "businessFax", event.target.value)
                                }
                              />
                            </Field>
                            <Field label="Business type">
                              <Input
                                value={row.businessType}
                                onChange={(event) =>
                                  setBusinessValue(index, "businessType", event.target.value)
                                }
                              />
                            </Field>
                            <Field label="GSTIN">
                              <Input
                                value={row.gstin}
                                onChange={(event) =>
                                  setBusinessValue(index, "gstin", event.target.value)
                                }
                              />
                            </Field>
                          </TwoColumn>
                        </MediaFieldsLayout>
                      </div>
                    )}
                  </div>
                </RepeatablePanel>
              ))}
            </ProfileSection>
          )}

          </div>

          <div className="flex flex-col gap-3 border-t border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
              disabled={stepIndex === 0 || controlsDisabled}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </Button>
            <div className="flex flex-col gap-3 sm:flex-row">
              {stepIndex < steps.length - 1 ? (
                <Button
                  type="button"
                  onClick={() =>
                    setStepIndex((current) => Math.min(steps.length - 1, current + 1))
                  }
                  disabled={controlsDisabled}
                >
                  Next
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : (
	                <Button
	                  type="button"
	                  onClick={() => void saveProfile()}
	                  disabled={saveDisabled}
	                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Save profile
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
  );
}

export default function ProfileOnboardingPage() {
  const navigate = useNavigate();

  return (
    <AppShell>
      <ProfileOnboardingModal
        onComplete={() => navigate("/dashboard?onboarding=import", { replace: true })}
        onSkip={() => navigate("/dashboard?onboarding=import", { replace: true })}
      />
    </AppShell>
  );
}

function ProfileSection({ children }: { children: ReactNode }) {
  return <section className="space-y-4">{children}</section>;
}

function SectionHeader({
  actionLabel,
  onAdd,
}: {
  actionLabel: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex justify-end">
      <Button type="button" variant="outline" onClick={onAdd}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        {actionLabel}
      </Button>
    </div>
  );
}

function RepeatablePanel({
  canRemove,
  children,
  onRemove,
  title,
}: {
  canRemove: boolean;
  children: ReactNode;
  onRemove: () => void;
  title: string;
}) {
  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{title}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove ${title.toLowerCase()}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {children}
    </div>
  );
}

function ProfilePhotoUpload({
  disabled,
  error,
  isLoading,
  onClear,
  onUpload,
  value,
}: {
  disabled: boolean;
  error?: string;
  isLoading: boolean;
  onClear: () => void;
  onUpload: (file: File | undefined) => void;
  value: string;
}) {
  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <label
          className={cn(
            "group flex min-w-0 flex-1 cursor-pointer items-center gap-4 rounded-md border border-dashed border-border bg-muted/30 p-3 transition-colors hover:bg-muted",
            disabled && "cursor-not-allowed opacity-60 hover:bg-muted/30",
          )}
        >
          <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
            {value ? (
              <img src={value} alt="" className="h-full w-full object-cover" />
            ) : (
              <UploadCloud className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
            )}
            <span className="absolute inset-x-0 bottom-0 bg-foreground/70 px-2 py-1 text-center text-xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100">
              {value ? "Replace" : "Upload"}
            </span>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Profile photo</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Click the image area to upload a JPEG, PNG, or WebP under 1 MB.
            </p>
            {error && <p className="mt-1 text-xs font-medium text-destructive">{error}</p>}
          </div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={disabled}
            onChange={(event) => {
              onUpload(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        {value && (
          <Button type="button" variant="ghost" onClick={onClear} disabled={disabled}>
            <X className="h-4 w-4" aria-hidden="true" />
            Remove
          </Button>
        )}
      </div>
      {isLoading && (
        <p className="text-xs font-medium text-muted-foreground">Updating photo...</p>
      )}
    </div>
  );
}

function LogoUploadField({
  disabled,
  error,
  isLoading,
  label,
  onClear,
  onUpload,
  value,
}: {
  disabled: boolean;
  error?: string;
  isLoading: boolean;
  label: string;
  onClear: () => void;
  onUpload: (file: File | undefined) => void;
  value: string;
}) {
  const previewUrl = isHttpUrl(value) ? value : undefined;
  const displayValue = value ? (previewUrl ? "Logo uploaded" : value) : "Choose logo image";

  return (
    <div className="flex h-full flex-col gap-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex min-h-9 flex-1 flex-col rounded-md border border-border p-2.5">
        <div className="flex flex-1 flex-col gap-2">
          <label
            className={cn(
              "group flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md border border-dashed border-border bg-muted/30 p-2.5 transition-colors hover:bg-muted",
              disabled && "cursor-not-allowed opacity-60 hover:bg-muted/30",
            )}
          >
            <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
              {previewUrl ? (
                <img src={previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UploadCloud className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="absolute inset-x-0 bottom-0 bg-foreground/70 px-2 py-1 text-center text-xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100">
                {value ? "Replace" : "Upload"}
              </span>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold" title={value}>
                {displayValue}
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                JPEG, PNG, or WebP under 1 MB.
              </span>
              {error && (
                <span className="mt-1 block text-xs font-medium text-destructive">
                  {error}
                </span>
              )}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={disabled}
              onChange={(event) => {
                onUpload(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          {value && (
            <Button
              type="button"
              variant="ghost"
              onClick={onClear}
              disabled={disabled}
              className="h-8 w-full justify-center"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Remove
            </Button>
          )}
        </div>
        {isLoading && (
          <p className="mt-3 text-xs font-medium text-muted-foreground">
            Updating logo...
          </p>
        )}
      </div>
    </div>
  );
}

function MediaFieldsLayout({
  children,
  media,
}: {
  children: ReactNode;
  media: ReactNode;
}) {
  return (
    <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(14rem,0.75fr)_minmax(0,2.25fr)]">
      <div className="flex min-w-0">{media}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Field({
  children,
  error,
  label,
}: {
  children: ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
      {error && <span className="text-xs font-medium text-destructive">{error}</span>}
    </label>
  );
}

function TwoColumn({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function AddressFields({
  errorFor,
  onBlurField,
  title,
  address,
  onChange,
  pathPrefix,
}: {
  errorFor?: (path: string) => string | undefined;
  onBlurField?: (path: string) => void;
  title: string;
  address: AddressForm;
  onChange: (key: keyof AddressForm, value: string) => void;
  pathPrefix?: string;
}) {
  const validationProps = (key: keyof AddressForm) => {
    const path = pathPrefix ? `${pathPrefix}.${key}` : "";
    return path
      ? {
          "aria-invalid": Boolean(errorFor?.(path)),
          onBlur: () => onBlurField?.(path),
        }
      : {};
  };

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <p className="text-sm font-semibold">{title}</p>
      <TwoColumn>
        <Field
          label="Street"
          error={pathPrefix ? errorFor?.(`${pathPrefix}.street`) : undefined}
        >
          <Input
            value={address.street}
            onChange={(event) => onChange("street", event.target.value)}
            {...validationProps("street")}
          />
        </Field>
        <Field label="City" error={pathPrefix ? errorFor?.(`${pathPrefix}.city`) : undefined}>
          <Input
            value={address.city}
            onChange={(event) => onChange("city", event.target.value)}
            {...validationProps("city")}
          />
        </Field>
        <Field
          label="State"
          error={pathPrefix ? errorFor?.(`${pathPrefix}.state`) : undefined}
        >
          <Input
            value={address.state}
            onChange={(event) => onChange("state", event.target.value)}
            {...validationProps("state")}
          />
        </Field>
        <Field
          label="Pincode"
          error={pathPrefix ? errorFor?.(`${pathPrefix}.pincode`) : undefined}
        >
          <Input
            value={address.pincode}
            onChange={(event) => onChange("pincode", event.target.value)}
            {...validationProps("pincode")}
          />
        </Field>
        <Field
          label="Country"
          error={pathPrefix ? errorFor?.(`${pathPrefix}.country`) : undefined}
        >
          <Input
            value={address.country}
            onChange={(event) => onChange("country", event.target.value)}
            {...validationProps("country")}
          />
        </Field>
      </TwoColumn>
    </div>
  );
}
