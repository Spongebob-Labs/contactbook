import { useEffect, useState } from "react";
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
import { ApiError, apiFetch } from "@/lib/api";
import type { PostalAddress, ProfileMeResponse } from "@/lib/types";

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
  businessPostalAddress: AddressForm;
  businessType: string;
  gstin: string;
};

type SocialsForm = {
  groupId?: string;
  tag: string;
  skype: string;
  facebook: string;
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

type AddressPayload = {
  street: string;
  city: string;
  state?: string;
  pincode?: string;
  country: string;
};

type ProfileOnboardingPayload = {
  identity?: {
    firstName?: string;
    lastName?: string;
    primaryPhone?: string;
    primaryEmail?: string;
    profilePhoto?: string | null;
  };
  personal?: {
    tag?: string | null;
    postalAddress?: AddressPayload | null;
    mobile?: string;
    landline?: string;
    email?: string;
    dateOfBirth?: string;
    yearOfBirth?: string;
    currentLocation?: string;
    relationshipStatus?: string;
    custom?: Record<string, string> | null;
  };
  work?: Array<{
    groupId?: string;
    tag?: string;
    companyName?: string;
    companyLogo?: string;
    companyRegNumber?: string;
    workTitle?: string;
    workMobile?: string;
    workLandline?: string;
    workFax?: string;
    workEmail?: string;
    workPostalAddress?: AddressPayload;
    custom?: Record<string, string>;
  }>;
  business?: Array<{
    groupId?: string;
    tag?: string;
    businessName?: string;
    businessLogo?: string;
    businessRegNumber?: string;
    businessTitle?: string;
    businessMobile?: string;
    businessLandline?: string;
    businessFax?: string;
    businessEmail?: string;
    businessPostalAddress?: AddressPayload;
    custom?: Record<string, string>;
  }>;
  socials?: Array<{
    groupId?: string;
    tag?: string;
    custom?: Record<string, string>;
  }>;
  financial?: {
    bankAccounts?: Array<{
      groupId?: string;
      fieldId?: string;
      tag?: string;
      bankName?: string;
      accountHolder?: string;
      accountNumber?: string;
      iban?: string;
      swiftBic?: string;
      routingNumber?: string;
      ifsc?: string;
      currency?: string;
    }>;
    digitalWallets?: Array<{
      groupId?: string;
      fieldId?: string;
      tag?: string;
      platform?: string;
      handleOrLink?: string;
    }>;
    cryptoWallets?: Array<{
      groupId?: string;
      fieldId?: string;
      tag?: string;
      network?: string;
      address?: string;
    }>;
  };
};

type RequiredOnboardingPayload = {
  identity: {
    firstName: string;
    lastName: string;
    primaryPhone: string;
    primaryEmail: string;
    profilePhoto: string | null;
  };
  personal: {
    tag: string | null;
    postalAddress: AddressPayload | null;
    custom: Record<string, string> | null;
  };
  work: NonNullable<ProfileOnboardingPayload["work"]>;
  business: NonNullable<ProfileOnboardingPayload["business"]>;
  socials: NonNullable<ProfileOnboardingPayload["socials"]>;
  financial: {
    bankAccounts: NonNullable<
      NonNullable<ProfileOnboardingPayload["financial"]>["bankAccounts"]
    >;
    digitalWallets: NonNullable<
      NonNullable<ProfileOnboardingPayload["financial"]>["digitalWallets"]
    >;
    cryptoWallets: NonNullable<
      NonNullable<ProfileOnboardingPayload["financial"]>["cryptoWallets"]
    >;
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
  businessPostalAddress: { ...emptyAddress },
  businessType: "",
  gstin: "",
});

const emptySocials = (): SocialsForm => ({
  tag: "Main Digital Presence",
  skype: "",
  facebook: "",
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
  {
    key: "socials",
    title: "Socials",
    description: "Connect your public digital presence.",
  },
  {
    key: "financial",
    title: "Financial",
    description: "Store sensitive payment rails securely.",
  },
] as const;

function clean(value: string): string {
  return value.trim();
}

function hasText(value: string): boolean {
  return clean(value).length > 0;
}

function hasAny(values: string[]): boolean {
  return values.some(hasText);
}

function addressHasAny(address: AddressForm): boolean {
  return hasAny([
    address.street,
    address.city,
    address.state,
    address.pincode,
    address.country,
  ]);
}

function toAddressPayload(address: AddressForm): AddressPayload {
  return {
    street: clean(address.street),
    city: clean(address.city),
    state: clean(address.state) || undefined,
    pincode: clean(address.pincode) || undefined,
    country: clean(address.country),
  };
}

function optionalText(value: string): string | undefined {
  const next = clean(value);
  return next || undefined;
}

function nullableText(value: string | null | undefined): string | null {
  const next = clean(value ?? "");
  return next || null;
}

function compactObject<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}

function compactCustom(values: Record<string, string>): Record<string, string> | undefined {
  const custom = compactObject(
    Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, optionalText(value)]),
    ),
  );
  return Object.keys(custom).length > 0 ? (custom as Record<string, string>) : undefined;
}

