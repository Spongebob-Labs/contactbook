import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ChevronDown,
  Loader2,
  Share2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { CardThemePicker } from "@/components/cards/card-theme-picker";
import {
  LiveCardPreview,
  type LiveCardFace,
  type LiveCardOrientation,
} from "@/components/cards/live-card-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { apiFetch } from "@/lib/api";
import {
  DEFAULT_CARD_THEME,
  EMPTY_CARD_FIELDS,
} from "@/lib/card-maker";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { createLocalCard, USE_LOCAL_CARDS } from "@/lib/local-cards";
import type {
  ContactCard,
  ContactCardFields,
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
    <section className="overflow-hidden rounded-2xl border border-border bg-muted/20">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-bg-hover/60 sm:px-5"
        aria-expanded={open}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-primary">
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
  face,
  onFaceChange,
  orientation,
  onOrientationChange,
}: {
  fields: ContactCardFields;
  theme: ContactCardTheme;
  face: LiveCardFace;
  onFaceChange: (face: LiveCardFace) => void;
  orientation: LiveCardOrientation;
  onOrientationChange: (orientation: LiveCardOrientation) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <SegmentedTabs
          aria-label="Card orientation"
          className="w-full"
          value={orientation}
          onChange={onOrientationChange}
          items={[
            { key: "portrait", label: "Mobile" },
            { key: "landscape", label: "Landscape" },
          ]}
        />
        <SegmentedTabs
          aria-label="Card face"
          className="w-full"
          value={face}
          onChange={onFaceChange}
          items={[
            { key: "front", label: "Front" },
            { key: "back", label: "Back" },
          ]}
        />
      </div>
      <div
        className={cn(
          "flex justify-center",
          orientation === "landscape" && "px-1",
        )}
      >
        <LiveCardPreview
          fields={fields}
          theme={theme}
          face={face}
          orientation={orientation}
        />
      </div>
      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        {orientation === "portrait"
          ? face === "front"
            ? "Mobile share view — identity, actions, and socials."
            : "Mobile back — scan QR and read contact details."
          : face === "front"
            ? "Landscape Stealth card — event-ready identity layout."
            : "Landscape back — Stealth card with share QR."}
      </p>
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
  const [isSaving, setIsSaving] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [colorOpen, setColorOpen] = useState(true);
  const [socialsOpen, setSocialsOpen] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(true);
  const [previewFace, setPreviewFace] = useState<LiveCardFace>("front");
  const [previewOrientation, setPreviewOrientation] =
    useState<LiveCardOrientation>("portrait");

  const selectedType = cardTypeOptions.find((option) => option.value === type);

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
      phone: fields.phone.trim(),
      email: fields.email.trim(),
      company: fields.company.trim(),
      address: fields.address.trim(),
      website: fields.website.trim(),
      linkedin: fields.linkedin.trim(),
      twitter: fields.twitter.trim(),
      facebook: fields.facebook.trim(),
      instagram: fields.instagram.trim(),
    };

    setIsSaving(true);
    try {
      const card = USE_LOCAL_CARDS
        ? createLocalCard({
            name: cleanedName,
            type,
            fields: payloadFields,
            theme,
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
      {/* Fixed height shell so panes scroll instead of clipping */}
      <div className="flex h-[calc(100dvh-1.5rem)] w-full max-w-6xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl sm:h-[calc(100dvh-2rem)] lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        {/* Editor column */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 md:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <Badge variant={isSetupMode ? "success" : "secondary"}>
                  {isSetupMode ? "Final setup step" : "Card"}
                </Badge>
                <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">
                  {isSetupMode
                    ? "Create your first ContactBook card."
                    : "Create a ContactBook card."}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Fill in your details and watch the shareable card update live.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={skipCard}
                className="self-start"
              >
                Skip for now
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            {/* Mobile / tablet live preview — collapsible */}
            <div className="mt-5 lg:hidden">
              <CollapsibleSection
                title="Live preview"
                description="Front and back of your mobile card."
                icon={<BadgeCheck className="h-4 w-4" aria-hidden="true" />}
                open={mobilePreviewOpen}
                onOpenChange={setMobilePreviewOpen}
              >
                <LivePreviewPane
                  fields={fields}
                  theme={theme}
                  face={previewFace}
                  onFaceChange={setPreviewFace}
                  orientation={previewOrientation}
                  onOrientationChange={setPreviewOrientation}
                />
              </CollapsibleSection>
            </div>

            <div className="mt-6 grid gap-4">
              <section className="grid gap-4 sm:grid-cols-2">
                <Field id="card-name" label="Card name">
                  <Input
                    id="card-name"
                    value={cardName}
                    onChange={(event) => setCardName(event.target.value)}
                    placeholder="My personal card"
                  />
                </Field>
                <Field
                  id="card-type"
                  label="Card type"
                  hint={selectedType?.description}
                >
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
                description="Name, contact, and organization on the card."
                icon={<UserRound className="h-4 w-4" aria-hidden="true" />}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
              >
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
                  <Field id="phone" label="Phone">
                    <Input
                      id="phone"
                      value={fields.phone}
                      onChange={(event) =>
                        updateField("phone", event.target.value)
                      }
                      placeholder="+1 555 0100"
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </Field>
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
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
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
                title="Card color"
                description="Premium swatches or a custom hex."
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
                description="Optional links at the bottom of the card."
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
          <div className="shrink-0 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-sm sm:px-5 md:px-6">
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

        {/* Desktop live preview — independent scroll */}
        <aside className="hidden min-h-0 min-w-0 flex-col border-l border-border bg-muted/35 lg:flex">
          <div className="shrink-0 border-b border-border px-5 py-4 lg:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Live card
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Mobile or landscape · Front or Back. Theme drives accents.
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 lg:px-6">
            <LivePreviewPane
              fields={fields}
              theme={theme}
              face={previewFace}
              onFaceChange={setPreviewFace}
              orientation={previewOrientation}
              onOrientationChange={setPreviewOrientation}
            />
          </div>
        </aside>
      </div>
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
