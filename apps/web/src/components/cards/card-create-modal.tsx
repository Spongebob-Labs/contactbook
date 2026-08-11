import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import { toast } from "sonner";
import { AlertCircle, ChevronDown, Info } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";
import {
  readAllCardFieldSelections,
  writeCardFieldSelection,
} from "@/lib/card-field-selection";
import {
  defaultSelectionFor,
  listCardPresets,
  resolvePresetFields,
  type CardPreset,
  type PresetFieldRow,
} from "@/lib/card-presets";
import {
  EMPTY_ADDRESS,
  formatAddress,
  type CardProfileField,
} from "@/lib/card-profile-fields";
import {
  SHAREABLE_FIELD_META,
  SHAREABLE_FIELD_TYPES,
  type ShareableFieldType,
} from "@/lib/card-share-types";
import {
  copyCardFieldMappings,
  createCard,
  listCardsWithFieldCounts,
} from "@/lib/cards-api";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { fetchProfileMe } from "@/lib/profile-api";
import { cn } from "@/lib/utils";
import type { ContactCard, ContactCardType, ProfileMeResponse } from "@/lib/types";

export type CardCreateModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (card: ContactCard) => void;
};

/** Friendly labels for the API's card types — "Work" reads better than "Business" here. */
const CARD_TYPE_OPTIONS: Array<{ value: ContactCardType; label: string }> = [
  { value: "PERSONAL", label: "Personal" },
  { value: "BUSINESS", label: "Work" },
  { value: "CUSTOM", label: "Custom" },
];

const STEP_LABELS = ["Card", "Start from", "What it shares"] as const;
const TOTAL_STEPS = STEP_LABELS.length;

/**
 * How long step 2 may wait on the card list before offering a retry instead.
 * Generous — this is a stuck-request backstop, not a latency budget.
 */
const PRESET_LOAD_TIMEOUT_MS = 15_000;

/** Preset id standing for "Start blank" — no card is copied. */
const START_BLANK = "";

const NO_VALUE_NOTE = "Not added yet — add it on your profile.";

function cardTypeLabel(type: ContactCardType): string {
  return CARD_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? "Custom";
}

/** The field labels a preset gives, e.g. "Mobile · Email · Photo". */
function presetOffersSummary(preset: CardPreset): string {
  return preset.offers.map((type) => SHAREABLE_FIELD_META[type].label).join(" · ");
}

/** Address rows keep their parts in `address` and always carry a blank `value`. */
function fieldValueText(field: CardProfileField): string {
  if (field.inputKind === "address") {
    return formatAddress(field.address ?? EMPTY_ADDRESS);
  }
  return field.value;
}

/**
 * Three-step card creator: name + type, the card it starts from, then the
 * fields it will share.
 *
 * Step 2 exists because `POST /cards` creates a card with zero field mappings —
 * a name-only vCard — and `copyCardFieldMappings` is the only way the web app
 * can give it content, since no endpoint lists profile field ids.
 *
 * Step 3 only picks which of those fields get shared; the values themselves are
 * edited on the profile and the card page, never here.
 */
