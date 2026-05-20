import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
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
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  currency: string;
};

type WalletForm = {
  platform: string;
  handleOrLink: string;
};

type CryptoForm = {
  network: string;
  address: string;
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
  work: {
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
  business: {
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
  socials: {
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
  financial: {
    bankTag: string;
    bank: BankForm;
    walletTag: string;
    wallet: WalletForm;
    cryptoTag: string;
    crypto: CryptoForm;
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
    primaryEmail?: string;
    profilePhoto?: string | null;
  };
  personal?: {
    tag?: string;
    postalAddress?: AddressPayload;
    mobile?: string;
    landline?: string;
    email?: string;
    dateOfBirth?: string;
    yearOfBirth?: string;
    currentLocation?: string;
    relationshipStatus?: string;
    custom?: Record<string, string>;
  };
  work?: Array<{
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
    tag?: string;
    custom?: Record<string, string>;
  }>;
  financial?: {
    bankAccounts?: Array<{
      tag?: string;
      bankName?: string;
      accountHolder?: string;
      accountNumber?: string;
      ifsc?: string;
      currency?: string;
    }>;
    digitalWallets?: Array<{
      tag?: string;
      platform: string;
      handleOrLink: string;
    }>;
    cryptoWallets?: Array<{
      tag?: string;
      network: string;
      address: string;
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
  work: {
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
  },
  business: {
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
  },
  socials: {
    tag: "Main Digital Presence",
    skype: "",
    facebook: "",
    twitter: "",
    whatsapp: "",
    blog: "",
    website: "",
    linkedin: "",
    github: "",
  },
  financial: {
    bankTag: "Bank account",
    bank: {
      bankName: "",
      accountHolder: "",
      accountNumber: "",
      ifsc: "",
      currency: "INR",
    },
    walletTag: "Digital wallet",
    wallet: {
      platform: "",
      handleOrLink: "",
    },
    cryptoTag: "Crypto wallet",
    crypto: {
      network: "",
      address: "",
    },
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

function validateAddress(label: string, address: AddressForm): string | null {
  if (!addressHasAny(address)) {
    return null;
  }
  if (!hasText(address.street) || !hasText(address.city) || !hasText(address.country)) {
    return `${label} needs street, city, and country.`;
  }
  return null;
}

function optionalText(value: string): string | undefined {
  const next = clean(value);
  return next || undefined;
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

function profileToForm(profile: ProfileMeResponse): OnboardingForm {
  const work = profile.work[0];
  const business = profile.business[0];
  const socials = profile.socials[0];
  const bank = profile.financial.bankAccounts[0];
  const wallet = profile.financial.digitalWallets[0];
  const crypto = profile.financial.cryptoWallets[0];

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
    work: {
      ...initialForm.work,
      tag: valueOrEmpty(work?.tag) || initialForm.work.tag,
      companyName: valueOrEmpty(work?.companyName),
      companyLogo: valueOrEmpty(work?.companyLogo),
      companyRegNumber: valueOrEmpty(work?.companyRegNumber),
      workTitle: valueOrEmpty(work?.workTitle),
      workMobile: valueOrEmpty(work?.workMobile),
      workLandline: valueOrEmpty(work?.workLandline),
      workFax: valueOrEmpty(work?.workFax),
      workEmail: valueOrEmpty(work?.workEmail),
      workPostalAddress: addressToForm(work?.workPostalAddress),
      employeeId: customValue(work?.custom, "employeeId"),
    },
    business: {
      ...initialForm.business,
      tag: valueOrEmpty(business?.tag) || initialForm.business.tag,
      businessName: valueOrEmpty(business?.businessName),
      businessLogo: valueOrEmpty(business?.businessLogo),
      businessRegNumber: valueOrEmpty(business?.businessRegNumber),
      businessTitle: valueOrEmpty(business?.businessTitle),
      businessMobile: valueOrEmpty(business?.businessMobile),
      businessLandline: valueOrEmpty(business?.businessLandline),
      businessFax: valueOrEmpty(business?.businessFax),
      businessEmail: valueOrEmpty(business?.businessEmail),
      businessPostalAddress: addressToForm(business?.businessPostalAddress),
      businessType: customValue(business?.custom, "businessType"),
      gstin: customValue(business?.custom, "gstin"),
    },
    socials: {
      ...initialForm.socials,
      tag: valueOrEmpty(socials?.tag) || initialForm.socials.tag,
      skype: customValue(socials?.custom, "skype"),
      facebook: customValue(socials?.custom, "facebook"),
      twitter: customValue(socials?.custom, "twitter"),
      whatsapp:
        customValue(socials?.custom, "whatsApp") ||
        customValue(socials?.custom, "whatsapp"),
      blog: customValue(socials?.custom, "blog"),
      website: customValue(socials?.custom, "website"),
      linkedin: customValue(socials?.custom, "linkedin"),
      github: customValue(socials?.custom, "github"),
    },
    financial: {
      bankTag: valueOrEmpty(bank?.tag) || initialForm.financial.bankTag,
      bank: {
        bankName: valueOrEmpty(bank?.bankName),
        accountHolder: valueOrEmpty(bank?.accountHolder),
        accountNumber: valueOrEmpty(bank?.accountNumber),
        ifsc: valueOrEmpty(bank?.ifsc),
        currency: valueOrEmpty(bank?.currency) || initialForm.financial.bank.currency,
      },
      walletTag: valueOrEmpty(wallet?.tag) || initialForm.financial.walletTag,
      wallet: {
        platform: valueOrEmpty(wallet?.platform),
        handleOrLink: valueOrEmpty(wallet?.handleOrLink),
      },
      cryptoTag: valueOrEmpty(crypto?.tag) || initialForm.financial.cryptoTag,
      crypto: {
        network: valueOrEmpty(crypto?.network),
        address: valueOrEmpty(crypto?.address),
      },
    },
  };
}

const MAX_PROFILE_PHOTO_BYTES = 1024 * 1024;

function hasInitializedProfile(profile: ProfileMeResponse) {
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
          setForm(profileToForm(profile));
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

  const setSectionValue = <Section extends keyof OnboardingForm>(
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
    section: "personal" | "work" | "business",
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
      work:
        section === "work"
          ? {
              ...current.work,
              workPostalAddress: { ...current.work.workPostalAddress, [key]: value },
            }
          : current.work,
      business:
        section === "business"
          ? {
              ...current.business,
              businessPostalAddress: {
                ...current.business.businessPostalAddress,
                [key]: value,
              },
            }
          : current.business,
    }));
  };

  const setFinancialValue = (
    bucket: "bank" | "wallet" | "crypto",
    key: string,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      financial: {
        ...current.financial,
        [bucket]: {
          ...current.financial[bucket],
          [key]: value,
        },
      },
    }));
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

    const addressError =
      validateAddress("Personal address", form.personal.postalAddress) ??
      validateAddress("Work address", form.work.workPostalAddress) ??
      validateAddress("Business address", form.business.businessPostalAddress);
    if (addressError) {
      return addressError;
    }

    const walletTouched = hasAny([
      form.financial.wallet.platform,
      form.financial.wallet.handleOrLink,
    ]);
    if (
      walletTouched &&
      (!hasText(form.financial.wallet.platform) ||
        !hasText(form.financial.wallet.handleOrLink))
    ) {
      return "Digital wallet needs platform and handle or link.";
    }

    const cryptoTouched = hasAny([
      form.financial.crypto.network,
      form.financial.crypto.address,
    ]);
    if (
      cryptoTouched &&
      (!hasText(form.financial.crypto.network) || !hasText(form.financial.crypto.address))
    ) {
      return "Crypto wallet needs network and address.";
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

    const workCustom = compactCustom({ employeeId: form.work.employeeId });
    const hasWorkDetails =
      Boolean(workCustom) ||
      hasAny([
        form.work.companyName,
        form.work.companyLogo,
        form.work.companyRegNumber,
        form.work.workTitle,
        form.work.workMobile,
        form.work.workLandline,
        form.work.workFax,
        form.work.workEmail,
      ]) ||
      addressHasAny(form.work.workPostalAddress);
    const work = compactObject({
      tag: optionalText(form.work.tag),
      companyName: optionalText(form.work.companyName),
      companyLogo: optionalText(form.work.companyLogo),
      companyRegNumber: optionalText(form.work.companyRegNumber),
      workTitle: optionalText(form.work.workTitle),
      workMobile: optionalText(form.work.workMobile),
      workLandline: optionalText(form.work.workLandline),
      workFax: optionalText(form.work.workFax),
      workEmail: optionalText(form.work.workEmail),
      workPostalAddress: addressHasAny(form.work.workPostalAddress)
        ? toAddressPayload(form.work.workPostalAddress)
        : undefined,
      custom: workCustom,
    });
    if (hasWorkDetails) {
      payload.work = [work];
    }

    const businessCustom = compactCustom({
      businessType: form.business.businessType,
      gstin: form.business.gstin,
    });
    const hasBusinessDetails =
      Boolean(businessCustom) ||
      hasAny([
        form.business.businessName,
        form.business.businessLogo,
        form.business.businessRegNumber,
        form.business.businessTitle,
        form.business.businessMobile,
        form.business.businessLandline,
        form.business.businessFax,
        form.business.businessEmail,
      ]) ||
      addressHasAny(form.business.businessPostalAddress);
    const business = compactObject({
      tag: optionalText(form.business.tag),
      businessName: optionalText(form.business.businessName),
      businessLogo: optionalText(form.business.businessLogo),
      businessRegNumber: optionalText(form.business.businessRegNumber),
      businessTitle: optionalText(form.business.businessTitle),
      businessMobile: optionalText(form.business.businessMobile),
      businessLandline: optionalText(form.business.businessLandline),
      businessFax: optionalText(form.business.businessFax),
      businessEmail: optionalText(form.business.businessEmail),
      businessPostalAddress: addressHasAny(form.business.businessPostalAddress)
        ? toAddressPayload(form.business.businessPostalAddress)
        : undefined,
      custom: businessCustom,
    });
    if (hasBusinessDetails) {
      payload.business = [business];
    }

    const socialsCustom = compactCustom({
      skype: form.socials.skype,
      facebook: form.socials.facebook,
      twitter: form.socials.twitter,
      whatsApp: form.socials.whatsapp,
      blog: form.socials.blog,
      website: form.socials.website,
      linkedin: form.socials.linkedin,
      github: form.socials.github,
    });
    if (socialsCustom) {
      payload.socials = [
        {
          tag: optionalText(form.socials.tag),
          custom: socialsCustom,
        },
      ];
    }

    const financial: NonNullable<ProfileOnboardingPayload["financial"]> = {};
    const bank = form.financial.bank;
    if (hasAny([bank.bankName, bank.accountHolder, bank.accountNumber, bank.ifsc])) {
      financial.bankAccounts = [
        {
          tag: optionalText(form.financial.bankTag),
          bankName: optionalText(bank.bankName),
          accountHolder: optionalText(bank.accountHolder),
          accountNumber: optionalText(bank.accountNumber),
          ifsc: optionalText(bank.ifsc),
          currency: optionalText(bank.currency),
        },
      ];
    }

    const wallet = form.financial.wallet;
    if (hasAny([wallet.platform, wallet.handleOrLink])) {
      financial.digitalWallets = [
        {
          tag: optionalText(form.financial.walletTag),
          platform: clean(wallet.platform),
          handleOrLink: clean(wallet.handleOrLink),
        },
      ];
    }

    const crypto = form.financial.crypto;
    if (hasAny([crypto.network, crypto.address])) {
      financial.cryptoWallets = [
        {
          tag: optionalText(form.financial.cryptoTag),
          network: clean(crypto.network),
          address: clean(crypto.address),
        },
      ];
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

  const saveProfile = async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    setIsSaving(true);
    try {
      const payload = buildProfilePayload();
      const sectionKeys = Object.keys(payload).filter((key) => key !== "identity");
      const shouldInitialize = sectionKeys.length > 0 && !hasExistingProfile;
      try {
        if (shouldInitialize) {
          const { identity, ...onboardingSections } = payload;
          const onboardingPayload: ProfileOnboardingPayload = { ...onboardingSections };
          if (identity?.profilePhoto !== undefined) {
            onboardingPayload.identity = { profilePhoto: identity.profilePhoto };
          }

          await apiFetch<unknown>("/v1/profile/onboarding", {
            method: "POST",
            body: onboardingPayload,
          });

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
              <Field label="Group tag">
                <Input
                  value={form.personal.tag}
                  onChange={(event) => setSectionValue("personal", "tag", event.target.value)}
                />
              </Field>
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
            </ProfileSection>
          )}

          {!isLoadingProfile && !loadError && step.key === "work" && (
            <ProfileSection>
              <Field label="Group tag">
                <Input
                  value={form.work.tag}
                  onChange={(event) => setSectionValue("work", "tag", event.target.value)}
                />
              </Field>
              <TwoColumn>
                <Field label="Company name">
                  <Input
                    value={form.work.companyName}
                    onChange={(event) =>
                      setSectionValue("work", "companyName", event.target.value)
                    }
                  />
                </Field>
                <Field label="Company logo URL">
                  <Input
                    value={form.work.companyLogo}
                    onChange={(event) =>
                      setSectionValue("work", "companyLogo", event.target.value)
                    }
                  />
                </Field>
                <Field label="Company registration number">
                  <Input
                    value={form.work.companyRegNumber}
                    onChange={(event) =>
                      setSectionValue("work", "companyRegNumber", event.target.value)
                    }
                  />
                </Field>
                <Field label="Work title">
                  <Input
                    value={form.work.workTitle}
                    onChange={(event) =>
                      setSectionValue("work", "workTitle", event.target.value)
                    }
                  />
                </Field>
                <Field label="Work mobile">
                  <Input
                    value={form.work.workMobile}
                    onChange={(event) =>
                      setSectionValue("work", "workMobile", event.target.value)
                    }
                  />
                </Field>
                <Field label="Work landline">
                  <Input
                    value={form.work.workLandline}
                    onChange={(event) =>
                      setSectionValue("work", "workLandline", event.target.value)
                    }
                  />
                </Field>
                <Field label="Work fax">
                  <Input
                    value={form.work.workFax}
                    onChange={(event) =>
                      setSectionValue("work", "workFax", event.target.value)
                    }
                  />
                </Field>
                <Field label="Work email">
                  <Input
                    type="email"
                    value={form.work.workEmail}
                    onChange={(event) =>
                      setSectionValue("work", "workEmail", event.target.value)
                    }
                  />
                </Field>
                <Field label="Employee ID">
                  <Input
                    value={form.work.employeeId}
                    onChange={(event) =>
                      setSectionValue("work", "employeeId", event.target.value)
                    }
                  />
                </Field>
              </TwoColumn>
              <AddressFields
                title="Work postal address"
                address={form.work.workPostalAddress}
                onChange={(key, value) => setAddressValue("work", key, value)}
              />
            </ProfileSection>
          )}

          {!isLoadingProfile && !loadError && step.key === "business" && (
            <ProfileSection>
              <Field label="Group tag">
                <Input
                  value={form.business.tag}
                  onChange={(event) =>
                    setSectionValue("business", "tag", event.target.value)
                  }
                />
              </Field>
              <TwoColumn>
                <Field label="Business name">
                  <Input
                    value={form.business.businessName}
                    onChange={(event) =>
                      setSectionValue("business", "businessName", event.target.value)
                    }
                  />
                </Field>
                <Field label="Business logo URL">
                  <Input
                    value={form.business.businessLogo}
                    onChange={(event) =>
                      setSectionValue("business", "businessLogo", event.target.value)
                    }
                  />
                </Field>
                <Field label="Business registration number">
                  <Input
                    value={form.business.businessRegNumber}
                    onChange={(event) =>
                      setSectionValue("business", "businessRegNumber", event.target.value)
                    }
                  />
                </Field>
                <Field label="Business title">
                  <Input
                    value={form.business.businessTitle}
                    onChange={(event) =>
                      setSectionValue("business", "businessTitle", event.target.value)
                    }
                  />
                </Field>
                <Field label="Business mobile">
                  <Input
                    value={form.business.businessMobile}
                    onChange={(event) =>
                      setSectionValue("business", "businessMobile", event.target.value)
                    }
                  />
                </Field>
                <Field label="Business landline">
                  <Input
                    value={form.business.businessLandline}
                    onChange={(event) =>
                      setSectionValue("business", "businessLandline", event.target.value)
                    }
                  />
                </Field>
                <Field label="Business fax">
                  <Input
                    value={form.business.businessFax}
                    onChange={(event) =>
                      setSectionValue("business", "businessFax", event.target.value)
                    }
                  />
                </Field>
                <Field label="Business email">
                  <Input
                    type="email"
                    value={form.business.businessEmail}
                    onChange={(event) =>
                      setSectionValue("business", "businessEmail", event.target.value)
                    }
                  />
                </Field>
                <Field label="Business type">
                  <Input
                    value={form.business.businessType}
                    onChange={(event) =>
                      setSectionValue("business", "businessType", event.target.value)
                    }
                  />
                </Field>
                <Field label="GSTIN">
                  <Input
                    value={form.business.gstin}
                    onChange={(event) =>
                      setSectionValue("business", "gstin", event.target.value)
                    }
                  />
                </Field>
              </TwoColumn>
              <AddressFields
                title="Business postal address"
                address={form.business.businessPostalAddress}
                onChange={(key, value) => setAddressValue("business", key, value)}
              />
            </ProfileSection>
          )}

          {!isLoadingProfile && !loadError && step.key === "socials" && (
            <ProfileSection>
              <Field label="Group tag">
                <Input
                  value={form.socials.tag}
                  onChange={(event) => setSectionValue("socials", "tag", event.target.value)}
                />
              </Field>
              <TwoColumn>
                <Field label="Skype">
                  <Input
                    value={form.socials.skype}
                    onChange={(event) =>
                      setSectionValue("socials", "skype", event.target.value)
                    }
                  />
                </Field>
                <Field label="Facebook">
                  <Input
                    value={form.socials.facebook}
                    onChange={(event) =>
                      setSectionValue("socials", "facebook", event.target.value)
                    }
                  />
                </Field>
                <Field label="Twitter">
                  <Input
                    value={form.socials.twitter}
                    onChange={(event) =>
                      setSectionValue("socials", "twitter", event.target.value)
                    }
                  />
                </Field>
                <Field label="WhatsApp">
                  <Input
                    value={form.socials.whatsapp}
                    onChange={(event) =>
                      setSectionValue("socials", "whatsapp", event.target.value)
                    }
                  />
                </Field>
                <Field label="Blog">
                  <Input
                    value={form.socials.blog}
                    onChange={(event) =>
                      setSectionValue("socials", "blog", event.target.value)
                    }
                  />
                </Field>
                <Field label="Website">
                  <Input
                    value={form.socials.website}
                    onChange={(event) =>
                      setSectionValue("socials", "website", event.target.value)
                    }
                  />
                </Field>
                <Field label="LinkedIn">
                  <Input
                    value={form.socials.linkedin}
                    onChange={(event) =>
                      setSectionValue("socials", "linkedin", event.target.value)
                    }
                  />
                </Field>
                <Field label="GitHub">
                  <Input
                    value={form.socials.github}
                    onChange={(event) =>
                      setSectionValue("socials", "github", event.target.value)
                    }
                  />
                </Field>
              </TwoColumn>
            </ProfileSection>
          )}

          {!isLoadingProfile && !loadError && step.key === "financial" && (
            <ProfileSection>
              <div className="grid gap-3 xl:grid-cols-3">
                <SensitivePanel title="Bank account">
                  <Field label="Group tag">
                    <Input
                      value={form.financial.bankTag}
                      onChange={(event) =>
                        setSectionValue("financial", "bankTag", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Bank name">
                    <Input
                      value={form.financial.bank.bankName}
                      onChange={(event) =>
                        setFinancialValue("bank", "bankName", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Account holder">
                    <Input
                      value={form.financial.bank.accountHolder}
                      onChange={(event) =>
                        setFinancialValue("bank", "accountHolder", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Account number">
                    <Input
                      value={form.financial.bank.accountNumber}
                      onChange={(event) =>
                        setFinancialValue("bank", "accountNumber", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="IFSC">
                    <Input
                      value={form.financial.bank.ifsc}
                      onChange={(event) =>
                        setFinancialValue("bank", "ifsc", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Currency">
                    <Input
                      value={form.financial.bank.currency}
                      onChange={(event) =>
                        setFinancialValue("bank", "currency", event.target.value)
                      }
                    />
                  </Field>
                </SensitivePanel>
                <SensitivePanel title="Digital wallet">
                  <Field label="Group tag">
                    <Input
                      value={form.financial.walletTag}
                      onChange={(event) =>
                        setSectionValue("financial", "walletTag", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Platform">
                    <Input
                      value={form.financial.wallet.platform}
                      onChange={(event) =>
                        setFinancialValue("wallet", "platform", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Handle or link">
                    <Input
                      value={form.financial.wallet.handleOrLink}
                      onChange={(event) =>
                        setFinancialValue("wallet", "handleOrLink", event.target.value)
                      }
                    />
                  </Field>
                </SensitivePanel>
                <SensitivePanel title="Crypto wallet">
                  <Field label="Group tag">
                    <Input
                      value={form.financial.cryptoTag}
                      onChange={(event) =>
                        setSectionValue("financial", "cryptoTag", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Network">
                    <Input
                      value={form.financial.crypto.network}
                      onChange={(event) =>
                        setFinancialValue("crypto", "network", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Address">
                    <Input
                      value={form.financial.crypto.address}
                      onChange={(event) =>
                        setFinancialValue("crypto", "address", event.target.value)
                      }
                    />
                  </Field>
                </SensitivePanel>
              </div>
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
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{title}</p>
        <Badge variant="warning">Sensitive</Badge>
      </div>
      {children}
    </div>
  );
}
