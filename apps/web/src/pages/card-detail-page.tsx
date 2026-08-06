import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Building2,
  CalendarDays,
  Copy,
  Download,
  Globe2,
  Hash,
  Image as ImageIcon,
  Landmark,
  Link as LinkIcon,
  Mail,
  MapPin,
  Phone,
  Share2,
  Smartphone,
  Trash2,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { LiveCardPreview } from "@/components/cards/live-card-preview";
import { MobileCardPreview } from "@/components/cards/mobile-card-preview";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MultiSelect,
  type MultiSelectOption,
} from "@/components/ui/multi-select";
import { Panel } from "@/components/ui/panel";
import { ShareSheet, type ShareSheetOptionId } from "@/components/ui/share-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { getCardDisplayDetails } from "@/lib/card-display";
import { listMappableFinancialFields } from "@/lib/card-field-options";
import {
  CARD_TEMPLATE_OPTIONS,
  DEFAULT_CARD_THEME,
  EMPTY_CARD_FIELDS,
  formatCardPhone,
  normalizeDialCode,
  resolveTemplate,
} from "@/lib/card-maker";
import { ApiError } from "@/lib/api";
import {
  addCardFieldMapping,
  deleteCard,
  generateCardVcard,
  getCard,
  listCardShares,
  removeCardFieldMapping,
  resendCardShareRecipient,
  shareCardBatch,
  updateCard,
  type CardShareBatch,
  type CardShareRecipientInput,
} from "@/lib/cards-api";
import { getContactName, getPrimaryPhone } from "@/lib/contact-display";
import { fetchAllContacts } from "@/lib/contacts-api";
import { DIAL_COUNTRIES } from "@/lib/dial-countries";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { parsePhoneParts } from "@/lib/phone";
import { fetchProfileMe } from "@/lib/profile-api";
import type {
  ContactCard,
  ContactCardFields,
  ContactCardTemplate,
  ContactCardTheme,
  ContactCardType,
  ContactDetail,
  ProfileMeResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const CARD_TYPE_OPTIONS: Array<{ value: ContactCardType; label: string }> = [
  { value: "PERSONAL", label: "Personal" },
  { value: "BUSINESS", label: "Business" },
  { value: "CUSTOM", label: "Custom" },
];

/** Matches the API's `MAX_SHARE_CARD_RECIPIENTS`. */
const MAX_SHARE_RECIPIENTS = 50;

const cardTypeLabels: Record<ContactCardType, string> = {
  BUSINESS: "Business",
  PERSONAL: "Personal",
  CUSTOM: "Custom",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

type DetailItem = {
  icon: LucideIcon;
  label: string;
  value: string;
};

type DetailSection = {
  title: string;
  items: DetailItem[];
};

function firstText(...values: Array<string | null | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? "";
}

function titleCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\w\S*/g, (part) => part[0].toUpperCase() + part.slice(1));
}

