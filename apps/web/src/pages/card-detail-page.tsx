import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { LiveCardPreview } from "@/components/cards/live-card-preview";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { getCardDisplayDetails } from "@/lib/card-display";
import {
  CARD_TEMPLATE_OPTIONS,
  DEFAULT_CARD_THEME,
  EMPTY_CARD_FIELDS,
  formatCardPhone,
  normalizeDialCode,
  resolveTemplate,
} from "@/lib/card-maker";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { getLocalCard, listLocalCards, USE_LOCAL_CARDS } from "@/lib/local-cards";
import { mockProfile } from "@/lib/mock-data";
import type {
  ContactCard,
  ContactCardFields,
  ContactCardTemplate,
  ContactCardTheme,
  ContactCardType,
  ProfileMeResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const cardTypeLabels: Record<ContactCardType, string> = {
  BUSINESS: "Business",
  PERSONAL: "Personal",
  PAYMENT: "Custom",
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
    maybeItem(UserRound, "Title", fields.title),
    maybeItem(LinkIcon, "LinkedIn", fields.linkedin),
    maybeItem(LinkIcon, "X / Twitter", fields.twitter),
    maybeItem(LinkIcon, "Facebook", fields.facebook),
    maybeItem(LinkIcon, "Instagram", fields.instagram),
  ]);
}

function getCardDetailPath(cardId: string) {
  return `/dashboard/cards/${cardId}`;
}

async function shareCard(card: ContactCard) {
  const url = `${window.location.origin}${getCardDetailPath(card.id)}`;
  const shareData = {
    title: card.name,
    text: `Open ${card.name} in ContactBook.`,
    url,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }

    await navigator.clipboard.writeText(url);
    toast.success("Card link copied.");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }

    logUiError("Could not share card", error);
    toast.error("We couldn't share this card right now.");
  }
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

function downloadContactStub(card: ContactCard, fields: ContactCardFields) {
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

export default function CardDetailPage() {
  const { cardId } = useParams();
  const [card, setCard] = useState<ContactCard | null>(null);
  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);

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
      let usedMockData = false;

      try {
        if (USE_LOCAL_CARDS) {
          const localCard = getLocalCard(cardId) ?? listLocalCards()[0] ?? null;
          if (isMounted) {
            setCard(localCard);
            setError(localCard ? null : "Card not found.");
          }
          usedMockData = true;
        } else {
          const data = await apiFetch<ContactCard>(`/v1/cards/${cardId}`);
          if (isMounted) {
            setCard(data);
          }
        }
      } catch (err) {
        if (isMounted) {
          logUiError("Could not load card", err);
          setCard(getLocalCard(cardId) ?? listLocalCards()[0] ?? null);
          setError(null);
        }
        usedMockData = true;
      }

      try {
        const profileData = await apiFetch<ProfileMeResponse>("/v1/profile/me");
        if (isMounted) {
          setProfile(profileData);
        }
      } catch (err) {
        if (isMounted) {
          logUiError("Could not load profile for card detail", err);
          setProfile(mockProfile);
        }
        usedMockData = true;
      } finally {
        if (isMounted) {
          setIsMockData(usedMockData);
          setIsLoading(false);
        }
      }
    };

    void loadCard();
    return () => {
      isMounted = false;
    };
  }, [cardId]);

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
          {isMockData && (
            <span className="rounded border border-accent-border bg-accent-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
              Sample data
            </span>
          )}
        </div>
        {card && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => {
              void shareCard(card);
            }}
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Share
          </Button>
        )}
      </section>

      {isLoading && (
        <section className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
          <Skeleton className="h-[520px] w-full rounded-[22px]" />
          <Skeleton className="h-72 w-full rounded-[18px]" />
        </section>
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
        <CardDetailPreview card={card} profile={profile} />
      )}
    </AppShell>
  );
}

function CardDetailPreview({
  card,
  profile,
}: {
  card: ContactCard;
  profile: ProfileMeResponse | null;
}) {
  const [showMore, setShowMore] = useState(false);

  const fields = useMemo(() => fieldsFromCard(card, profile), [card, profile]);
  const theme = useMemo(() => themeFromCard(card), [card]);
  const template = useMemo(() => templateFromCard(card), [card]);
  const templateMeta = CARD_TEMPLATE_OPTIONS.find((item) => item.id === template);
  const facts = useMemo(() => essentialFacts(fields), [fields]);
  const extraSections = useMemo(
    () => (card.fields ? [] : cardDetailSections(card, profile)),
    [card, profile],
  );

  return (
    <section className="grid items-start gap-6 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] lg:gap-8">
      {/* Shareable card — primary surface */}
      <aside className="rounded-[22px] border border-border bg-[#12151C] p-4 sm:p-5">
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
            {templateMeta?.label ?? "Connect"} template
          </p>
          <p className="mt-1 text-xs text-white/55">
            {templateMeta?.description}
          </p>
        </div>
        <div className="flex justify-center overflow-x-auto py-2">
          <div className="w-full max-w-[300px] drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
            <LiveCardPreview
              fields={fields}
              theme={theme}
              template={template}
            />
          </div>
        </div>
      </aside>

      {/* Compact details */}
      <div className="min-w-0 space-y-5">
        <header className="rounded-[18px] border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                {cardTypeLabels[card.type]} card
              </p>
              <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
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

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <Button
              type="button"
              size="sm"
              className="justify-center"
              onClick={() => {
                void shareCard(card);
              }}
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share
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
              onClick={() => downloadContactStub(card, fields)}
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
        </header>

        <div className="rounded-[18px] border border-border bg-card p-5 sm:p-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            On this card
          </h2>
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
        </div>

        {extraSections.length > 0 && (
          <div className="rounded-[18px] border border-border bg-card p-5 sm:p-6">
            <button
              type="button"
              onClick={() => setShowMore((current) => !current)}
              className="flex w-full items-center justify-between gap-3 text-left"
              aria-expanded={showMore}
            >
              <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Profile extras
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Optional profile data not stored on the card shell.
                </p>
              </div>
              <span className="text-xs font-semibold text-primary">
                {showMore ? "Hide" : "Show"}
              </span>
            </button>

            {showMore ? (
              <div className="mt-5 space-y-5 border-t border-border pt-5">
                {extraSections.map((section) => (
                  <div key={section.title}>
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
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
          </div>
        )}
      </div>
    </section>
  );
}
