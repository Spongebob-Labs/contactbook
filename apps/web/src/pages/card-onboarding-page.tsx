import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ChevronDown,
  LayoutTemplate,
  Loader2,
  Share2,
  Smartphone,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { CardPhotoUpload } from "@/components/cards/card-photo-upload";
import { CardTemplateChooser } from "@/components/cards/card-template-chooser";
import { CardThemePicker } from "@/components/cards/card-theme-picker";
import { LiveCardPreview } from "@/components/cards/live-card-preview";
import { MobileCardPreview } from "@/components/cards/mobile-card-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiFetch } from "@/lib/api";
import {
  CARD_DIAL_OPTIONS,
  DEFAULT_CARD_TEMPLATE,
  DEFAULT_CARD_THEME,
  EMPTY_CARD_FIELDS,
  initialsFromName,
  normalizeDialCode,
} from "@/lib/card-maker";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { createLocalCard, USE_LOCAL_CARDS } from "@/lib/local-cards";
import type {
  ContactCard,
  ContactCardFields,
  ContactCardTemplate,
  ContactCardTheme,
  ContactCardType,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const cardTypeOptions: Array<{
  value: ContactCardType;
  label: string;
  description: string;
}> = [
  {
    value: "PERSONAL",
    label: "Personal",
    description: "Share your everyday profile details.",
  },
  {
    value: "BUSINESS",
    label: "Business",
    description: "Share work or business identity details.",
  },
  {
    value: "CUSTOM",
    label: "Custom",
    description: "Start with a flexible card you can shape later.",
  },
];

type CardOnboardingModalProps = {
  mode?: "setup" | "create";
  onComplete: (card: ContactCard) => void;
  onSkip: () => void;
};

function Field({
  id,
  label,
  children,
  hint,
}: {
  id: string;
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function CollapsibleSection({
  title,
  description,
  icon,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-bg-hover sm:px-5"
        aria-expanded={open}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="border-t border-border px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function LivePreviewPane({
  fields,
  theme,
  template,
}: {
  fields: ContactCardFields;
  theme: ContactCardTheme;
  template: ContactCardTemplate;
}) {
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden px-2">
      {/* Wider stage; light scale so the full card stays in one view */}
      <div className="w-full max-w-[360px] origin-center scale-[0.86] xl:scale-[0.92]">
        <LiveCardPreview fields={fields} theme={theme} template={template} />
      </div>
    </div>
  );
}

export function CardOnboardingModal({
  mode = "create",
  onComplete,
  onSkip,
}: CardOnboardingModalProps) {
  const isSetupMode = mode === "setup";
  const [cardName, setCardName] = useState(
    isSetupMode ? "My first ContactBook card" : "New ContactBook card",
  );
  const [type, setType] = useState<ContactCardType>("PERSONAL");
  const [fields, setFields] = useState<ContactCardFields>(EMPTY_CARD_FIELDS);
  const [theme, setTheme] = useState<ContactCardTheme>(DEFAULT_CARD_THEME);
  const [template, setTemplate] =
    useState<ContactCardTemplate>(DEFAULT_CARD_TEMPLATE);
  const [isSaving, setIsSaving] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [colorOpen, setColorOpen] = useState(false);
  const [socialsOpen, setSocialsOpen] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [fullMobilePreviewOpen, setFullMobilePreviewOpen] = useState(false);

  const updateField = <K extends keyof ContactCardFields>(
    key: K,
    value: ContactCardFields[K],
  ) => {
    setFields((current) => ({ ...current, [key]: value }));
  };

  const createCard = async () => {
    const cleanedName = cardName.trim();
    if (!cleanedName) {
      toast.error("Enter a card name.");
      return;
    }

    if (!fields.displayName.trim()) {
      toast.error("Enter the name that appears on the card.");
      return;
    }

    const payloadFields: ContactCardFields = {
      displayName: fields.displayName.trim(),
      title: fields.title.trim(),
      countryCode: normalizeDialCode(fields.countryCode),
      phone: fields.phone.trim(),
      email: fields.email.trim(),
      company: fields.company.trim(),
      address: fields.address.trim(),
      website: fields.website.trim(),
      linkedin: fields.linkedin.trim(),
      twitter: fields.twitter.trim(),
      facebook: fields.facebook.trim(),
      instagram: fields.instagram.trim(),
      photoDataUrl: fields.photoDataUrl.trim(),
    };

    setIsSaving(true);
    try {
      const card = USE_LOCAL_CARDS
        ? createLocalCard({
            name: cleanedName,
            type,
            fields: payloadFields,
            theme,
            template,
          })
        : await apiFetch<ContactCard>("/v1/cards", {
            method: "POST",
            body: {
              name: cleanedName,
              type,
            },
          });
      toast.success(isSetupMode ? "Your first card is ready." : "Card created.");
      onComplete(card);
    } catch (error) {
      logUiError("Could not create card", error);
      toast.error(friendlyErrorMessages.save);
    } finally {
      setIsSaving(false);
    }
  };

  const skipCard = () => {
    if (isSetupMode) {
      toast.info("You can create your first card later.");
    }
    onSkip();
  };

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-3 backdrop-blur-sm sm:p-4 md:p-5">
      <div className="flex h-[calc(100dvh-1.5rem)] w-full max-w-6xl overflow-hidden rounded-xl border border-border bg-surface sm:h-[calc(100dvh-2rem)] lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        {/* Editor column */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 md:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <StatusBadge variant={isSetupMode ? "connected" : "neutral"}>
                  {isSetupMode ? "Final setup step" : "Card"}
                </StatusBadge>
                <h1 className="mt-3 font-sans text-2xl font-semibold tracking-tight">
                  {isSetupMode
                    ? "Create your first card"
                    : "Create a card"}
                </h1>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={skipCard}
                className="self-start"
              >
                Skip
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            {/* Mobile / tablet live preview — collapsible, closed by default */}
            <div className="mt-5 lg:hidden">
              <CollapsibleSection
                title="Preview"
                description="Your card"
                icon={<BadgeCheck className="h-4 w-4" aria-hidden="true" />}
                open={mobilePreviewOpen}
                onOpenChange={setMobilePreviewOpen}
              >
                <div className="flex justify-center rounded-lg border border-border bg-surface py-4">
                  <div className="w-full max-w-[340px] origin-top scale-[0.9]">
                    <LiveCardPreview
                      fields={fields}
                      theme={theme}
                      template={template}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3 w-full justify-center"
                  onClick={() => setFullMobilePreviewOpen(true)}
                >
                  <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                  View on phone
                </Button>
              </CollapsibleSection>
            </div>

            <div className="mt-6 grid gap-3">
              <CollapsibleSection
                title="Template"
                description="Connect or Scan"
                icon={<LayoutTemplate className="h-4 w-4" aria-hidden="true" />}
                open={templateOpen}
                onOpenChange={setTemplateOpen}
              >
                <CardTemplateChooser
                  value={template}
                  onChange={setTemplate}
                />
              </CollapsibleSection>

              <section className="grid gap-4 sm:grid-cols-2">
                <Field id="card-name" label="Card name">
                  <Input
                    id="card-name"
                    value={cardName}
                    onChange={(event) => setCardName(event.target.value)}
                    placeholder="My personal card"
                  />
                </Field>
                <Field id="card-type" label="Card type">
                  <Select
                    id="card-type"
                    value={type}
                    onChange={(event) =>
                      setType(event.target.value as ContactCardType)
                    }
                  >
                    {cardTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </section>

              <CollapsibleSection
                title="Main details"
                description="Name and contact"
                icon={<UserRound className="h-4 w-4" aria-hidden="true" />}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
              >
                <div className="mb-5 rounded-xl border border-border bg-background/60 p-3.5 sm:p-4">
                  <CardPhotoUpload
                    value={fields.photoDataUrl}
                    primary={theme.primary}
                    initials={initialsFromName(
                      fields.displayName || cardName || "YN",
                    )}
                    onChange={(photoDataUrl) =>
                      updateField("photoDataUrl", photoDataUrl)
                    }
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="display-name" label="Full name">
                    <Input
                      id="display-name"
                      value={fields.displayName}
                      onChange={(event) =>
                        updateField("displayName", event.target.value)
                      }
                      placeholder="Alex Morgan"
                      autoComplete="name"
                    />
                  </Field>
                  <Field id="job-title" label="Title / role">
                    <Input
                      id="job-title"
                      value={fields.title}
                      onChange={(event) =>
                        updateField("title", event.target.value)
                      }
                      placeholder="Product Designer"
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field id="phone" label="Phone">
                      <div className="grid grid-cols-[6.25rem_minmax(0,1fr)] gap-2">
                        <Select
                          id="country-code"
                          aria-label="Country code"
                          value={normalizeDialCode(fields.countryCode)}
                          onChange={(event) =>
                            updateField(
                              "countryCode",
                              normalizeDialCode(event.target.value),
                            )
                          }
                          className="font-semibold tabular-nums"
                        >
                          {CARD_DIAL_OPTIONS.map((dial) => (
                            <option key={dial} value={dial}>
                              {dial}
                            </option>
                          ))}
                        </Select>
                        <Input
                          id="phone"
                          value={fields.phone}
                          onChange={(event) =>
                            updateField("phone", event.target.value)
                          }
                          placeholder="555 0100"
                          inputMode="tel"
                          autoComplete="tel-national"
                        />
                      </div>
                    </Field>
                  </div>
                  <Field id="email" label="Email">
                    <Input
                      id="email"
                      value={fields.email}
                      onChange={(event) =>
                        updateField("email", event.target.value)
                      }
                      placeholder="alex@example.com"
                      inputMode="email"
                      autoComplete="email"
                    />
                  </Field>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Building2
                    className="h-3.5 w-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <p className="text-xs font-medium text-muted-foreground">
                    {type === "BUSINESS" ? "Business" : "Organization"}
                  </p>
                </div>

                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Field id="company" label="Company">
                    <Input
                      id="company"
                      value={fields.company}
                      onChange={(event) =>
                        updateField("company", event.target.value)
                      }
                      placeholder="ContactBook"
                    />
                  </Field>
                  <Field id="website" label="Website">
                    <Input
                      id="website"
                      value={fields.website}
                      onChange={(event) =>
                        updateField("website", event.target.value)
                      }
                      placeholder="contactbook.app"
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field id="address" label="Address">
                      <Input
                        id="address"
                        value={fields.address}
                        onChange={(event) =>
                          updateField("address", event.target.value)
                        }
                        placeholder="San Francisco, CA"
                        autoComplete="street-address"
                      />
                    </Field>
                  </div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                title="Color"
                description="Theme"
                icon={
                  <span
                    className="h-3.5 w-3.5 rounded-full"
                    style={{ backgroundColor: theme.primary }}
                    aria-hidden="true"
                  />
                }
                open={colorOpen}
                onOpenChange={setColorOpen}
              >
                <CardThemePicker value={theme} onChange={setTheme} />
              </CollapsibleSection>

              <CollapsibleSection
                title="Socials"
                description="Optional"
                icon={<Share2 className="h-4 w-4" aria-hidden="true" />}
                open={socialsOpen}
                onOpenChange={setSocialsOpen}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="linkedin" label="LinkedIn">
                    <Input
                      id="linkedin"
                      value={fields.linkedin}
                      onChange={(event) =>
                        updateField("linkedin", event.target.value)
                      }
                      placeholder="linkedin.com/in/you"
                    />
                  </Field>
                  <Field id="twitter" label="X / Twitter">
                    <Input
                      id="twitter"
                      value={fields.twitter}
                      onChange={(event) =>
                        updateField("twitter", event.target.value)
                      }
                      placeholder="x.com/you"
                    />
                  </Field>
                  <Field id="facebook" label="Facebook">
                    <Input
                      id="facebook"
                      value={fields.facebook}
                      onChange={(event) =>
                        updateField("facebook", event.target.value)
                      }
                      placeholder="facebook.com/you"
                    />
                  </Field>
                  <Field id="instagram" label="Instagram">
                    <Input
                      id="instagram"
                      value={fields.instagram}
                      onChange={(event) =>
                        updateField("instagram", event.target.value)
                      }
                      placeholder="instagram.com/you"
                    />
                  </Field>
                </div>
              </CollapsibleSection>
            </div>
          </div>

          {/* Sticky actions — always in frame */}
          <div className="shrink-0 border-t border-border bg-surface px-4 py-3 sm:px-5 md:px-6">
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Button
                type="button"
                onClick={() => void createCard()}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                )}
                Create card
              </Button>
              <Button type="button" variant="outline" onClick={skipCard}>
                Go to dashboard
              </Button>
            </div>
          </div>
        </div>

        {/* Desktop live preview — fixed, full card in one view */}
        <aside className="hidden min-h-0 min-w-0 flex-col overflow-hidden border-l border-border bg-surface lg:flex">
          <div className="flex shrink-0 items-center justify-between gap-2 px-5 py-3 lg:px-6">
            <p className="text-sm font-semibold text-foreground">Live card</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => setFullMobilePreviewOpen(true)}
            >
              <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
              Phone
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden px-3 pb-4">
            <LivePreviewPane
              fields={fields}
              theme={theme}
              template={template}
            />
          </div>
        </aside>
      </div>

      <MobileCardPreview
        open={fullMobilePreviewOpen}
        onClose={() => setFullMobilePreviewOpen(false)}
        fields={fields}
        theme={theme}
        template={template}
        title={cardName.trim() || "Card preview"}
      />
    </section>
  );
}

export default function CardOnboardingPage() {
  const navigate = useNavigate();

  return (
    <AppShell>
      <CardOnboardingModal
        mode="create"
        onComplete={(card) =>
          navigate(`/dashboard/cards/${card.id}`, { replace: true })
        }
        onSkip={() => navigate("/dashboard", { replace: true })}
      />
    </AppShell>
  );
}