function addressLine(address: ProfileMeResponse["personal"]["postalAddress"]) {
  if (!address) {
    return "";
  }

  return [
    address.street,
    address.city,
    address.state,
    address.pincode,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function customItems(
  custom: Record<string, string> | null | undefined,
  excludedKeys: string[] = [],
) {
  if (!custom) {
    return [];
  }

  const excluded = new Set(excludedKeys.map((key) => key.toLowerCase()));

  return Object.entries(custom)
    .filter(([key]) => !excluded.has(key.toLowerCase()))
    .filter(([, value]) => value?.trim())
    .map(([key, value]) => ({
      icon: Hash,
      label: titleCase(key),
      value,
    }));
}

function maybeItem(
  icon: LucideIcon,
  label: string,
  value: string | null | undefined,
): DetailItem | null {
  const text = value?.trim();
  return text ? { icon, label, value: text } : null;
}

function compactItems(items: Array<DetailItem | null>) {
  return items.filter((item): item is DetailItem => Boolean(item));
}

function maskedEnd(value: string | null | undefined, visible = 4) {
  const text = value?.trim();
  if (!text) {
    return "";
  }
  const suffix = text.slice(-visible);
  return `•••• ${suffix}`;
}

function fieldsFromCard(
  card: ContactCard,
  profile: ProfileMeResponse | null,
): ContactCardFields {
  if (card.fields) {
    return {
      ...EMPTY_CARD_FIELDS,
      ...card.fields,
      countryCode: normalizeDialCode(card.fields.countryCode || "+1"),
    };
  }

  const details = getCardDisplayDetails(card, profile);
  return {
    ...EMPTY_CARD_FIELDS,
    displayName: details.name,
    title: details.role,
    countryCode: "+1",
    phone: details.phone.replace(/^\+\d{1,4}\s*/, ""),
    email: details.email,
    company: details.company,
    address: details.location,
    website: details.website || details.social,
    linkedin: details.linkedin,
    twitter: details.twitter,
    facebook: details.facebook,
    instagram: details.instagram,
    photoDataUrl: "",
  };
}

function themeFromCard(card: ContactCard): ContactCardTheme {
  return card.theme ?? DEFAULT_CARD_THEME;
}

function templateFromCard(card: ContactCard): ContactCardTemplate {
  return resolveTemplate(card.template);
}

function templateFromQuery(value: string | null): ContactCardTemplate | null {
  if (value === "connect" || value === "scan") {
    return value;
  }
  return null;
}

function cardDetailSections(card: ContactCard, profile: ProfileMeResponse | null) {
  const personal = profile?.personal;
  const work = profile?.work[0];
  const business = profile?.business[0];
  const social = profile?.socials[0];
  const includeFinancial = card.type === "PERSONAL";
  const useBusinessProfile = card.type === "BUSINESS";

  const contactItems = compactItems([
    maybeItem(
      Phone,
      useBusinessProfile ? "Mobile" : "Phone",
      useBusinessProfile
        ? firstText(business?.businessMobile, work?.workMobile, profile?.identity.primaryPhone)
        : firstText(personal?.mobile, profile?.identity.primaryPhone),
    ),
    maybeItem(
      Phone,
      "Landline",
      useBusinessProfile
        ? firstText(business?.businessLandline, work?.workLandline)
        : personal?.landline,
    ),
    maybeItem(
      Mail,
      "Email",
      useBusinessProfile
        ? firstText(business?.businessEmail, work?.workEmail, profile?.identity.primaryEmail)
        : firstText(personal?.email, profile?.identity.primaryEmail),
    ),
    maybeItem(
      MapPin,
      useBusinessProfile ? "Business address" : "Address",
      useBusinessProfile
        ? firstText(
            addressLine(business?.businessPostalAddress),
            addressLine(work?.workPostalAddress),
          )
        : firstText(personal?.currentLocation, addressLine(personal?.postalAddress)),
    ),
  ]);

  const organizationItems = compactItems([
    maybeItem(Building2, "Business", business?.businessName),
    maybeItem(UserRound, "Business title", business?.businessTitle),
    maybeItem(Building2, "Company", work?.companyName),
    maybeItem(UserRound, "Work title", work?.workTitle),
    ...customItems(business?.custom),
    ...customItems(work?.custom),
  ]);

  const personalItems = compactItems([
    maybeItem(UserRound, "Nickname", personal?.custom?.nickname),
    maybeItem(UserRound, "Title", personal?.custom?.title),
    maybeItem(MapPin, "Current location", personal?.currentLocation),
    maybeItem(CalendarDays, "Date of birth", personal?.dateOfBirth ?? personal?.yearOfBirth),
    ...customItems(useBusinessProfile ? undefined : personal?.custom, [
      "nickname",
      "title",
    ]),
  ]);

  const socialItems = compactItems([
    maybeItem(Globe2, "Website", social?.website),
    maybeItem(LinkIcon, "LinkedIn", social?.linkedin),
    maybeItem(LinkIcon, "Instagram", social?.custom?.instagram),
    maybeItem(LinkIcon, "Facebook", social?.facebook),
    maybeItem(LinkIcon, "X / Twitter", social?.twitter),
    maybeItem(LinkIcon, "GitHub", social?.github),
    maybeItem(Phone, "WhatsApp", social?.whatsApp),
    ...customItems(social?.custom, ["instagram"]),
  ]);

  const financialItems = includeFinancial
    ? compactItems([
        ...(profile?.financial.bankAccounts ?? []).flatMap((account) =>
          compactItems([
            maybeItem(
              Landmark,
              account.tag || "Bank account",
              firstText(
                [account.bankName, maskedEnd(account.accountNumber), account.currency]
                  .filter(Boolean)
                  .join(" • "),
              ),
            ),
            maybeItem(Banknote, "IFSC", maskedEnd(account.ifsc)),
          ]),
        ),
        ...(profile?.financial.digitalWallets ?? []).map((wallet) =>
          maybeItem(
            Wallet,
            wallet.tag || wallet.platform || "Digital wallet",
            [wallet.platform, maskedEnd(wallet.handleOrLink, 3)]
              .filter(Boolean)
              .join(" • "),
          ),
        ),
      ])
    : [];

  const imageItems = compactItems([
    maybeItem(ImageIcon, "Profile photo", profile?.identity.profilePhoto),
    maybeItem(ImageIcon, "Business logo", business?.businessLogo),
    maybeItem(ImageIcon, "Company logo", work?.companyLogo),
  ]);

  const sections: DetailSection[] = [{ title: "Contact", items: contactItems }];

  if (!useBusinessProfile && personalItems.length > 0) {
    sections.push({ title: "Personal", items: personalItems });
  }
  if (organizationItems.length > 0) {
    sections.push({
      title: useBusinessProfile ? "Business" : "Work",
      items: organizationItems,
    });
  }
  if (socialItems.length > 0) {
    sections.push({ title: "Social", items: socialItems });
  }
  if (financialItems.length > 0) {
    sections.push({ title: "Financial", items: financialItems });
  }
  if (imageItems.length > 0) {
    sections.push({ title: "Media", items: imageItems });
  }

  return sections.filter((section) => section.items.length > 0);
}

function essentialFacts(fields: ContactCardFields): DetailItem[] {
  return compactItems([
    maybeItem(UserRound, "Name", fields.displayName),
    maybeItem(UserRound, "Title", fields.title),
    maybeItem(
      Phone,
      "Phone",
      fields.phone.trim()
        ? formatCardPhone(
            normalizeDialCode(fields.countryCode || "+1"),
            fields.phone,
          )
        : "",
    ),
    maybeItem(Mail, "Email", fields.email),
    maybeItem(Building2, "Company", fields.company),
    maybeItem(MapPin, "Address", fields.address),
    maybeItem(Globe2, "Website", fields.website),
    maybeItem(LinkIcon, "LinkedIn", fields.linkedin),
    maybeItem(LinkIcon, "X / Twitter", fields.twitter),
    maybeItem(LinkIcon, "Facebook", fields.facebook),
    maybeItem(LinkIcon, "Instagram", fields.instagram),
  ]);
}

function getCardDetailPath(cardId: string) {
  return `/dashboard/cards/${cardId}`;
}

async function copyCardLink(card: ContactCard) {
  const url = `${window.location.origin}${getCardDetailPath(card.id)}`;
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied.");
  } catch (error) {
    logUiError("Could not copy card link", error);
    toast.error("Could not copy link.");
  }
}

function downloadLocalVcardStub(card: ContactCard, fields: ContactCardFields) {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${fields.displayName || card.name}`,
    fields.title ? `TITLE:${fields.title}` : null,
    fields.company ? `ORG:${fields.company}` : null,
    fields.phone
      ? `TEL;TYPE=CELL:${normalizeDialCode(fields.countryCode)} ${fields.phone}`
      : null,
    fields.email ? `EMAIL:${fields.email}` : null,
    fields.website ? `URL:${fields.website}` : null,
    "END:VCARD",
  ].filter(Boolean);

  const blob = new Blob([lines.join("\n")], { type: "text/vcard;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `${(fields.displayName || card.name || "contact")
    .replace(/\s+/g, "-")
    .toLowerCase()}.vcf`;
  anchor.click();
  URL.revokeObjectURL(href);
  toast.success("Contact file downloaded.");
}

async function downloadCardVcard(card: ContactCard, fields: ContactCardFields) {
  try {
    const asset = await generateCardVcard(card.id);
    const anchor = document.createElement("a");
    anchor.href = asset.url;
    anchor.download = `${(fields.displayName || card.name || "contact")
      .replace(/\s+/g, "-")
      .toLowerCase()}.vcf`;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
    toast.success("Contact file ready.");
  } catch (error) {
    logUiError("Server VCF unavailable, using local fallback", error);
    downloadLocalVcardStub(card, fields);
  }
}

export default function CardDetailPage() {
  const { cardId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateParam = templateFromQuery(searchParams.get("template"));
  const [card, setCard] = useState<ContactCard | null>(null);
  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [mappingBusyId, setMappingBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [whatsappShareOpen, setWhatsappShareOpen] = useState(false);
  const [shareCountryCode, setShareCountryCode] = useState("+91");
  const [shareNote, setShareNote] = useState("");
  const [isSharingWhatsapp, setIsSharingWhatsapp] = useState(false);
  const [shareContacts, setShareContacts] = useState<ContactDetail[]>([]);
  const [selectedShareContactIds, setSelectedShareContactIds] = useState<
    string[]
  >([]);
  const [isLoadingShareContacts, setIsLoadingShareContacts] = useState(false);
  const [shareContactsError, setShareContactsError] = useState<string | null>(
    null,
  );
  const [shareBatches, setShareBatches] = useState<CardShareBatch[]>([]);
  const [sharesError, setSharesError] = useState<string | null>(null);
  const [resendBusyId, setResendBusyId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<ContactCardType>("PERSONAL");
  const [editSensitive, setEditSensitive] = useState(false);

  const refreshShares = async (id: string) => {
    try {
      const response = await listCardShares(id, { page: 1, limit: 10 });
      setShareBatches(response.batches ?? []);
      setSharesError(null);
    } catch (err) {
      logUiError("Could not load card shares", err);
      setShareBatches([]);
      setSharesError(
        err instanceof ApiError && err.message
          ? err.message
          : "Could not load recent WhatsApp shares.",
      );
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadCard = async () => {
      if (!cardId) {
        setError("Card id is missing.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setProfileError(null);

      try {
        const data = await getCard(cardId);
        if (isMounted) {
          setCard(data);
          setEditName(data.name);
          setEditType(data.type);
          setEditSensitive(Boolean(data.isSensitive));
        }
        await refreshShares(cardId);
      } catch (err) {
        if (isMounted) {
          logUiError("Could not load card", err);
          setCard(null);
          setError(friendlyErrorMessages.load);
        }
      }

      try {
        const profileData = await fetchProfileMe();
        if (isMounted) {
          setProfile(profileData);
        }
      } catch (err) {
        if (isMounted) {
          logUiError("Could not load profile for card detail", err);
          setProfile(null);
          setProfileError(friendlyErrorMessages.load);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadCard();
    return () => {
      isMounted = false;
    };
  }, [cardId]);

  // Recipients come from the user's vCard-imported contacts; load lazily the
  // first time the WhatsApp share dialog opens.
  useEffect(() => {
    if (!whatsappShareOpen || shareContacts.length > 0) {
      return;
    }

    let isMounted = true;
    const loadShareContacts = async () => {
      setIsLoadingShareContacts(true);
      setShareContactsError(null);
      try {
        const contacts = await fetchAllContacts({ source: "VCARD" });
        if (isMounted) {
          setShareContacts(contacts);
        }
      } catch (err) {
        if (isMounted) {
          logUiError("Could not load contacts for card share", err);
          setShareContacts([]);
          setShareContactsError(
            err instanceof ApiError && err.message
              ? err.message
              : "Could not load your imported contacts.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingShareContacts(false);
        }
      }
    };

    void loadShareContacts();
    return () => {
      isMounted = false;
    };
  }, [shareContacts.length, whatsappShareOpen]);

  const shareContactOptions = useMemo<MultiSelectOption[]>(
    () =>
      shareContacts
        .filter((contact) => getPrimaryPhone(contact).trim())
        .map((contact) => ({
          value: contact.id,
          label: getContactName(contact),
          description: getPrimaryPhone(contact),
        })),
    [shareContacts],
  );

  const mappableFields = useMemo(
    () => listMappableFinancialFields(profile),
    [profile],
  );

  const mappedFieldIds = useMemo(
    () => new Set(card?.mappedFieldIds ?? []),
    [card?.mappedFieldIds],
  );

  const handleSaveMeta = async () => {
    if (!cardId || !card) {
      return;
    }
    const nextName = editName.trim();
    if (!nextName) {
      toast.error("Enter a card name.");
      return;
    }
    setIsSavingMeta(true);
    try {
      const updated = await updateCard(cardId, {
        name: nextName,
        type: editType,
        isSensitive: editSensitive,
        fields: card.fields,
        theme: card.theme,
        template: card.template,
      });
      setCard({
        ...updated,
        mappedFieldIds: card.mappedFieldIds,
      });
      toast.success("Card updated.");
    } catch (err) {
      logUiError("Could not update card", err);
      toast.error(friendlyErrorMessages.save);
    } finally {
      setIsSavingMeta(false);
    }
  };

  const handleToggleMapping = async (fieldId: string, enabled: boolean) => {
    if (!cardId || !card) {
      return;
    }
    setMappingBusyId(fieldId);
    try {
      if (enabled) {
        await addCardFieldMapping(cardId, fieldId);
        setCard({
          ...card,
          mappedFieldIds: Array.from(
            new Set([...(card.mappedFieldIds ?? []), fieldId]),
          ),
        });
        toast.success("Field added to card.");
      } else {
        await removeCardFieldMapping(cardId, fieldId);
        setCard({
          ...card,
          mappedFieldIds: (card.mappedFieldIds ?? []).filter(
            (id) => id !== fieldId,
          ),
        });
        toast.success("Field removed from card.");
      }
    } catch (err) {
      logUiError("Could not update card field mapping", err);
      toast.error(friendlyErrorMessages.save);
    } finally {
      setMappingBusyId(null);
    }
  };

  const handleDeleteCard = async () => {
    if (!cardId || !card) {
      return;
    }
    const confirmed = window.confirm(
      `Delete “${card.name}”? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteCard(cardId);
      toast.success("Card deleted.");
      navigate("/dashboard/cards", { replace: true });
    } catch (err) {
      logUiError("Could not delete card", err);
      toast.error(friendlyErrorMessages.save);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShareOption = (option: ShareSheetOptionId) => {
    if (!card) {
      return;
    }
    if (option === "whatsapp") {
      setWhatsappShareOpen(true);
    }
  };

  const handleWhatsappShare = async () => {
    if (!cardId || !card) {
      return;
    }
    const fallbackDial = shareCountryCode.trim();
    if (!/^\+\d{1,4}$/.test(fallbackDial)) {
      toast.error("Select a valid country code.");
      return;
    }
    if (selectedShareContactIds.length === 0) {
      toast.error("Select at least one contact.");
      return;
    }

    const recipients: CardShareRecipientInput[] = [];
    const unusableContacts: string[] = [];

    for (const contactId of selectedShareContactIds) {
      const contact = shareContacts.find((item) => item.id === contactId);
      if (!contact) {
        continue;
      }
      const parts = parsePhoneParts(getPrimaryPhone(contact), fallbackDial);
      if (!parts) {
        unusableContacts.push(getContactName(contact));
        continue;
      }
      recipients.push({ ...parts, contactId: contact.id });
    }

    if (recipients.length === 0) {
      toast.error(
        "None of the selected contacts have a valid phone number to share with.",
      );
      return;
    }
    if (unusableContacts.length > 0) {
      toast.warning(
        `Skipping ${unusableContacts.length} contact(s) without a valid phone number: ${unusableContacts.join(", ")}.`,
      );
    }

    setIsSharingWhatsapp(true);
    try {
      const batch = await shareCardBatch(cardId, {
        recipients,
        note: shareNote,
      });
      toast.success(
        recipients.length === 1
          ? `WhatsApp share queued for ${recipients[0].countryCode} ${recipients[0].phone}.`
          : `WhatsApp share queued for ${recipients.length} contacts.`,
      );
      setWhatsappShareOpen(false);
      setSelectedShareContactIds([]);
      setShareNote("");
      setShareBatches((current) => [batch, ...current].slice(0, 10));
      await refreshShares(cardId);
    } catch (err) {
      logUiError("Could not share card via WhatsApp", err);
      toast.error(
        err instanceof ApiError && err.message
          ? err.message
          : "We couldn't share this card right now.",
      );
    } finally {
      setIsSharingWhatsapp(false);
    }
  };

  const handleResendRecipient = async (
    batchId: string,
    recipientId: string,
  ) => {
    setResendBusyId(recipientId);
    try {
      await resendCardShareRecipient(batchId, recipientId);
      toast.success("Resend queued.");
      if (cardId) {
        await refreshShares(cardId);
      }
    } catch (err) {
      logUiError("Could not resend card share", err);
      toast.error(
        err instanceof ApiError && err.message
          ? err.message
          : "Could not resend this share.",
      );
    } finally {
      setResendBusyId(null);
    }
  };

  return (
    <AppShell>
      <section className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/dashboard/cards"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Cards
          </Link>
        </div>
        {card && (
          <div className="flex flex-wrap items-center gap-2 self-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShareOpen(true)}
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => void handleDeleteCard()}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        )}
      </section>

      {isLoading && (
        <section className="grid gap-4 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
          <Skeleton className="h-[560px] w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </section>
      )}

      {!isLoading && profileError && !error && card && (
        <Alert className="mb-4 flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium">Could not load profile details</p>
            <p className="mt-1 text-sm text-muted-foreground">{profileError}</p>
          </div>
        </Alert>
      )}

      {!isLoading && error && (
        <Alert className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium">Could not load card</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {friendlyErrorMessages.load}
            </p>
          </div>
        </Alert>
      )}

      {!isLoading && !error && card && (
        <>
          <CardDetailPreview
            card={card}
            profile={profile}
            preferredTemplate={templateParam}
            onShare={() => setShareOpen(true)}
          />

          <Panel className="mt-6 space-y-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Card settings
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Updates name, type, and sensitivity on the server (
                <code className="text-xs">PATCH /cards/:id</code>).
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium" htmlFor="card-name">
                  Name
                </label>
                <Input
                  id="card-name"
                  className="mt-2"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  disabled={isSavingMeta}
                />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="card-type">
                  Type
                </label>
                <select
                  id="card-type"
                  className="mt-2 flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                  value={editType}
                  onChange={(event) =>
                    setEditType(event.target.value as ContactCardType)
                  }
                  disabled={isSavingMeta}
                >
                  {CARD_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editSensitive}
                    onChange={(event) => setEditSensitive(event.target.checked)}
                    disabled={isSavingMeta}
                  />
                  Mark as sensitive
                </label>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={isSavingMeta}
              onClick={() => void handleSaveMeta()}
            >
              {isSavingMeta ? "Saving…" : "Save settings"}
            </Button>
          </Panel>

          <Panel className="mt-4 space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  WhatsApp shares
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Recent share batches for this card (
                  <code className="text-xs">GET /cards/:id/shares</code>).
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (cardId) {
                    void refreshShares(cardId);
                  }
                }}
              >
                Refresh
              </Button>
            </div>
            {sharesError ? (
              <p className="text-sm text-muted-foreground">{sharesError}</p>
            ) : null}
            {shareBatches.length === 0 && !sharesError ? (
              <p className="text-sm text-muted-foreground">
                No WhatsApp shares yet. Use Share → WhatsApp to send this card.
              </p>
            ) : (
              <ul className="space-y-3">
                {shareBatches.map((batch) => (
                  <li
                    key={batch.id}
                    className="rounded-lg border border-border px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {formatDate(batch.createdAt)}
                        {batch.note ? ` · ${batch.note}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {batch.recipients.length} recipient
                        {batch.recipients.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <ul className="mt-2 space-y-2">
                      {batch.recipients.map((recipient) => (
                        <li
                          key={recipient.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-sm"
                        >
                          <span className="text-foreground">
                            {recipient.countryCode} {recipient.phone}
                            <span className="ml-2 text-xs text-muted-foreground">
                              {recipient.dispatchStatus}
                              {recipient.deliveryStatus
                                ? ` · ${recipient.deliveryStatus}`
                                : ""}
                            </span>
                          </span>
                          {recipient.dispatchStatus === "FAILED" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={resendBusyId === recipient.id}
                              onClick={() =>
                                void handleResendRecipient(
                                  batch.id,
                                  recipient.id,
                                )
                              }
                            >
                              {resendBusyId === recipient.id
                                ? "Resending…"
                                : "Resend"}
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel className="mt-4 space-y-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Profile fields on this card
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Map financial profile fields that expose a{" "}
                <code className="text-xs">fieldId</code>. Identity and work
                mappings need a backend field catalog.
              </p>
            </div>
            {mappableFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No mappable financial fields on your profile yet. Add bank,
                wallet, or crypto details in Profile first.
              </p>
            ) : (
              <ul className="space-y-2">
                {mappableFields.map((field) => {
                  const checked = mappedFieldIds.has(field.fieldId);
                  const busy = mappingBusyId === field.fieldId;
                  return (
                    <li
                      key={field.fieldId}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {field.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {field.kind}
                          {field.isSensitive ? " · sensitive" : ""}
                        </p>
                      </div>
                      <label className="flex shrink-0 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={busy}
                          onChange={(event) =>
                            void handleToggleMapping(
                              field.fieldId,
                              event.target.checked,
                            )
                          }
                        />
                        {busy ? "Saving…" : "Include"}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </>
      )}

      {card ? (
        <ShareSheet
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          onSelect={(id) => {
            setShareOpen(false);
            handleShareOption(id);
          }}
        />
      ) : null}

      {whatsappShareOpen && card ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Close WhatsApp share"
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setWhatsappShareOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Share card on WhatsApp"
            className="relative z-10 max-h-[85vh] w-full max-w-md space-y-4 overflow-y-auto overscroll-contain rounded-t-xl border border-border bg-surface p-5 sm:max-h-[calc(100vh-2rem)] sm:rounded-xl"
          >
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Share via WhatsApp
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Sends an approved WhatsApp template, then the contact file when
                the recipient taps Get Contact.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-sm font-medium">
              <span id="share-contacts-label">Contacts</span>
              <MultiSelect
                aria-labelledby="share-contacts-label"
                options={shareContactOptions}
                value={selectedShareContactIds}
                onValueChange={setSelectedShareContactIds}
                placeholder="Select imported contacts"
                searchPlaceholder="Search contacts"
                loadingMessage="Loading contacts…"
                emptyMessage={
                  shareContactsError
                    ? "Contacts could not be loaded"
                    : "No imported contacts with a phone number"
                }
                isLoading={isLoadingShareContacts}
                disabled={isSharingWhatsapp}
                maxSelected={MAX_SHARE_RECIPIENTS}
              />
              {shareContactsError ? (
                <p className="text-xs font-normal text-destructive">
                  {shareContactsError}
                </p>
              ) : (
                <p className="text-xs font-normal text-muted-foreground">
                  Numbers come from your imported vCard contacts.
                </p>
              )}
            </div>
            <label className="flex flex-col gap-2 text-sm font-medium">
              <span>Country code for numbers saved without one</span>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                value={shareCountryCode}
                onChange={(event) => setShareCountryCode(event.target.value)}
                disabled={isSharingWhatsapp}
              >
                {DIAL_COUNTRIES.map((country) => (
                  <option key={`${country.iso2}-${country.dial}`} value={country.dial}>
                    {country.name} ({country.dial})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              <span>Note (optional)</span>
              <Input
                maxLength={300}
                placeholder="Great meeting you!"
                value={shareNote}
                onChange={(event) => setShareNote(event.target.value)}
                disabled={isSharingWhatsapp}
              />
            </label>
            <div className="flex gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={isSharingWhatsapp}
                onClick={() => setWhatsappShareOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={
                  isSharingWhatsapp || selectedShareContactIds.length === 0
                }
                onClick={() => void handleWhatsappShare()}
              >
                {isSharingWhatsapp ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function CardDetailPreview({
  card,
  profile,
  preferredTemplate,
  onShare,
}: {
  card: ContactCard;
  profile: ProfileMeResponse | null;
  preferredTemplate: ContactCardTemplate | null;
  onShare: () => void;
}) {
  const [showMore, setShowMore] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

  const fields = useMemo(() => fieldsFromCard(card, profile), [card, profile]);
  const theme = useMemo(() => themeFromCard(card), [card]);
  const template = useMemo(
    () => preferredTemplate ?? templateFromCard(card),
    [card, preferredTemplate],
  );
  const templateMeta = CARD_TEMPLATE_OPTIONS.find((item) => item.id === template);
  const facts = useMemo(() => essentialFacts(fields), [fields]);
  const extraSections = useMemo(
    () => (card.fields ? [] : cardDetailSections(card, profile)),
    [card, profile],
  );

  return (
    <section className="grid items-start gap-6 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)] lg:gap-8">
      <aside className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="mb-4">
          <p className="text-sm font-semibold text-foreground">
            {templateMeta?.label ?? "Connect"} template
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {templateMeta?.description}
          </p>
        </div>
        <div className="flex justify-center rounded-xl border border-border bg-bg-hover/80 px-3 py-5 sm:px-4 sm:py-6">
          <div className="w-full max-w-[340px]">
            <LiveCardPreview
              fields={fields}
              theme={theme}
              template={template}
              onSaveContact={() => void downloadCardVcard(card, fields)}
              onShareCard={onShare}
            />
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3 w-full justify-center"
          onClick={() => setMobilePreviewOpen(true)}
        >
          <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
          View on phone
        </Button>
      </aside>

      <div className="min-w-0 space-y-5">
        <Panel className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">
                {cardTypeLabels[card.type]} card
              </p>
              <h1 className="mt-1 font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
                {card.name}
              </h1>
              {fields.displayName && fields.displayName !== card.name ? (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Showing as {fields.displayName}
                  {fields.title ? ` · ${fields.title}` : ""}
                </p>
              ) : fields.title ? (
                <p className="mt-1.5 text-sm text-muted-foreground">{fields.title}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Button
              type="button"
              size="sm"
              className="justify-center"
              onClick={onShare}
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="justify-center"
              onClick={() => setMobilePreviewOpen(true)}
            >
              <Smartphone className="h-4 w-4" aria-hidden="true" />
              Preview
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="justify-center"
              onClick={() => {
                void copyCardLink(card);
              }}
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy link
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="justify-center"
              onClick={() => void downloadCardVcard(card, fields)}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Save contact
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Created {formatDate(card.createdAt)}
            <span className="mx-2 text-border-strong">·</span>
            Updated {formatDate(card.updatedAt)}
          </p>
        </Panel>

        <Panel className="p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-foreground">On this card</h2>
          {facts.length > 0 ? (
            <dl className="mt-4 divide-y divide-border">
              {facts.map((item) => (
                <div
                  key={`${item.label}-${item.value}`}
                  className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <dt className="shrink-0 text-[12px] font-medium text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="min-w-0 text-right text-[13px] font-medium text-foreground">
                    <span className="break-words">{item.value}</span>
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No fields saved on this card yet.
            </p>
          )}
        </Panel>

        {extraSections.length > 0 && (
          <Panel className="p-5 sm:p-6">
            <button
              type="button"
              onClick={() => setShowMore((current) => !current)}
              className="flex w-full items-center justify-between gap-3 text-left"
              aria-expanded={showMore}
            >
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Profile extras
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Optional profile data not stored on the card shell.
                </p>
              </div>
              <span className="text-xs font-semibold text-foreground">
                {showMore ? "Hide" : "Show"}
              </span>
            </button>

            {showMore ? (
              <div className="mt-5 space-y-5 border-t border-border pt-5">
                {extraSections.map((section) => (
                  <div key={section.title}>
                    <h3 className="text-sm font-semibold text-foreground">
                      {section.title}
                    </h3>
                    <dl className="mt-2 divide-y divide-border">
                      {section.items.map((item) => (
                        <div
                          key={`${section.title}-${item.label}-${item.value}`}
                          className="flex items-baseline justify-between gap-4 py-2.5"
                        >
                          <dt className="shrink-0 text-[12px] text-muted-foreground">
                            {item.label}
                          </dt>
                          <dd className="min-w-0 break-words text-right text-[13px] font-medium text-foreground">
                            {item.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            ) : null}
          </Panel>
        )}
      </div>

      <MobileCardPreview
        open={mobilePreviewOpen}
        onClose={() => setMobilePreviewOpen(false)}
        fields={fields}
        theme={theme}
        template={template}
        title={card.name}
        onSaveContact={() => void downloadCardVcard(card, fields)}
        onShareCard={() => {
          setMobilePreviewOpen(false);
          onShare();
        }}
      />
    </section>
  );
}
