import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Building2,
  CalendarDays,
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
import { SampleDataNotice } from "@/components/sample-data-notice";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { getCardDisplayDetails } from "@/lib/card-display";
import { cardTypeStyles } from "@/lib/card-styles";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { mockCardDetail, mockProfile } from "@/lib/mock-data";
import type { ContactCard, ContactCardType, ProfileMeResponse } from "@/lib/types";
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

function compactAddress(value: string) {
  return value || "";
}

function primaryMedia(profile: ProfileMeResponse | null, card: ContactCard) {
  const work = profile?.work[0];
  const business = profile?.business[0];

  if (card.type === "BUSINESS") {
    return firstText(business?.businessLogo, work?.companyLogo, profile?.identity.profilePhoto);
  }

  return firstText(profile?.identity.profilePhoto, business?.businessLogo, work?.companyLogo);
}

function isRenderableImage(value: string) {
  return /^(https?:|data:image\/|blob:)/i.test(value);
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
      Phone,
      "Fax",
      useBusinessProfile ? firstText(business?.businessFax, work?.workFax) : undefined,
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
      compactAddress(
        useBusinessProfile
          ? firstText(
              addressLine(business?.businessPostalAddress),
              addressLine(work?.workPostalAddress),
            )
          : firstText(personal?.currentLocation, addressLine(personal?.postalAddress)),
      ),
    ),
  ]);

  const organizationItems = compactItems([
    maybeItem(Building2, "Business", business?.businessName),
    maybeItem(UserRound, "Business title", business?.businessTitle),
    maybeItem(Building2, "Business type", business?.businessType),
    maybeItem(Hash, "Business registration", business?.businessRegNumber),
    maybeItem(Hash, "GSTIN", business?.gstin),
    maybeItem(Building2, "Company", work?.companyName),
    maybeItem(UserRound, "Work title", work?.workTitle),
    maybeItem(Hash, "Employee ID", work?.employeeId),
    maybeItem(Hash, "Company registration", work?.companyRegNumber),
    maybeItem(ImageIcon, "Business logo", business?.businessLogo),
    maybeItem(ImageIcon, "Company logo", work?.companyLogo),
    ...customItems(business?.custom),
    ...customItems(work?.custom),
  ]);

  const personalItems = compactItems([
    maybeItem(UserRound, "Nickname", personal?.custom?.nickname),
    maybeItem(UserRound, "Relationship", personal?.relationshipStatus),
    maybeItem(CalendarDays, "Date of birth", personal?.dateOfBirth ?? personal?.yearOfBirth),
    maybeItem(MapPin, "Current location", personal?.currentLocation),
    maybeItem(UserRound, "Title", personal?.custom?.title),
    maybeItem(UserRound, "Partner", personal?.custom?.partnerName),
    maybeItem(UserRound, "Kids", personal?.custom?.kidsNames),
    maybeItem(UserRound, "Pets", personal?.custom?.petNames),
    maybeItem(Hash, "Blood group", personal?.custom?.bloodGroup),
    ...customItems(useBusinessProfile ? undefined : personal?.custom, [
      "nickname",
      "relationshipStatus",
      "title",
      "partnerName",
      "kidsNames",
      "petNames",
      "bloodGroup",
    ]),
  ]);

  const socialItems = compactItems([
    maybeItem(Globe2, "Website", social?.website),
    maybeItem(LinkIcon, "LinkedIn", social?.linkedin),
    maybeItem(LinkIcon, "Instagram", social?.custom?.instagram),
    maybeItem(LinkIcon, "Facebook", social?.facebook),
    maybeItem(LinkIcon, "X / Twitter", social?.twitter),
    maybeItem(LinkIcon, "GitHub", social?.github),
    maybeItem(LinkIcon, "Blog", social?.blog),
    maybeItem(Phone, "WhatsApp", social?.whatsApp),
    maybeItem(LinkIcon, "Skype", social?.skype),
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
                [
                  account.bankName,
                  maskedEnd(account.accountNumber),
                  account.currency,
                ]
                  .filter(Boolean)
                  .join(" • "),
              ),
            ),
            maybeItem(Banknote, "IFSC", maskedEnd(account.ifsc)),
            maybeItem(Banknote, "IBAN", maskedEnd(account.iban)),
            maybeItem(Banknote, "SWIFT / BIC", maskedEnd(account.swiftBic)),
            maybeItem(Banknote, "Routing number", maskedEnd(account.routingNumber)),
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
        ...(profile?.financial.cryptoWallets ?? []).map((wallet) =>
          maybeItem(
            Wallet,
            wallet.tag || wallet.network || "Crypto wallet",
            [wallet.network, maskedEnd(wallet.address, 4)]
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

  const sections: DetailSection[] = [
    { title: "Contact", items: contactItems },
  ];

  if (imageItems.length > 0) {
    sections.push({ title: "Images", items: imageItems });
  }

  if (!useBusinessProfile && personalItems.length > 0) {
    sections.push({ title: "Personal", items: personalItems });
  }

  if (organizationItems.length > 0) {
    sections.push({
      title: useBusinessProfile ? "Business" : "Work and business",
      items: organizationItems,
    });
  }

  if (socialItems.length > 0) {
    sections.push({ title: "Social", items: socialItems });
  }

  if (financialItems.length > 0) {
    sections.push({ title: "Financial", items: financialItems });
  }

  return sections.filter((section) => section.items.length > 0);
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
        const data = await apiFetch<ContactCard>(`/v1/cards/${cardId}`);
        if (isMounted) {
          setCard(data);
        }
      } catch (err) {
        if (isMounted) {
          logUiError("Could not load card", err);
          setCard(mockCardDetail(cardId));
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
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            to="/dashboard/cards"
            className={cn(buttonVariants({ variant: "ghost" }), "-ml-3 mb-2 rounded-full")}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Cards
          </Link>
        </div>
        {card && (
          <Button
            type="button"
            variant="outline"
            className="self-start rounded-full"
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
        <section>
          <Skeleton className="h-80 w-full" />
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

      {isMockData && <SampleDataNotice />}

      {!isLoading && !error && card && (
        <section>
          <CardDetailPreview card={card} profile={profile} />
        </section>
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
  const details = getCardDisplayDetails(card, profile);
  const style = cardTypeStyles[card.type];
  const media = primaryMedia(profile, card);
  const sections = cardDetailSections(card, profile);

  return (
    <Card className="relative overflow-hidden rounded-xl border-[0.5px] border-accent-border border-t-2 border-t-primary bg-card">
      <CardContent className="p-0">
        <div
          className={cn(
            "relative min-h-[34rem] overflow-hidden p-6 md:p-8",
            style.faceClassName,
          )}
        >
          <div className="relative flex min-w-0 flex-col">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
                <div
                  className={cn(
                    "flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full text-3xl font-semibold",
                    media && isRenderableImage(media)
                      ? "bg-card"
                      : style.initialsClassName,
                  )}
                >
                  {media && isRenderableImage(media) ? (
                    <img
                      src={media}
                      alt=""
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    details.initials
                  )}
                </div>
                <div className="min-w-0">
                  <p className="label-section text-primary">ContactBook</p>
                  <h2 className="title-display mt-4 max-w-5xl break-words md:text-5xl">
                    {details.name}
                  </h2>
                  <p className="body mt-3 truncate text-base">
                    {details.role}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Badge variant="secondary" className={cn("w-fit shrink-0", style.badgeClassName)}>
                  {cardTypeLabels[card.type]}
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void shareCard(card);
                  }}
                >
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                  Share card
                </Button>
              </div>
            </div>

            <div className="mt-10 grid gap-3 md:grid-cols-3">
              <MetadataChip
                icon={CalendarDays}
                label="Created"
                value={formatDate(card.createdAt)}
              />
              <MetadataChip
                icon={CalendarDays}
                label="Updated"
                value={formatDate(card.updatedAt)}
              />
              <MetadataChip
                icon={Share2}
                label="Share type"
                value={cardTypeLabels[card.type]}
              />
            </div>

            <div className="mt-8 space-y-4">
              {sections.map((section) => (
                <CardDetailSection key={section.title} section={section} />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CardDetailSection({ section }: { section: DetailSection }) {
  return (
    <section className="rounded-[28px] border border-border/80 bg-background/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
      <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
        {section.title}
      </h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {section.items.map((item) => (
          <DetailTile
            key={`${section.title}-${item.label}-${item.value}`}
            icon={item.icon}
            label={item.label}
            value={item.value}
          />
        ))}
      </div>
    </section>
  );
}

function DetailTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 gap-3 rounded-[24px] border border-border bg-card p-4 pr-5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
        <p className="mt-1 break-words text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function MetadataChip({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-full border border-border/80 bg-background/70 p-3 pr-5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