export function CardCreateModal({
  open,
  onClose,
  onCreated,
}: CardCreateModalProps): JSX.Element | null {
  const { profileIdentity, userId } = useAuth();

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [type, setType] = useState<ContactCardType>("PERSONAL");
  const [isCreating, setIsCreating] = useState(false);

  const [existingCards, setExistingCards] = useState<ContactCard[]>([]);
  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [presetsLoaded, setPresetsLoaded] = useState(false);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);
  const [presetsError, setPresetsError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Null means "not chosen yet", which resolves to the most recently updated
  // card. `START_BLANK` is a real choice and must not collapse into it.
  const [presetChoice, setPresetChoice] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<ShareableFieldType[]>([]);
  const [showAdditional, setShowAdditional] = useState(false);

  // Read through a ref so a late-arriving profile identity cannot re-run the
  // reset effect below and wipe what the user has already typed.
  const profileIdentityRef = useRef(profileIdentity);
  useEffect(() => {
    profileIdentityRef.current = profileIdentity;
  }, [profileIdentity]);

  // Resets whenever the modal opens. Deliberately keyed on `open` alone and free
  // of any "have I already run?" guard: anything that blocks a re-run
  // (StrictMode's double-invoke, a re-render mid-flight) would leave a stale
  // wizard on screen.
  useEffect(() => {
    if (!open) {
      return;
    }

    const identity = profileIdentityRef.current;
    setStep(1);
    setName(`${identity?.firstName ?? ""} ${identity?.lastName ?? ""}`.trim());
    setType("PERSONAL");
    setExistingCards([]);
    setProfile(null);
    setPresetsLoaded(false);
    setIsLoadingPresets(false);
    setPresetsError(null);
    setPresetChoice(null);
    setSelectedTypes([]);
    setShowAdditional(false);
  }, [open]);

  /*
   * Loads as soon as the modal opens rather than when step 2 is reached: the
   * user spends step 1 typing a name, and that is free time to spend on the
   * network instead of making them watch skeletons on arrival.
   *
   * The two requests are settled independently, not with `Promise.all`. Only
   * the card list can populate step 2; the profile merely enriches the
   * descriptions and supplies the values step 3 shows. Failing them together
   * meant a slow or broken `/profile/me` stranded the user on a step that had
   * cards to offer.
   */
  useEffect(() => {
    if (!open || presetsLoaded) {
      return;
    }
    setIsLoadingPresets(true);
    setPresetsError(null);

    let isCancelled = false;

    // Nothing in the fetch layer times out, so a request that never settles
    // would hold step 2 on skeletons with Next disabled and no way forward.
    // This converts that dead end into something the user can act on.
    const watchdog = window.setTimeout(() => {
      if (isCancelled) {
        return;
      }
      setPresetsError(friendlyErrorMessages.load);
      setIsLoadingPresets(false);
    }, PRESET_LOAD_TIMEOUT_MS);

    void listCardsWithFieldCounts()
      .then((cards) => {
        window.clearTimeout(watchdog);
        if (isCancelled) {
          return;
        }
        setExistingCards(cards);
        setPresetsLoaded(true);
        // Cleared alongside the data rather than in a `finally`, so no ordering
        // between the two can leave step 2 stuck on skeletons.
        setIsLoadingPresets(false);
      })
      .catch((error) => {
        // Cleared here too: a real failure message must not be overwritten by
        // the watchdog's generic one a few seconds later.
        window.clearTimeout(watchdog);
        if (isCancelled) {
          return;
        }
        logUiError("Could not load your cards", error);
        setPresetsError(
          error instanceof ApiError && error.message
            ? error.message
            : friendlyErrorMessages.load,
        );
        setIsLoadingPresets(false);
      });

    void fetchProfileMe()
      .then((loadedProfile) => {
        if (!isCancelled) {
          setProfile(loadedProfile);
        }
      })
      .catch((error) => {
        // Non-fatal by design: rows fall back to "not added yet" and the user
        // can still pick a preset and create the card.
        logUiError("Could not load your profile details", error);
      });

    return () => {
      isCancelled = true;
      window.clearTimeout(watchdog);
    };
  }, [open, presetsLoaded, reloadToken]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!isCreating) {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, isCreating, onClose]);

  const presets = useMemo(
    () => listCardPresets(existingCards, readAllCardFieldSelections(userId), profile),
    [existingCards, profile, userId],
  );
  // Presets arrive newest-first, so the head is the preselected one.
  const activePresetId = presetChoice ?? presets[0]?.cardId ?? START_BLANK;
  const activePreset = useMemo(
    () => presets.find((preset) => preset.cardId === activePresetId) ?? null,
    [presets, activePresetId],
  );
  const { offered, additional } = useMemo(
    () => resolvePresetFields(activePreset, type, profile),
    [activePreset, type, profile],
  );

  // Re-derives the ticks whenever the preset, the card type or the profile
  // changes — every one of those changes the rows step 3 is about to show.
  useEffect(() => {
    setSelectedTypes(defaultSelectionFor(activePreset, type, profile));
  }, [activePreset, type, profile]);

  if (!open) {
    return null;
  }

  const trimmedName = name.trim();
  const selectedSet = new Set(selectedTypes);
  const nextDisabled =
    isCreating ||
    (step === 1 && trimmedName.length === 0) ||
    (step === 2 && isLoadingPresets);

  const handleDismiss = () => {
    if (!isCreating) {
      onClose();
    }
  };

  const handleNext = () => {
    if (step === 1 && trimmedName.length === 0) {
      return;
    }
    setStep((current) => Math.min(TOTAL_STEPS, current + 1));
  };

  const handleBack = () => {
    setStep((current) => Math.max(1, current - 1));
  };

  const toggleType = (fieldType: ShareableFieldType) => {
    setSelectedTypes((current) => {
      const next = new Set(current);
      if (next.has(fieldType)) {
        next.delete(fieldType);
      } else {
        next.add(fieldType);
      }
      return SHAREABLE_FIELD_TYPES.filter((candidate) => next.has(candidate));
    });
  };

  const handleCreate = async () => {
    if (trimmedName.length === 0) {
      setStep(1);
      return;
    }
    setIsCreating(true);
    try {
      const card = await createCard({ name: trimmedName, type });

      let copied = 0;
      if (activePreset) {
        try {
          const result = await copyCardFieldMappings(activePreset.cardId, card.id);
          copied = result.copied;
        } catch (error) {
          logUiError("Could not copy card details", error);
          toast.warning(
            "Card created, but its details couldn't be copied — you can copy them from the card page.",
          );
        }
      }

      // Persisted last, so a failed create never leaves a selection behind for
      // an id that does not exist.
      writeCardFieldSelection(userId, card.id, selectedTypes);

      toast.success(
        copied > 0
          ? `Card created with ${copied} detail${copied === 1 ? "" : "s"}.`
          : "Card created.",
      );
      onCreated(card);
      onClose();
    } catch (error) {
      logUiError("Could not create card", error);
      toast.error(
        error instanceof ApiError && error.message
          ? error.message
          : friendlyErrorMessages.save,
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        onClick={handleDismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create a card"
        className="overlay-enter relative z-10 max-h-[85vh] w-full max-w-3xl space-y-4 overflow-y-auto overscroll-contain rounded-t-xl border border-border bg-surface p-5 sm:max-h-[calc(100vh-2rem)] sm:rounded-xl"
      >
        <div>
          <h2 className="text-base font-semibold text-foreground">Create a card</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Name it, choose the card it starts from, and confirm what it shares. You can
            change any of this later from the card page.
          </p>
        </div>

        <p className="label-section">{STEP_LABELS[step - 1]}</p>

        {step === 1 ? (
          <div className="space-y-4">
            <label className="flex flex-col gap-2 text-sm font-medium">
              <span>Card name</span>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value.slice(0, 200))}
                placeholder="e.g. Personal card"
                disabled={isCreating}
              />
            </label>
            <div className="flex flex-col gap-2 text-sm font-medium">
              <span>Card type</span>
              <div role="radiogroup" aria-label="Card type" className="grid grid-cols-3 gap-2">
                {CARD_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={type === option.value}
                    onClick={() => setType(option.value)}
                    disabled={isCreating}
                    className={cn(
                      "rounded-md border px-3 py-2 text-center text-sm font-medium transition-colors duration-150",
                      type === option.value
                        ? "border-foreground bg-bg-hover text-foreground"
                        : "border-border text-muted-foreground hover:bg-bg-hover",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A new card starts with nothing on it, so it copies the details of the card
              you pick here.
            </p>

            {isLoadingPresets ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : null}

            {!isLoadingPresets && presetsError ? (
              <Alert className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
                <div className="flex-1">
                  <p className="font-medium">Could not load your cards</p>
                  <p className="mt-1 text-sm text-muted-foreground">{presetsError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setReloadToken((current) => current + 1)}
                  >
                    Retry
                  </Button>
                </div>
              </Alert>
            ) : null}

            {!isLoadingPresets && !presetsError && presets.length === 0 ? (
              <Alert className="flex items-start gap-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
                <div>
                  <p className="font-medium">You have no other card to start from</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This card will share only your name until you add details to it from
                    the card page.
                  </p>
                </div>
              </Alert>
            ) : null}

            {!isLoadingPresets && presets.length > 0 ? (
              <div role="radiogroup" aria-label="Start from" className="space-y-2">
                {presets.map((preset) => (
                  <PresetOption
                    key={preset.cardId}
                    checked={activePresetId === preset.cardId}
                    disabled={isCreating}
                    onSelect={() => setPresetChoice(preset.cardId)}
                    title={preset.name}
                    badge={cardTypeLabel(preset.type)}
                    description={
                      preset.isEmpty
                        ? "This card has no details yet — copying it shares only your name."
                        : presetOffersSummary(preset) ||
                          "Nothing to list yet — your profile has no details for this card type."
                    }
                  />
                ))}
                <PresetOption
                  checked={activePresetId === START_BLANK}
                  disabled={isCreating}
                  onSelect={() => setPresetChoice(START_BLANK)}
                  title="Start blank"
                  description="Shares only your name until you add details."
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {activePreset
                ? `These come from ${activePreset.name}. Untick anything this card should keep to itself.`
                : "This card starts empty, so it shares only your name. Pick anything you want it to share once its details are added."}
            </p>

            {offered.length > 0 ? (
              <div className="space-y-2">
                {offered.map((row) => (
                  <ShareFieldRow
                    key={row.field.key}
                    row={row}
                    checked={selectedSet.has(row.field.type)}
                    disabled={isCreating}
                    onToggle={toggleType}
                  />
                ))}
              </div>
            ) : null}

            {offered.length > 0 && selectedTypes.length === 0 ? (
              <div className="flex items-start gap-2 rounded-md border border-border bg-secondary p-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground">
                  Nothing ticked — this card will share every detail copied onto it.
                </p>
              </div>
            ) : null}

            {additional.length > 0 ? (
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  aria-expanded={showAdditional}
                  onClick={() => setShowAdditional((current) => !current)}
                >
                  <span>Add more fields</span>
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform duration-150", showAdditional && "rotate-180")}
                    aria-hidden="true"
                  />
                </Button>
                {showAdditional ? (
                  <div className="space-y-2">
                    {additional.map((row) => (
                      <ShareFieldRow
                        key={row.field.key}
                        row={row}
                        checked={selectedSet.has(row.field.type)}
                        disabled={isCreating}
                        onToggle={toggleType}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={step === 1 || isCreating}
          >
            Back
          </Button>
          <div className="flex items-center gap-3">
            <Badge variant="success">
              Step {step} of {TOTAL_STEPS}
            </Badge>
            {step < TOTAL_STEPS ? (
              <Button type="button" onClick={handleNext} disabled={nextDisabled}>
                Next
              </Button>
            ) : (
              <Button type="button" onClick={() => void handleCreate()} disabled={isCreating}>
                {isCreating ? "Creating…" : "Create card"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type PresetOptionProps = {
  checked: boolean;
  disabled: boolean;
  onSelect: () => void;
  title: string;
  badge?: string;
  description: string;
};

/** One "start from" choice. Matches the step 1 type picker's radio pattern. */
function PresetOption({
  checked,
  disabled,
  onSelect,
  title,
  badge,
  description,
}: PresetOptionProps): JSX.Element {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "w-full rounded-lg border px-3 py-3 text-left transition-colors duration-150",
        checked
          ? "border-foreground bg-bg-hover"
          : "border-border hover:bg-bg-hover",
      )}
    >
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">{title}</span>
        {badge ? <Badge variant="outline">{badge}</Badge> : null}
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
    </button>
  );
}

type ShareFieldRowProps = {
  row: PresetFieldRow;
  checked: boolean;
  disabled: boolean;
  onToggle: (type: ShareableFieldType) => void;
};

/**
 * One read-only field row. The tick is per field *type*, not per row, because
 * that is all `/vcard` and `/share` filter on — so the social rows, which share
 * `SOCIAL_LINK`, move together.
 */
function ShareFieldRow({ row, checked, disabled, onToggle }: ShareFieldRowProps): JSX.Element {
  const inputId = `card-field-${row.field.key}`;
  const noteId = `${inputId}-note`;
  const value = fieldValueText(row.field);

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border border-border p-3",
        row.isEmpty ? "bg-muted" : "bg-surface",
      )}
    >
      <input
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0"
        checked={checked}
        // An empty field cannot be shared, so ticking it would be a lie.
        disabled={disabled || row.isEmpty}
        aria-describedby={row.isEmpty ? noteId : undefined}
        onChange={() => onToggle(row.field.type)}
      />
      <div className="min-w-0 flex-1">
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {row.field.label}
        </label>
        {row.isEmpty ? (
          <p id={noteId} className="mt-1 text-xs text-muted-foreground">
            {NO_VALUE_NOTE}
          </p>
        ) : row.field.inputKind === "photo" ? (
          <span className="mt-1 flex items-center gap-2">
            <img
              src={value}
              alt=""
              className="h-8 w-8 rounded-md border border-border object-cover"
            />
            <span className="text-sm text-muted-foreground">Added</span>
          </span>
        ) : (
          <p className="mt-1 truncate text-sm text-muted-foreground">{value}</p>
        )}
      </div>
    </div>
  );
}