function valueOrEmpty(value: string | null | undefined): string {
  return value ?? "";
}

function customValue(
  custom: Record<string, string> | undefined,
  key: string,
): string {
  return custom?.[key] ?? "";
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

function ensureRows<T>(rows: T[], createEmpty: () => T): T[] {
  return rows.length > 0 ? rows : [createEmpty()];
}

function hasWorkDetails(row: WorkForm): boolean {
  return (
    hasAny([
      row.companyName,
      row.companyLogo,
      row.companyRegNumber,
      row.workTitle,
      row.workMobile,
      row.workLandline,
      row.workFax,
      row.workEmail,
      row.employeeId,
    ]) || addressHasAny(row.workPostalAddress)
  );
}

function hasBusinessDetails(row: BusinessForm): boolean {
  return (
    hasAny([
      row.businessName,
      row.businessLogo,
      row.businessRegNumber,
      row.businessTitle,
      row.businessMobile,
      row.businessLandline,
      row.businessFax,
      row.businessEmail,
      row.businessType,
      row.gstin,
    ]) || addressHasAny(row.businessPostalAddress)
  );
}

function hasSocialDetails(row: SocialsForm): boolean {
  return hasAny([
    row.skype,
    row.facebook,
    row.twitter,
    row.whatsapp,
    row.blog,
    row.website,
    row.linkedin,
    row.github,
  ]);
}

function hasBankDetails(row: BankForm): boolean {
  return hasAny([
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
  return hasAny([row.platform, row.handleOrLink]);
}

function hasCryptoDetails(row: CryptoForm): boolean {
  return hasAny([row.network, row.address]);
}

function profileToForm(profile: ProfileMeResponse): OnboardingForm {
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
      tag: valueOrEmpty(profile.personal.tag) || initialForm.personal.tag,
      title: customValue(profile.personal.custom, "title"),
      nickname: customValue(profile.personal.custom, "nickname"),
      mobile:
        valueOrEmpty(profile.personal.mobile) ||
        customValue(profile.personal.custom, "mobile"),
      landline:
        valueOrEmpty(profile.personal.landline) ||
        customValue(profile.personal.custom, "landline"),
      email:
        valueOrEmpty(profile.personal.email) ||
        customValue(profile.personal.custom, "email"),
      postalAddress: addressToForm(profile.personal.postalAddress),
      dateOfBirth:
        valueOrEmpty(profile.personal.dateOfBirth) ||
        customValue(profile.personal.custom, "dateOfBirth"),
      yearOfBirth:
        valueOrEmpty(profile.personal.yearOfBirth) ||
        customValue(profile.personal.custom, "yearOfBirth"),
      currentLocation:
        valueOrEmpty(profile.personal.currentLocation) ||
        customValue(profile.personal.custom, "currentLocation"),
      kidsNames: customValue(profile.personal.custom, "kidsNames"),
      partnerName: customValue(profile.personal.custom, "partnerName"),
      petNames: customValue(profile.personal.custom, "petNames"),
      relationshipStatus:
        valueOrEmpty(profile.personal.relationshipStatus) ||
        customValue(profile.personal.custom, "relationshipStatus"),
      bloodGroup: customValue(profile.personal.custom, "bloodGroup"),
    },
    work: ensureRows(
      profile.work.map((item) => ({
        ...emptyWork(),
        groupId: item.groupId,
        tag: valueOrEmpty(item.tag) || emptyWork().tag,
        companyName: valueOrEmpty(item.companyName),
        companyLogo: valueOrEmpty(item.companyLogo),
        companyRegNumber: valueOrEmpty(item.companyRegNumber),
        workTitle: valueOrEmpty(item.workTitle),
        workMobile: valueOrEmpty(item.workMobile),
        workLandline: valueOrEmpty(item.workLandline),
        workFax: valueOrEmpty(item.workFax),
        workEmail: valueOrEmpty(item.workEmail),
        workPostalAddress: addressToForm(item.workPostalAddress),
        employeeId: customValue(item.custom, "employeeId"),
      })),
      emptyWork,
    ),
    business: ensureRows(
      profile.business.map((item) => ({
        ...emptyBusiness(),
        groupId: item.groupId,
        tag: valueOrEmpty(item.tag) || emptyBusiness().tag,
        businessName: valueOrEmpty(item.businessName),
        businessLogo: valueOrEmpty(item.businessLogo),
        businessRegNumber: valueOrEmpty(item.businessRegNumber),
        businessTitle: valueOrEmpty(item.businessTitle),
        businessMobile: valueOrEmpty(item.businessMobile),
        businessLandline: valueOrEmpty(item.businessLandline),
        businessFax: valueOrEmpty(item.businessFax),
        businessEmail: valueOrEmpty(item.businessEmail),
        businessPostalAddress: addressToForm(item.businessPostalAddress),
        businessType: customValue(item.custom, "businessType"),
        gstin: customValue(item.custom, "gstin"),
      })),
      emptyBusiness,
    ),
    socials: ensureRows(
      profile.socials.map((item) => ({
        ...emptySocials(),
        groupId: item.groupId,
        tag: valueOrEmpty(item.tag) || emptySocials().tag,
        skype: customValue(item.custom, "skype"),
        facebook: customValue(item.custom, "facebook"),
        twitter: customValue(item.custom, "twitter"),
        whatsapp:
          customValue(item.custom, "whatsApp") ||
          customValue(item.custom, "whatsapp"),
        blog: customValue(item.custom, "blog"),
        website: customValue(item.custom, "website"),
        linkedin: customValue(item.custom, "linkedin"),
        github: customValue(item.custom, "github"),
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

const MAX_PROFILE_PHOTO_BYTES = 1024 * 1024;

function hasInitializedProfile(profile: ProfileMeResponse) {
  if (profile.profileOnboardingCompletedAt) {
    return true;
  }
  return Boolean(
    profile.personal.groupId ||
      profile.work.length > 0 ||
      profile.business.length > 0 ||
      profile.socials.length > 0 ||
      profile.financial.bankAccounts.length > 0 ||
      profile.financial.digitalWallets.length > 0 ||
      profile.financial.cryptoWallets.length > 0,
  );
}

type ProfileOnboardingModalProps = {
  onComplete: () => void;
  onSkip: () => void;
};

export function ProfileOnboardingModal({
  onComplete,
  onSkip,
}: ProfileOnboardingModalProps) {
  const [form, setForm] = useState<OnboardingForm>(initialForm);
  const [stepIndex, setStepIndex] = useState(0);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  const [registeredIdentity, setRegisteredIdentity] = useState(initialForm.identity);
  const step = steps[stepIndex];
  const controlsDisabled = isSaving || isLoadingProfile || Boolean(loadError);

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
          setRegisteredIdentity(nextForm.identity);
          setHasExistingProfile(hasInitializedProfile(profile));
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(
            error instanceof Error ? error.message : "Could not load your profile.",
          );
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

  const uploadProfilePhoto = (file: File | undefined) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }

    if (file.size > MAX_PROFILE_PHOTO_BYTES) {
      toast.error("Choose an image under 1 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setSectionValue("identity", "profilePhoto", reader.result);
      }
    };
    reader.onerror = () => {
      toast.error("Could not read image.");
    };
    reader.readAsDataURL(file);
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
    if (!hasText(form.identity.firstName)) {
      return "Enter your first name.";
    }
    if (!hasText(form.identity.lastName)) {
      return "Enter your last name.";
    }
    if (!hasText(form.identity.primaryEmail)) {
      return "Enter your email.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(form.identity.primaryEmail))) {
      return "Enter a valid email address.";
    }

    return null;
  };

  const buildProfilePayload = (): ProfileOnboardingPayload => {
    const payload: ProfileOnboardingPayload = {};

    const identity = compactObject({
      firstName: optionalText(form.identity.firstName),
      lastName: optionalText(form.identity.lastName),
      primaryEmail: optionalText(form.identity.primaryEmail),
      profilePhoto: optionalText(form.identity.profilePhoto),
    });
    if (Object.keys(identity).length > 0) {
      payload.identity = identity;
    }

    const personalCustom = compactCustom({
      title: form.personal.title,
      nickname: form.personal.nickname,
      mobile: form.personal.mobile,
      landline: form.personal.landline,
      email: form.personal.email,
      dateOfBirth: form.personal.dateOfBirth,
      yearOfBirth: form.personal.yearOfBirth,
      currentLocation: form.personal.currentLocation,
      kidsNames: form.personal.kidsNames,
      partnerName: form.personal.partnerName,
      petNames: form.personal.petNames,
      relationshipStatus: form.personal.relationshipStatus,
      bloodGroup: form.personal.bloodGroup,
    });
    const hasPersonalDetails =
      Boolean(personalCustom) ||
      addressHasAny(form.personal.postalAddress);
    const personal = compactObject({
      tag: optionalText(form.personal.tag),
      postalAddress: addressHasAny(form.personal.postalAddress)
        ? toAddressPayload(form.personal.postalAddress)
        : undefined,
      custom: personalCustom,
    });
    if (hasPersonalDetails) {
      payload.personal = personal;
    }

    const work = form.work
      .filter(hasWorkDetails)
      .map((row) => {
        const workCustom = compactCustom({ employeeId: row.employeeId });
        return compactObject({
          groupId: row.groupId,
          tag: optionalText(row.tag),
          companyName: optionalText(row.companyName),
          companyLogo: optionalText(row.companyLogo),
          companyRegNumber: optionalText(row.companyRegNumber),
          workTitle: optionalText(row.workTitle),
          workMobile: optionalText(row.workMobile),
          workLandline: optionalText(row.workLandline),
          workFax: optionalText(row.workFax),
          workEmail: optionalText(row.workEmail),
          workPostalAddress: addressHasAny(row.workPostalAddress)
            ? toAddressPayload(row.workPostalAddress)
            : undefined,
          custom: workCustom,
        });
      });
    if (work.length > 0) {
      payload.work = work;
    }

    const business = form.business
      .filter(hasBusinessDetails)
      .map((row) => {
        const businessCustom = compactCustom({
          businessType: row.businessType,
          gstin: row.gstin,
        });
        return compactObject({
          groupId: row.groupId,
          tag: optionalText(row.tag),
          businessName: optionalText(row.businessName),
          businessLogo: optionalText(row.businessLogo),
          businessRegNumber: optionalText(row.businessRegNumber),
          businessTitle: optionalText(row.businessTitle),
          businessMobile: optionalText(row.businessMobile),
          businessLandline: optionalText(row.businessLandline),
          businessFax: optionalText(row.businessFax),
          businessEmail: optionalText(row.businessEmail),
          businessPostalAddress: addressHasAny(row.businessPostalAddress)
            ? toAddressPayload(row.businessPostalAddress)
            : undefined,
          custom: businessCustom,
        });
      });
    if (business.length > 0) {
      payload.business = business;
    }

    const socials = form.socials
      .filter(hasSocialDetails)
      .map((row) =>
        compactObject({
          groupId: row.groupId,
          tag: optionalText(row.tag),
          custom: compactCustom({
            skype: row.skype,
            facebook: row.facebook,
            twitter: row.twitter,
            whatsApp: row.whatsapp,
            blog: row.blog,
            website: row.website,
            linkedin: row.linkedin,
            github: row.github,
          }),
        }),
      );
    if (socials.length > 0) {
      payload.socials = socials;
    }

    const financial: NonNullable<ProfileOnboardingPayload["financial"]> = {};
    const bankAccounts = form.financial.bankAccounts
      .filter(hasBankDetails)
      .map((row) =>
        compactObject({
          groupId: row.groupId,
          fieldId: row.fieldId,
          tag: optionalText(row.tag),
          bankName: optionalText(row.bankName),
          accountHolder: optionalText(row.accountHolder),
          accountNumber: optionalText(row.accountNumber),
          iban: optionalText(row.iban),
          swiftBic: optionalText(row.swiftBic),
          routingNumber: optionalText(row.routingNumber),
          ifsc: optionalText(row.ifsc),
          currency: optionalText(row.currency),
        }),
      );
    if (bankAccounts.length > 0) {
      financial.bankAccounts = bankAccounts;
    }

    const digitalWallets = form.financial.digitalWallets
      .filter(hasWalletDetails)
      .map((row) =>
        compactObject({
          groupId: row.groupId,
          fieldId: row.fieldId,
          tag: optionalText(row.tag),
          platform: optionalText(row.platform),
          handleOrLink: optionalText(row.handleOrLink),
        }),
      );
    if (digitalWallets.length > 0) {
      financial.digitalWallets = digitalWallets;
    }

    const cryptoWallets = form.financial.cryptoWallets
      .filter(hasCryptoDetails)
      .map((row) =>
        compactObject({
          groupId: row.groupId,
          fieldId: row.fieldId,
          tag: optionalText(row.tag),
          network: optionalText(row.network),
          address: optionalText(row.address),
        }),
      );
    if (cryptoWallets.length > 0) {
      financial.cryptoWallets = cryptoWallets;
    }

    if (
      financial.bankAccounts?.length ||
      financial.digitalWallets?.length ||
      financial.cryptoWallets?.length
    ) {
      payload.financial = financial;
    }

    return payload;
  };

  const buildOnboardingPayload = (
    payload: ProfileOnboardingPayload,
  ): RequiredOnboardingPayload => ({
    identity: {
      firstName: registeredIdentity.firstName.trim(),
      lastName: registeredIdentity.lastName.trim(),
      primaryPhone: registeredIdentity.primaryPhone.trim(),
      primaryEmail: registeredIdentity.primaryEmail.trim(),
      profilePhoto: nullableText(form.identity.profilePhoto),
    },
    personal: {
      tag: nullableText(payload.personal?.tag),
      postalAddress: payload.personal?.postalAddress ?? null,
      custom: payload.personal?.custom ?? null,
    },
    work: payload.work ?? [],
    business: payload.business ?? [],
    socials: payload.socials ?? [],
    financial: {
      bankAccounts: payload.financial?.bankAccounts ?? [],
      digitalWallets: payload.financial?.digitalWallets ?? [],
      cryptoWallets: payload.financial?.cryptoWallets ?? [],
    },
  });

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
          await apiFetch<unknown>("/v1/profile/onboarding", {
            method: "POST",
            body: buildOnboardingPayload(payload),
          });

          const identity = payload.identity;
          if (
            identity?.firstName !== undefined ||
            identity?.lastName !== undefined ||
            identity?.primaryEmail !== undefined
          ) {
            await apiFetch<unknown>("/v1/profile/me", {
              method: "PATCH",
              body: {
                identity: {
                  firstName: identity.firstName,
                  lastName: identity.lastName,
                  primaryEmail: identity.primaryEmail,
                },
              },
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

      toast.success("Profile saved.");
      onComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const skipProfile = () => {
    toast.info("You can complete your profile later.");
    onSkip();
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
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={skipProfile}
                disabled={isSaving || isLoadingProfile}
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
                value={form.identity.profilePhoto}
                onUpload={uploadProfilePhoto}
                onClear={() => setSectionValue("identity", "profilePhoto", "")}
              />
              <TwoColumn>
                <Field label="First name">
                  <Input
                    autoComplete="given-name"
                    value={form.identity.firstName}
                    onChange={(event) =>
                      setSectionValue("identity", "firstName", event.target.value)
                    }
                  />
                </Field>
                <Field label="Last name">
                  <Input
                    autoComplete="family-name"
                    value={form.identity.lastName}
                    onChange={(event) =>
                      setSectionValue("identity", "lastName", event.target.value)
                    }
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    autoComplete="email"
                    value={form.identity.primaryEmail}
                    onChange={(event) =>
                      setSectionValue("identity", "primaryEmail", event.target.value)
                    }
                  />
                </Field>
                <Field label="Phone number">
                  <Input
                    value={form.identity.primaryPhone}
                    readOnly
                    aria-readonly="true"
                    className="cursor-default bg-muted text-muted-foreground"
                  />
                </Field>
              </TwoColumn>
              <TwoColumn>
                <Field label="Title">
                  <Input
                    value={form.personal.title}
                    onChange={(event) =>
                      setSectionValue("personal", "title", event.target.value)
                    }
                    placeholder="Mr."
                  />
                </Field>
                <Field label="Nickname">
                  <Input
                    value={form.personal.nickname}
                    onChange={(event) =>
                      setSectionValue("personal", "nickname", event.target.value)
                    }
                    placeholder="Fardeen"
                  />
                </Field>
                <Field label="Mobile">
                  <Input
                    value={form.personal.mobile}
                    onChange={(event) =>
                      setSectionValue("personal", "mobile", event.target.value)
                    }
                    placeholder="+919876543210"
                  />
                </Field>
                <Field label="Landline">
                  <Input
                    value={form.personal.landline}
                    onChange={(event) =>
                      setSectionValue("personal", "landline", event.target.value)
                    }
                    placeholder="+914012345678"
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={form.personal.email}
                    onChange={(event) =>
                      setSectionValue("personal", "email", event.target.value)
                    }
                    placeholder="personal@example.com"
                  />
                </Field>
                <Field label="Date of birth">
                  <Input
                    type="date"
                    value={form.personal.dateOfBirth}
                    onChange={(event) =>
                      setSectionValue("personal", "dateOfBirth", event.target.value)
                    }
                  />
                </Field>
                <Field label="Year of birth">
                  <Input
                    value={form.personal.yearOfBirth}
                    onChange={(event) =>
                      setSectionValue("personal", "yearOfBirth", event.target.value)
                    }
                    placeholder="1998"
                  />
                </Field>
                <Field label="Current location sharing">
                  <Select
                    value={form.personal.currentLocation}
                    onChange={(event) =>
                      setSectionValue("personal", "currentLocation", event.target.value)
                    }
                  >
                    <option value="">Not set</option>
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </Select>
                </Field>
                <Field label="Kids names">
                  <Input
                    value={form.personal.kidsNames}
                    onChange={(event) =>
                      setSectionValue("personal", "kidsNames", event.target.value)
                    }
                    placeholder="None"
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
                      setSectionValue("personal", "relationshipStatus", event.target.value)
                    }
                  />
                </Field>
                <Field label="Blood group">
                  <Input
                    value={form.personal.bloodGroup}
                    onChange={(event) =>
                      setSectionValue("personal", "bloodGroup", event.target.value)
                    }
                    placeholder="O+"
                  />
                </Field>
              </TwoColumn>
              <AddressFields
                title="Postal address"
                address={form.personal.postalAddress}
                onChange={(key, value) => setAddressValue("personal", key, value)}
              />
              <Field label="Label">
                <Input
                  value={form.personal.tag}
                  onChange={(event) => setSectionValue("personal", "tag", event.target.value)}
                />
              </Field>
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
                    <Field label="Company logo URL">
                      <Input
                        value={row.companyLogo}
                        onChange={(event) =>
                          setWorkValue(index, "companyLogo", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Company registration number">
                      <Input
                        value={row.companyRegNumber}
                        onChange={(event) =>
                          setWorkValue(index, "companyRegNumber", event.target.value)
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
                    <Field label="Work email">
                      <Input
                        type="email"
                        value={row.workEmail}
                        onChange={(event) =>
                          setWorkValue(index, "workEmail", event.target.value)
                        }
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
                  <AddressFields
                    title="Work postal address"
                    address={row.workPostalAddress}
                    onChange={(key, value) => setWorkAddressValue(index, key, value)}
                  />
                  <Field label="Label">
                    <Input
                      value={row.tag}
                      onChange={(event) =>
                        setWorkValue(index, "tag", event.target.value)
                      }
                    />
                  </Field>
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
                  title={`Business ${index + 1}`}
                  onRemove={() => removeRow("business", index, emptyBusiness)}
                >
                  <TwoColumn>
                    <Field label="Business name">
                      <Input
                        value={row.businessName}
                        onChange={(event) =>
                          setBusinessValue(index, "businessName", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Business logo URL">
                      <Input
                        value={row.businessLogo}
                        onChange={(event) =>
                          setBusinessValue(index, "businessLogo", event.target.value)
                        }
                      />
                    </Field>
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
                          setBusinessValue(index, "businessTitle", event.target.value)
                        }
                      />
                    </Field>
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
                    <Field label="Business fax">
                      <Input
                        value={row.businessFax}
                        onChange={(event) =>
                          setBusinessValue(index, "businessFax", event.target.value)
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
                  <AddressFields
                    title="Business postal address"
                    address={row.businessPostalAddress}
                    onChange={(key, value) =>
                      setBusinessAddressValue(index, key, value)
                    }
                  />
                  <Field label="Label">
                    <Input
                      value={row.tag}
                      onChange={(event) =>
                        setBusinessValue(index, "tag", event.target.value)
                      }
                    />
                  </Field>
                </RepeatablePanel>
              ))}
            </ProfileSection>
          )}

          {!isLoadingProfile && !loadError && step.key === "socials" && (
            <ProfileSection>
              <SectionHeader
                actionLabel="Add social profile"
                onAdd={() => addRow("socials", emptySocials)}
              />
              {form.socials.map((row, index) => (
                <RepeatablePanel
                  key={row.groupId ?? `socials-${index}`}
                  canRemove={form.socials.length > 1}
                  title={`Social profile ${index + 1}`}
                  onRemove={() => removeRow("socials", index, emptySocials)}
                >
                  <TwoColumn>
                    <Field label="Skype">
                      <Input
                        value={row.skype}
                        onChange={(event) =>
                          setSocialValue(index, "skype", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Facebook">
                      <Input
                        value={row.facebook}
                        onChange={(event) =>
                          setSocialValue(index, "facebook", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Twitter">
                      <Input
                        value={row.twitter}
                        onChange={(event) =>
                          setSocialValue(index, "twitter", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="WhatsApp">
                      <Input
                        value={row.whatsapp}
                        onChange={(event) =>
                          setSocialValue(index, "whatsapp", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Blog">
                      <Input
                        value={row.blog}
                        onChange={(event) =>
                          setSocialValue(index, "blog", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Website">
                      <Input
                        value={row.website}
                        onChange={(event) =>
                          setSocialValue(index, "website", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="LinkedIn">
                      <Input
                        value={row.linkedin}
                        onChange={(event) =>
                          setSocialValue(index, "linkedin", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="GitHub">
                      <Input
                        value={row.github}
                        onChange={(event) =>
                          setSocialValue(index, "github", event.target.value)
                        }
                      />
                    </Field>
                  </TwoColumn>
                  <Field label="Label">
                    <Input
                      value={row.tag}
                      onChange={(event) =>
                        setSocialValue(index, "tag", event.target.value)
                      }
                    />
                  </Field>
                </RepeatablePanel>
              ))}
            </ProfileSection>
          )}

          {!isLoadingProfile && !loadError && step.key === "financial" && (
            <ProfileSection>
              <FinancialGroupHeader
                title="Bank accounts"
                actionLabel="Add bank account"
                onAdd={() => addFinancialRow("bankAccounts", emptyBank)}
              />
              {form.financial.bankAccounts.map((row, index) => (
                <SensitivePanel
                  key={row.fieldId ?? row.groupId ?? `bank-${index}`}
                  canRemove={form.financial.bankAccounts.length > 1}
                  title={`Bank account ${index + 1}`}
                  onRemove={() =>
                    removeFinancialRow("bankAccounts", index, emptyBank)
                  }
                >
                  <TwoColumn>
                    <Field label="Bank name">
                      <Input
                        value={row.bankName}
                        onChange={(event) =>
                          setFinancialRowValue(
                            "bankAccounts",
                            index,
                            "bankName",
                            event.target.value,
                          )
                        }
                      />
                    </Field>
                    <Field label="Account holder">
                      <Input
                        value={row.accountHolder}
                        onChange={(event) =>
                          setFinancialRowValue(
                            "bankAccounts",
                            index,
                            "accountHolder",
                            event.target.value,
                          )
                        }
                      />
                    </Field>
                    <Field label="Account number">
                      <Input
                        value={row.accountNumber}
                        onChange={(event) =>
                          setFinancialRowValue(
                            "bankAccounts",
                            index,
                            "accountNumber",
                            event.target.value,
                          )
                        }
                      />
                    </Field>
                    <Field label="IBAN">
                      <Input
                        value={row.iban}
                        onChange={(event) =>
                          setFinancialRowValue(
                            "bankAccounts",
                            index,
                            "iban",
                            event.target.value,
                          )
                        }
                      />
                    </Field>
                    <Field label="SWIFT/BIC">
                      <Input
                        value={row.swiftBic}
                        onChange={(event) =>
                          setFinancialRowValue(
                            "bankAccounts",
                            index,
                            "swiftBic",
                            event.target.value,
                          )
                        }
                      />
                    </Field>
                    <Field label="Routing number">
                      <Input
                        value={row.routingNumber}
                        onChange={(event) =>
                          setFinancialRowValue(
                            "bankAccounts",
                            index,
                            "routingNumber",
                            event.target.value,
                          )
                        }
                      />
                    </Field>
                    <Field label="IFSC">
                      <Input
                        value={row.ifsc}
                        onChange={(event) =>
                          setFinancialRowValue(
                            "bankAccounts",
                            index,
                            "ifsc",
                            event.target.value,
                          )
                        }
                      />
                    </Field>
                    <Field label="Currency">
                      <Input
                        value={row.currency}
                        onChange={(event) =>
                          setFinancialRowValue(
                            "bankAccounts",
                            index,
                            "currency",
                            event.target.value,
                          )
                        }
                      />
                    </Field>
                    <Field label="Label">
                      <Input
                        value={row.tag}
                        onChange={(event) =>
                          setFinancialRowValue(
                            "bankAccounts",
                            index,
                            "tag",
                            event.target.value,
                          )
                        }
                      />
                    </Field>
                  </TwoColumn>
                </SensitivePanel>
              ))}

              <FinancialGroupHeader
                title="Digital wallets"
                actionLabel="Add wallet"
                onAdd={() => addFinancialRow("digitalWallets", emptyWallet)}
              />
              {form.financial.digitalWallets.map((row, index) => (
                <SensitivePanel
                  key={row.fieldId ?? row.groupId ?? `wallet-${index}`}
                  canRemove={form.financial.digitalWallets.length > 1}
                  title={`Digital wallet ${index + 1}`}
                  onRemove={() =>
                    removeFinancialRow("digitalWallets", index, emptyWallet)
                  }
                >
                  <TwoColumn>
                    <Field label="Platform">
                      <Input
                        value={row.platform}
                        onChange={(event) =>
                          setFinancialRowValue(
                            "digitalWallets",
                            index,
                            "platform",
                            event.target.value,
                          )
                        }
                      />
                    </Field>
                    <Field label="Handle or link">
                      <Input
                        value={row.handleOrLink}
                        onChange={(event) =>
                          setFinancialRowValue(
                            "digitalWallets",
                            index,
                            "handleOrLink",
                            event.target.value,
                          )
                        }
                      />
                    </Field>
                    <Field label="Label">
                      <Input
                        value={row.tag}
                        onChange={(event) =>
                          setFinancialRowValue(
                            "digitalWallets",
                            index,
                            "tag",
                            event.target.value,
                          )
                        }
                      />
                    </Field>
                  </TwoColumn>
                </SensitivePanel>
              ))}

              <FinancialGroupHeader
                title="Crypto wallets"
                actionLabel="Add crypto wallet"
                onAdd={() => addFinancialRow("cryptoWallets", emptyCrypto)}
              />
              {form.financial.cryptoWallets.map((row, index) => (
                <SensitivePanel
                  key={row.fieldId ?? row.groupId ?? `crypto-${index}`}
                  canRemove={form.financial.cryptoWallets.length > 1}
                  title={`Crypto wallet ${index + 1}`}
                  onRemove={() =>
                    removeFinancialRow("cryptoWallets", index, emptyCrypto)
                  }
                >
                  <TwoColumn>
                    <Field label="Network">
                      <Input
                        value={row.network}
                        onChange={(event) =>
                          setFinancialRowValue(
                            "cryptoWallets",
                            index,
                            "network",
                            event.target.value,
                          )
                        }
                      />
                    </Field>
                    <Field label="Address">
                      <Input
                        value={row.address}
                        onChange={(event) =>
                          setFinancialRowValue(
                            "cryptoWallets",
                            index,
                            "address",
                            event.target.value,
                          )
                        }
                      />
                    </Field>
                    <Field label="Label">
                      <Input
                        value={row.tag}
                        onChange={(event) =>
                          setFinancialRowValue(
                            "cryptoWallets",
                            index,
                            "tag",
                            event.target.value,
                          )
                        }
                      />
                    </Field>
                  </TwoColumn>
                </SensitivePanel>
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
                  disabled={controlsDisabled}
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

function FinancialGroupHeader({
  actionLabel,
  onAdd,
  title,
}: {
  actionLabel: string;
  onAdd: () => void;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold">{title}</p>
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
  onClear,
  onUpload,
  value,
}: {
  onClear: () => void;
  onUpload: (file: File | undefined) => void;
  value: string;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
            {value ? (
              <img src={value} alt="" className="h-full w-full object-cover" />
            ) : (
              <UploadCloud className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">Profile photo</p>
            <p className="mt-1 text-sm text-muted-foreground">Upload an image under 1 MB.</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" className="relative overflow-hidden">
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            Upload
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(event) => {
                onUpload(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </Button>
          {value && (
            <Button type="button" variant="ghost" onClick={onClear}>
              <X className="h-4 w-4" aria-hidden="true" />
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

function TwoColumn({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function AddressFields({
  title,
  address,
  onChange,
}: {
  title: string;
  address: AddressForm;
  onChange: (key: keyof AddressForm, value: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <p className="text-sm font-semibold">{title}</p>
      <TwoColumn>
        <Field label="Street">
          <Input value={address.street} onChange={(event) => onChange("street", event.target.value)} />
        </Field>
        <Field label="City">
          <Input value={address.city} onChange={(event) => onChange("city", event.target.value)} />
        </Field>
        <Field label="State">
          <Input value={address.state} onChange={(event) => onChange("state", event.target.value)} />
        </Field>
        <Field label="Pincode">
          <Input
            value={address.pincode}
            onChange={(event) => onChange("pincode", event.target.value)}
          />
        </Field>
        <Field label="Country">
          <Input
            value={address.country}
            onChange={(event) => onChange("country", event.target.value)}
          />
        </Field>
      </TwoColumn>
    </div>
  );
}

function SensitivePanel({
  canRemove,
  title,
  children,
  onRemove,
}: {
  canRemove: boolean;
  title: string;
  children: ReactNode;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">{title}</p>
          <Badge variant="warning">Sensitive</Badge>
        </div>
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
