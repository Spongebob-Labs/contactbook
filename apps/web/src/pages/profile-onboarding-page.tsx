import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Check,
  Landmark,
  LinkIcon,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type FieldGroupCategory =
  | "IDENTITY"
  | "PERSONAL"
  | "WORK"
  | "BUSINESS"
  | "SOCIAL"
  | "FINANCIAL";

type ProfileFieldType =
  | "PHONE"
  | "LANDLINE"
  | "FAX"
  | "EMAIL"
  | "ADDRESS"
  | "URL"
  | "SOCIAL_LINK"
  | "PHOTO"
  | "TEXT"
  | "DATE"
  | "JOB_TITLE"
  | "COMPANY"
  | "REG_NUMBER"
  | "RELATION"
  | "STATUS"
  | "LOCATION_TRACKING"
  | "BANK_ACCOUNT"
  | "DIGITAL_WALLET"
  | "CRYPTO_WALLET"
  | "CUSTOM";

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

type CreateGroupResponse = {
  id: string;
};

type CreateFieldPayload = {
  type: ProfileFieldType;
  label?: string;
  isSensitive?: boolean;
  value?: string;
  address?: {
    street: string;
    city: string;
    state?: string;
    pincode?: string;
    country: string;
  };
  bankAccount?: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    ifsc?: string;
    currency?: string;
  };
  digitalWallet?: {
    platform: string;
    handleOrLink: string;
  };
  cryptoWallet?: {
    network: string;
    address: string;
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
    key: "identity",
    title: "Identity",
    description: "Add the visual identity details people recognize first.",
    icon: UserRound,
  },
  {
    key: "personal",
    title: "Personal",
    description: "Capture the personal details you may choose to share.",
    icon: ShieldCheck,
  },
  {
    key: "work",
    title: "Work",
    description: "Add your current professional profile.",
    icon: BriefcaseBusiness,
  },
  {
    key: "business",
    title: "Business",
    description: "Show business ownership or public company details.",
    icon: Building2,
  },
  {
    key: "socials",
    title: "Socials",
    description: "Connect your public digital presence.",
    icon: LinkIcon,
  },
  {
    key: "financial",
    title: "Financial",
    description: "Store sensitive payment rails securely.",
    icon: Landmark,
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

function toAddressPayload(address: AddressForm): CreateFieldPayload["address"] {
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

function textField(
  type: ProfileFieldType,
  label: string,
  value: string,
  isSensitive = false,
): CreateFieldPayload | null {
  const next = clean(value);
  if (!next) {
    return null;
  }
  return { type, label, value: next, isSensitive };
}

function compactFields(fields: Array<CreateFieldPayload | null>): CreateFieldPayload[] {
  return fields.filter((field): field is CreateFieldPayload => Boolean(field));
}

async function createGroup(
  category: FieldGroupCategory,
  name: string,
): Promise<CreateGroupResponse> {
  return apiFetch<CreateGroupResponse>("/v1/profile/field-groups", {
    method: "POST",
    body: { category, name },
  });
}

async function createField(groupId: string, field: CreateFieldPayload): Promise<void> {
  await apiFetch<unknown>(`/v1/profile/field-groups/${groupId}/fields`, {
    method: "POST",
    body: field,
  });
}

async function saveGroup(
  category: FieldGroupCategory,
  name: string,
  fields: CreateFieldPayload[],
): Promise<void> {
  if (fields.length === 0) {
    return;
  }
  const group = await createGroup(category, name);
  for (const field of fields) {
    await createField(group.id, field);
  }
}

export default function ProfileOnboardingPage() {
  const [form, setForm] = useState<OnboardingForm>(initialForm);
  const [stepIndex, setStepIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();
  const step = steps[stepIndex];

  const completion = useMemo(() => {
    const sections = [
      hasText(form.identity.profilePhoto),
      hasAny([
        form.personal.title,
        form.personal.nickname,
        form.personal.mobile,
        form.personal.email,
        form.personal.dateOfBirth,
        form.personal.relationshipStatus,
        form.personal.bloodGroup,
      ]) || addressHasAny(form.personal.postalAddress),
      hasAny([
        form.work.companyName,
        form.work.workTitle,
        form.work.workEmail,
        form.work.employeeId,
      ]) || addressHasAny(form.work.workPostalAddress),
      hasAny([
        form.business.businessName,
        form.business.businessTitle,
        form.business.businessEmail,
        form.business.businessType,
      ]) || addressHasAny(form.business.businessPostalAddress),
      hasAny([
        form.socials.skype,
        form.socials.facebook,
        form.socials.twitter,
        form.socials.blog,
        form.socials.website,
        form.socials.linkedin,
        form.socials.github,
      ]),
      hasAny([
        form.financial.bank.bankName,
        form.financial.bank.accountHolder,
        form.financial.bank.accountNumber,
        form.financial.wallet.platform,
        form.financial.wallet.handleOrLink,
        form.financial.crypto.network,
        form.financial.crypto.address,
      ]),
    ];
    return sections.filter(Boolean).length;
  }, [form]);

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
    const addressError =
      validateAddress("Personal address", form.personal.postalAddress) ??
      validateAddress("Work address", form.work.workPostalAddress) ??
      validateAddress("Business address", form.business.businessPostalAddress);
    if (addressError) {
      return addressError;
    }

    const bankTouched = hasAny([
      form.financial.bank.bankName,
      form.financial.bank.accountHolder,
      form.financial.bank.accountNumber,
      form.financial.bank.ifsc,
      form.financial.bank.currency,
    ]);
    if (
      bankTouched &&
      (!hasText(form.financial.bank.bankName) ||
        !hasText(form.financial.bank.accountHolder) ||
        !hasText(form.financial.bank.accountNumber))
    ) {
      return "Bank account needs bank name, account holder, and account number.";
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

  const buildPersonalFields = (): CreateFieldPayload[] => {
    const fields = compactFields([
      textField("TEXT", "Title", form.personal.title),
      textField("TEXT", "Nickname", form.personal.nickname),
      textField("PHONE", "Mobile", form.personal.mobile),
      textField("LANDLINE", "Landline", form.personal.landline),
      textField("EMAIL", "Email", form.personal.email),
      textField("DATE", "Date of birth", form.personal.dateOfBirth),
      textField("TEXT", "Year of birth", form.personal.yearOfBirth),
      textField("LOCATION_TRACKING", "Current location", form.personal.currentLocation),
      textField("TEXT", "Kids names", form.personal.kidsNames),
      textField("RELATION", "Partner name", form.personal.partnerName),
      textField("TEXT", "Pet names", form.personal.petNames),
      textField("STATUS", "Relationship status", form.personal.relationshipStatus),
      textField("CUSTOM", "Blood Group", form.personal.bloodGroup),
    ]);
    if (addressHasAny(form.personal.postalAddress)) {
      fields.push({
        type: "ADDRESS",
        label: "Postal address",
        address: toAddressPayload(form.personal.postalAddress),
      });
    }
    return fields;
  };

  const buildWorkFields = (): CreateFieldPayload[] => {
    const fields = compactFields([
      textField("COMPANY", "Company name", form.work.companyName),
      textField("PHOTO", "Company logo", form.work.companyLogo),
      textField("REG_NUMBER", "Company registration number", form.work.companyRegNumber),
      textField("JOB_TITLE", "Work title", form.work.workTitle),
      textField("PHONE", "Work mobile", form.work.workMobile),
      textField("LANDLINE", "Work landline", form.work.workLandline),
      textField("FAX", "Work fax", form.work.workFax),
      textField("EMAIL", "Work email", form.work.workEmail),
      textField("CUSTOM", "Employee ID", form.work.employeeId),
    ]);
    if (addressHasAny(form.work.workPostalAddress)) {
      fields.push({
        type: "ADDRESS",
        label: "Work postal address",
        address: toAddressPayload(form.work.workPostalAddress),
      });
    }
    return fields;
  };

  const buildBusinessFields = (): CreateFieldPayload[] => {
    const fields = compactFields([
      textField("COMPANY", "Business name", form.business.businessName),
      textField("PHOTO", "Business logo", form.business.businessLogo),
      textField("REG_NUMBER", "Business registration number", form.business.businessRegNumber),
      textField("JOB_TITLE", "Business title", form.business.businessTitle),
      textField("PHONE", "Business mobile", form.business.businessMobile),
      textField("LANDLINE", "Business landline", form.business.businessLandline),
      textField("FAX", "Business fax", form.business.businessFax),
      textField("EMAIL", "Business email", form.business.businessEmail),
      textField("CUSTOM", "Business Type", form.business.businessType),
      textField("CUSTOM", "GSTIN", form.business.gstin),
    ]);
    if (addressHasAny(form.business.businessPostalAddress)) {
      fields.push({
        type: "ADDRESS",
        label: "Business postal address",
        address: toAddressPayload(form.business.businessPostalAddress),
      });
    }
    return fields;
  };

  const buildSocialFields = (): CreateFieldPayload[] =>
    compactFields([
      textField("SOCIAL_LINK", "Skype", form.socials.skype),
      textField("SOCIAL_LINK", "Facebook", form.socials.facebook),
      textField("SOCIAL_LINK", "Twitter", form.socials.twitter),
      textField("SOCIAL_LINK", "WhatsApp", form.socials.whatsapp),
      textField("URL", "Blog", form.socials.blog),
      textField("URL", "Website", form.socials.website),
      textField("SOCIAL_LINK", "LinkedIn", form.socials.linkedin),
      textField("SOCIAL_LINK", "GitHub", form.socials.github),
    ]);

  const buildFinancialGroups = (): Array<{
    name: string;
    fields: CreateFieldPayload[];
  }> => {
    const groups: Array<{ name: string; fields: CreateFieldPayload[] }> = [];
    const bank = form.financial.bank;
    if (hasAny([bank.bankName, bank.accountHolder, bank.accountNumber, bank.ifsc])) {
      groups.push({
        name: clean(form.financial.bankTag) || "Bank account",
        fields: [
          {
            type: "BANK_ACCOUNT",
            label: "Bank account",
            isSensitive: true,
            bankAccount: {
              bankName: clean(bank.bankName),
              accountHolder: clean(bank.accountHolder),
              accountNumber: clean(bank.accountNumber),
              ifsc: clean(bank.ifsc) || undefined,
              currency: clean(bank.currency) || undefined,
            },
          },
        ],
      });
    }

    const wallet = form.financial.wallet;
    if (hasAny([wallet.platform, wallet.handleOrLink])) {
      groups.push({
        name: clean(form.financial.walletTag) || "Digital wallet",
        fields: [
          {
            type: "DIGITAL_WALLET",
            label: "Digital wallet",
            isSensitive: true,
            digitalWallet: {
              platform: clean(wallet.platform),
              handleOrLink: clean(wallet.handleOrLink),
            },
          },
        ],
      });
    }

    const crypto = form.financial.crypto;
    if (hasAny([crypto.network, crypto.address])) {
      groups.push({
        name: clean(form.financial.cryptoTag) || "Crypto wallet",
        fields: [
          {
            type: "CRYPTO_WALLET",
            label: "Crypto wallet",
            isSensitive: true,
            cryptoWallet: {
              network: clean(crypto.network),
              address: clean(crypto.address),
            },
          },
        ],
      });
    }
    return groups;
  };

  const saveProfile = async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    setIsSaving(true);
    try {
      await saveGroup(
        "IDENTITY",
        "Identity",
        compactFields([textField("PHOTO", "Profile photo", form.identity.profilePhoto)]),
      );
      await saveGroup(
        "PERSONAL",
        clean(form.personal.tag) || "Primary Personal Details",
        buildPersonalFields(),
      );
      await saveGroup("WORK", clean(form.work.tag) || "Current Work", buildWorkFields());
      await saveGroup(
        "BUSINESS",
        clean(form.business.tag) || "Primary Business",
        buildBusinessFields(),
      );
      await saveGroup(
        "SOCIAL",
        clean(form.socials.tag) || "Main Digital Presence",
        buildSocialFields(),
      );
      for (const group of buildFinancialGroups()) {
        await saveGroup("FINANCIAL", group.name, group.fields);
      }

      toast.success("Profile saved.");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const skipProfile = () => {
    toast.info("You can complete your profile later.");
    navigate("/dashboard", { replace: true });
  };

  return (
    <AppShell>
      <section className="flex min-h-[calc(100vh-7rem)] items-center justify-center py-4">
        <div className="flex max-h-[calc(100vh-8rem)] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl">
          <div className="border-b border-border px-5 py-4 md:px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Optional onboarding</Badge>
                  <Badge variant="success">
                    Step {stepIndex + 1} of {steps.length}
                  </Badge>
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-normal">
                  {step.title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={skipProfile}
                disabled={isSaving}
                className="self-start"
              >
                Skip for now
              </Button>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {steps.map((item, index) => {
                const isActive = index === stepIndex;
                const isComplete = index < stepIndex;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setStepIndex(index)}
                    className={cn(
                      "flex min-h-20 flex-col justify-between rounded-md border border-border bg-background p-3 text-left transition-colors hover:bg-muted",
                      isActive && "border-primary bg-secondary text-secondary-foreground",
                    )}
                    aria-current={isActive ? "step" : undefined}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <item.icon
                        className={cn(
                          "h-4 w-4 text-muted-foreground",
                          (isActive || isComplete) && "text-primary",
                        )}
                        aria-hidden="true"
                      />
                      {isComplete && (
                        <Check className="h-4 w-4 text-success" aria-hidden="true" />
                      )}
                    </span>
                    <span className="mt-3 text-sm font-medium">{item.title}</span>
                  </button>
                );
              })}
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              {completion} of {steps.length} sections have draft details.
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
          {step.key === "identity" && (
            <ProfileSection
              title="Identity details"
              description="Registration already covers your legal name, phone, and email. Add a profile photo URL if you want the profile to feel complete in demos."
            >
              <Field label="Profile photo URL">
                <Input
                  value={form.identity.profilePhoto}
                  onChange={(event) =>
                    setSectionValue("identity", "profilePhoto", event.target.value)
                  }
                  placeholder="https://storage.example.com/profile.jpg"
                />
              </Field>
            </ProfileSection>
          )}

          {step.key === "personal" && (
            <ProfileSection
              title="Personal profile"
              description="These details are optional. Fill what you want ContactBook to remember."
            >
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

          {step.key === "work" && (
            <ProfileSection title="Work profile" description="Add your current role and company.">
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

          {step.key === "business" && (
            <ProfileSection
              title="Business profile"
              description="Add founder, owner, or public company details."
            >
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

          {step.key === "socials" && (
            <ProfileSection
              title="Social presence"
              description="Add social links, handles, and public websites."
            >
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

          {step.key === "financial" && (
            <ProfileSection
              title="Financial details"
              description="Financial rows are treated as sensitive by the API. Fill only the payment rails you want to store."
            >
              <div className="grid gap-4 xl:grid-cols-3">
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

          <div className="flex flex-col gap-3 border-t border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
              disabled={stepIndex === 0 || isSaving}
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
                  disabled={isSaving}
                >
                  Next
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : (
                <Button type="button" onClick={() => void saveProfile()} disabled={isSaving}>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Save profile
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function ProfileSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-normal">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

function TwoColumn({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
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
    <div className="space-y-4 rounded-md border border-border p-4">
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
    <div className="space-y-4 rounded-md border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{title}</p>
        <Badge variant="warning">Sensitive</Badge>
      </div>
      {children}
    </div>
  );
}
