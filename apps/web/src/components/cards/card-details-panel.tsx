/**
 * One card's details: what each detail is, and whether it goes out when shared.
 *
 * Both live here on purpose. They used to sit in separate tabs, which read as
 * two unrelated jobs when they are really one question — "what does this card
 * say about me?" — and the split let a user fill in a value on one tab, tick it
 * on another, and never learn that the two had nothing to do with each other.
 *
 * The two axes still behave differently, and the layout says so rather than
 * explaining it in prose: values are edits to your profile and wait for Save;
 * switches are this card's own filter and apply immediately.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api";
import {
  EMPTY_ADDRESS,
  buildCardProfilePatch,
  formatAddress,
  isAddressEmpty,
  listCardProfileFields,
  usesWorkGroup,
  type CardProfileAddress,
  type CardProfileEdits,
  type CardProfileField,
} from "@/lib/card-profile-fields";
import {
  SHAREABLE_FIELD_META,
  SHAREABLE_FIELD_TYPES,
  type ShareableFieldType,
} from "@/lib/card-share-types";
import {
  copyCardFieldMappings,
  listCardFieldMappings,
  listCardsWithFieldCounts,
} from "@/lib/cards-api";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { fetchProfileMe, patchProfileMe, uploadProfilePhoto } from "@/lib/profile-api";
import type { ContactCard, ContactCardType, ProfileMeResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

export type CardDetailsPanelProps = {
  /** Null while a card is still being created — just hides card-specific copy. */
  cardId: string | null;
  cardType: ContactCardType;
  /** Types this card shares. Empty array = share everything attached to it. */
  selectedTypes: ShareableFieldType[];
  onSelectedTypesChange: (next: ShareableFieldType[]) => void;
  /** True when the card carries no profile fields at all — a name-only vCard. */
  isEmpty?: boolean;
  /** Fired after a successful profile save, so the parent can refresh the card. */
  onSaved?: () => void;
  className?: string;
};

const EMPTY_EDITS: CardProfileEdits = { values: {}, addresses: {} };

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Section headings for a work card, keyed by `CardProfileField.key`. */
const WORK_GROUPS: Record<string, string> = {
  companyLogo: "Company",
  companyName: "Company",
  workTitle: "Company",
  department: "Company",
  workMobile: "Contact",
  workLandline: "Contact",
  workFax: "Contact",
  workEmail: "Contact",
  website: "Contact",
  workPostalAddress: "Address",
};
const WORK_GROUP_ORDER = ["Company", "Contact", "Address"];

/** Section headings for a personal card, keyed by `CardProfileField.key`. */
const PERSONAL_GROUPS: Record<string, string> = {
  profilePhoto: "You",
  dateOfBirth: "You",
  mobile: "Contact",
  landline: "Contact",
  email: "Contact",
  postalAddress: "Address",
  website: "Links",
  linkedin: "Links",
  twitter: "Links",
  facebook: "Links",
  whatsApp: "Links",
  blog: "Links",
};
const PERSONAL_GROUP_ORDER = ["You", "Contact", "Address", "Links"];

/**
 * What to call a switch that governs more than one detail.
 *
 * The share filter is keyed by `FieldType`, not by field, so one switch really
 * does control every social link at once. Naming it for the group is the only
 * honest option — a switch labelled "Facebook" that also sends the user's X and
 * WhatsApp links is a lie the old per-field checkboxes told.
 */
const SHARED_GROUP_TITLES: Partial<Record<ShareableFieldType, string>> = {
  SOCIAL_LINK: "Social links",
};

type FieldSection = { heading: string; groups: TypeGroup[] };

/** Fields that share one `FieldType`, and therefore one share switch. */
type TypeGroup = {
  key: string;
  type: ShareableFieldType;
  title: string;
  fields: CardProfileField[];
};

function groupByType(fields: CardProfileField[]): TypeGroup[] {
  const order: ShareableFieldType[] = [];
  const byType = new Map<ShareableFieldType, CardProfileField[]>();
  for (const field of fields) {
    const bucket = byType.get(field.type);
    if (bucket) {
      bucket.push(field);
      continue;
    }
    byType.set(field.type, [field]);
    order.push(field.type);
  }
  return order.map((type) => {
    const group = byType.get(type) ?? [];
    const title =
      group.length === 1
        ? group[0].label
        : (SHARED_GROUP_TITLES[type] ?? SHAREABLE_FIELD_META[type].label);
    return { key: `${type}:${group[0]?.key ?? ""}`, type, title, fields: group };
  });
}

function sectionise(
  fields: CardProfileField[],
  cardType: ContactCardType,
): FieldSection[] {
  const map = usesWorkGroup(cardType) ? WORK_GROUPS : PERSONAL_GROUPS;
  const order = usesWorkGroup(cardType) ? WORK_GROUP_ORDER : PERSONAL_GROUP_ORDER;
  const buckets = new Map<string, CardProfileField[]>();
  for (const field of fields) {
    const heading = map[field.key] ?? "Other";
    const bucket = buckets.get(heading) ?? [];
    bucket.push(field);
    buckets.set(heading, bucket);
  }
  return [...order, "Other"]
    .filter((heading) => buckets.has(heading))
    .map((heading) => ({
      heading,
      groups: groupByType(buckets.get(heading) ?? []),
    }));
}

/** One card's details, and which of them go out when it is shared. */
export function CardDetailsPanel({
  cardId,
  cardType,
  selectedTypes,
  onSelectedTypesChange,
  isEmpty = false,
  onSaved,
  className,
}: CardDetailsPanelProps) {
  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [edits, setEdits] = useState<CardProfileEdits>(EMPTY_EDITS);
  const [isSaving, setIsSaving] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  /**
   * Other cards of the user's that already carry fields, so an empty card has a
   * recovery path that works against the current API. Copying goes through
   * `POST /cards/:id/field-mappings`, which needs a `fieldId` — and the only
   * place those ids can be read is another card's mapping list.
   */
  const [sourceCards, setSourceCards] = useState<ContactCard[]>([]);
  const [sourceCardId, setSourceCardId] = useState("");
  const [isCopying, setIsCopying] = useState(false);
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string>>({});
  const [photoBusy, setPhotoBusy] = useState<Record<string, boolean>>({});
  const [photoErrors, setPhotoErrors] = useState<Record<string, string>>({});
  const photoPreviewsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    photoPreviewsRef.current = photoPreviews;
  }, [photoPreviews]);

  useEffect(() => {
    return () => {
      Object.values(photoPreviewsRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const loadProfile = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await fetchProfileMe();
      setProfile(result);
    } catch (error) {
      logUiError("Could not load card details", error);
      setLoadError(friendlyErrorMessages.load);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only when there is a hole to fill: this is one request per card.
  useEffect(() => {
    if (!isEmpty || !cardId) {
      setSourceCards([]);
      return;
    }
    let isCurrent = true;
    void (async () => {
      try {
        const cards = await listCardsWithFieldCounts();
        if (!isCurrent) {
          return;
        }
        const usable = cards.filter(
          (candidate) =>
            candidate.id !== cardId && (candidate.mappedFieldIds?.length ?? 0) > 0,
        );
        setSourceCards(usable);
        setSourceCardId(usable[0]?.id ?? "");
      } catch (error) {
        logUiError("Could not list cards to copy details from", error);
        if (isCurrent) {
          setSourceCards([]);
        }
      }
    })();
    return () => {
      isCurrent = false;
    };
  }, [isEmpty, cardId]);

  // A field the API cannot store is not a setting, it is an apology. Dropping it
  // costs the user nothing and removes two dead rows from every card.
  const fields = useMemo(
    () => listCardProfileFields(profile, cardType).filter((field) => field.editable),
    [profile, cardType],
  );
  const sections = useMemo(() => sectionise(fields, cardType), [fields, cardType]);

  const effectiveValue = (field: CardProfileField): string =>
    edits.values[field.key] ?? field.value;
  const effectiveAddress = (field: CardProfileField): CardProfileAddress =>
    edits.addresses[field.key] ?? field.address ?? EMPTY_ADDRESS;

  const isFilled = (field: CardProfileField): boolean =>
    field.inputKind === "address"
      ? !isAddressEmpty(effectiveAddress(field))
      : effectiveValue(field).trim().length > 0;

  /**
   * Only edits that actually differ count, so typing a value and undoing it puts
   * the save bar away instead of leaving a change that no longer exists.
   */
  const changedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const field of fields) {
      if (field.inputKind === "address") {
        const next = edits.addresses[field.key];
        if (
          next &&
          formatAddress(next) !== formatAddress(field.address ?? EMPTY_ADDRESS)
        ) {
          keys.add(field.key);
        }
        continue;
      }
      const next = edits.values[field.key];
      if (next !== undefined && next.trim() !== field.value.trim()) {
        keys.add(field.key);
      }
    }
    return keys;
  }, [fields, edits]);
  const isDirty = changedKeys.size > 0;

  /** Types this editor can show, in canonical order. */
  const visibleTypes = useMemo(() => {
    const present = new Set(fields.map((field) => field.type));
    return SHAREABLE_FIELD_TYPES.filter((type) => present.has(type));
  }, [fields]);

  /**
   * An empty stored selection means "share everything attached to this card", so
   * it is rendered as every switch on rather than every switch off. The old UI
   * showed the literal empty state and had to caption it with the opposite of
   * what it looked like.
   */
  const sharesEverything = selectedTypes.length === 0;
  const sharedTypes = useMemo(
    () => (sharesEverything ? new Set(visibleTypes) : new Set(selectedTypes)),
    [sharesEverything, visibleTypes, selectedTypes],
  );

  const filledFields = fields.filter(isFilled);
  const sharedFilledCount = filledFields.filter((field) =>
    sharedTypes.has(field.type),
  ).length;
  /** Switch groups that are both filled in and switched on. */
  const liveTypeCount = new Set(
    filledFields.filter((field) => sharedTypes.has(field.type)).map((f) => f.type),
  ).size;

  const setFieldValue = (key: string, value: string) => {
    setEdits((prev) => ({ ...prev, values: { ...prev.values, [key]: value } }));
  };
  const setFieldAddress = (key: string, address: CardProfileAddress) => {
    setEdits((prev) => ({ ...prev, addresses: { ...prev.addresses, [key]: address } }));
  };

  const toggleType = (type: ShareableFieldType) => {
    const next = new Set(sharedTypes);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    // Materialised from what is on screen: narrowing away from "everything" must
    // not silently keep sharing a type this editor never showed.
    onSelectedTypesChange(SHAREABLE_FIELD_TYPES.filter((candidate) => next.has(candidate)));
  };

  const handlePhotoSelect = async (field: CardProfileField, file: File | undefined) => {
    if (!file) {
      return;
    }
    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      setPhotoErrors((prev) => ({ ...prev, [field.key]: "Choose a JPEG, PNG, or WebP image." }));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoErrors((prev) => ({ ...prev, [field.key]: "Choose an image under 5 MB." }));
      return;
    }
    setPhotoErrors((prev) => ({ ...prev, [field.key]: "" }));

    const previousPreview = photoPreviews[field.key];
    const objectUrl = URL.createObjectURL(file);
    if (previousPreview) {
      URL.revokeObjectURL(previousPreview);
    }
    setPhotoPreviews((prev) => ({ ...prev, [field.key]: objectUrl }));
    setPhotoBusy((prev) => ({ ...prev, [field.key]: true }));

    try {
      const { url } = await uploadProfilePhoto(file);
      setFieldValue(field.key, url);
    } catch (error) {
      logUiError("Could not upload photo", error);
      toast.error(
        error instanceof ApiError && error.message ? error.message : friendlyErrorMessages.save,
      );
      setPhotoPreviews((prev) => {
        const current = prev[field.key];
        if (current) {
          URL.revokeObjectURL(current);
        }
        const next = { ...prev };
        delete next[field.key];
        return next;
      });
    } finally {
      setPhotoBusy((prev) => ({ ...prev, [field.key]: false }));
    }
  };

  const handlePhotoRemove = (field: CardProfileField) => {
    const preview = photoPreviews[field.key];
    if (preview) {
      URL.revokeObjectURL(preview);
      setPhotoPreviews((prev) => {
        const next = { ...prev };
        delete next[field.key];
        return next;
      });
    }
    setPhotoErrors((prev) => ({ ...prev, [field.key]: "" }));
    setFieldValue(field.key, "");
  };

  /**
   * Writes the profile and refreshes it. Called with the pending edits by Save,
   * and with none by "Add my details" — an unchanged patch is what makes the
   * server attach this card's fields to it, so the button needs no edits of its
   * own.
   */
  const persist = async (pending: CardProfileEdits): Promise<boolean> => {
    const patch = buildCardProfilePatch(profile, cardType, pending);
    await patchProfileMe(patch);
    const refreshed = await fetchProfileMe();
    setProfile(refreshed);
    setEdits(EMPTY_EDITS);
    onSaved?.();
    return true;
  };

  const handleSave = async () => {
    if (!isDirty || isSaving) {
      return;
    }
    setIsSaving(true);
    try {
      await persist(edits);
      toast.success("Details saved.");
    } catch (error) {
      logUiError("Could not save card details", error);
      toast.error(
        error instanceof ApiError && error.message ? error.message : friendlyErrorMessages.save,
      );
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Attaching relies on the server mapping profile fields to cards during a
   * patch. Where that backfill is not deployed the patch succeeds and the card
   * stays empty, so the result is checked rather than announced — claiming
   * success and leaving a name-only card is how this looked like a broken share.
   */
  const handleAttach = async () => {
    if (isAttaching || !profile) {
      return;
    }
    setIsAttaching(true);
    try {
      await persist(edits);
      const mappings = cardId
        ? await listCardFieldMappings(cardId).catch(() => null)
        : null;
      if (mappings && mappings.length === 0) {
        toast.error(
          "Your profile saved, but this card still carries nothing. Copy details from another card instead.",
        );
      } else {
        toast.success("Your details are on this card.");
      }
    } catch (error) {
      logUiError("Could not attach details to this card", error);
      toast.error(
        error instanceof ApiError && error.message ? error.message : friendlyErrorMessages.save,
      );
    } finally {
      setIsAttaching(false);
    }
  };

  /**
   * Copies another card's field mappings onto this one. Unlike the patch above
   * this needs no server-side backfill — it reads real `fieldId`s off a card that
   * has them and posts each to `POST /cards/:id/field-mappings`.
   */
  const handleCopyFrom = async () => {
    if (!cardId || !sourceCardId || isCopying) {
      return;
    }
    setIsCopying(true);
    try {
      const { copied, total } = await copyCardFieldMappings(sourceCardId, cardId);
      if (copied === 0) {
        toast.error(
          total === 0
            ? "That card carries nothing either."
            : "Nothing could be copied across.",
        );
      } else {
        toast.success(`Copied ${copied} detail${copied === 1 ? "" : "s"} onto this card.`);
        onSaved?.();
      }
    } catch (error) {
      logUiError("Could not copy details onto this card", error);
      toast.error(
        error instanceof ApiError && error.message ? error.message : friendlyErrorMessages.save,
      );
    } finally {
      setIsCopying(false);
    }
  };

  const handleDiscard = () => {
    Object.values(photoPreviews).forEach((url) => URL.revokeObjectURL(url));
    setPhotoPreviews({});
    setPhotoErrors({});
    setEdits(EMPTY_EDITS);
  };

  return (
    <Panel className={cn("space-y-5", className)}>
      <PanelHeader
        title="Details"
        action={
          !isLoading && !loadError ? (
            <div className="flex items-center gap-3">
              <span>
                {sharedFilledCount} of {filledFields.length} shared
              </span>
              {!sharesEverything ? (
                <button
                  type="button"
                  className="font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  onClick={() => onSelectedTypesChange([])}
                >
                  Share everything
                </button>
              ) : null}
            </div>
          ) : null
        }
      />
      <p className="text-sm text-muted-foreground">
        Values live on your profile — editing one updates every card built from it.
        The switches are this card&apos;s alone.
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : null}

      {!isLoading && loadError ? (
        <Alert className="space-y-3">
          <p className="font-medium">Could not load your details</p>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadProfile()}>
            Retry
          </Button>
        </Alert>
      ) : null}

      {!isLoading && !loadError ? (
        <div className="space-y-6">
          {isEmpty ? (
            <div className="rounded-lg border border-border bg-secondary p-4">
              <p className="text-sm font-semibold text-foreground">
                Recipients would only get your name
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                None of the details below are attached to this card yet, so the
                contact file it sends is empty apart from your name. Filling a
                value in and saving does not attach it on its own.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {/*
                  Copying is first because it works whatever the server does: it
                  posts real field ids read off a card that already has them.
                  Saving the profile only attaches fields where the server's
                  card-mapping backfill is deployed.
                */}
                {sourceCards.length > 0 ? (
                  <>
                    {sourceCards.length > 1 ? (
                      <select
                        aria-label="Card to copy details from"
                        className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                        value={sourceCardId}
                        disabled={isCopying}
                        onChange={(event) => setSourceCardId(event.target.value)}
                      >
                        {sourceCards.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      disabled={isCopying || isAttaching || isSaving}
                      onClick={() => void handleCopyFrom()}
                    >
                      {isCopying
                        ? "Copying…"
                        : sourceCards.length > 1
                          ? "Copy details across"
                          : `Copy details from "${sourceCards[0].name}"`}
                    </Button>
                  </>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant={sourceCards.length > 0 ? "outline" : "default"}
                  disabled={isAttaching || isSaving || isCopying}
                  onClick={() => void handleAttach()}
                >
                  {isAttaching ? "Adding…" : "Add my details to this card"}
                </Button>
              </div>
            </div>
          ) : null}

          {/* Column headers carry the whole "two different things" explanation. */}
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="label-section">Detail</span>
            <span className="label-section">Shared</span>
          </div>

          {sections.map((section) => (
            <div key={section.heading} className="space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {section.heading}
              </h3>
              <div className="divide-y divide-border">
                {section.groups.map((group) => {
                  const groupFilled = group.fields.some(isFilled);
                  const isShared = sharedTypes.has(group.type);
                  return (
                    <DetailGroup
                      key={group.key}
                      group={group}
                      isShared={isShared}
                      isFilled={groupFilled}
                      // The API reads an empty selection as "everything", so a
                      // card with nothing switched on would quietly share the
                      // lot. The last switch therefore stays on.
                      lockedOn={isShared && groupFilled && liveTypeCount <= 1}
                      onToggle={() => toggleType(group.type)}
                      valueOf={effectiveValue}
                      addressOf={effectiveAddress}
                      onValueChange={setFieldValue}
                      onAddressChange={setFieldAddress}
                      photoPreviews={photoPreviews}
                      photoBusy={photoBusy}
                      photoErrors={photoErrors}
                      onPhotoSelect={handlePhotoSelect}
                      onPhotoRemove={handlePhotoRemove}
                      disabled={isSaving || isAttaching}
                      changedKeys={changedKeys}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {isDirty ? (
            <div className="sticky bottom-0 -mx-6 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-6 pb-1 pt-4">
              <p className="text-sm text-muted-foreground">
                {changedKeys.size} unsaved change{changedKeys.size === 1 ? "" : "s"}
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={handleDiscard} disabled={isSaving}>
                  Discard
                </Button>
                <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
                  {isSaving ? "Saving…" : "Save details"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}

type DetailGroupProps = {
  group: TypeGroup;
  isShared: boolean;
  isFilled: boolean;
  lockedOn: boolean;
  onToggle: () => void;
  valueOf: (field: CardProfileField) => string;
  addressOf: (field: CardProfileField) => CardProfileAddress;
  onValueChange: (key: string, value: string) => void;
  onAddressChange: (key: string, address: CardProfileAddress) => void;
  photoPreviews: Record<string, string>;
  photoBusy: Record<string, boolean>;
  photoErrors: Record<string, string>;
  onPhotoSelect: (field: CardProfileField, file: File | undefined) => void;
  onPhotoRemove: (field: CardProfileField) => void;
  disabled: boolean;
  changedKeys: Set<string>;
};

/**
 * One switch and the field(s) it governs.
 *
 * A lone single-line field renders as a flat row — label, value, switch — so the
 * common case reads like a list rather than a stack of cards. Anything wider
 * (an address, a photo, or several fields on one switch) gets a header row with
 * the body beneath it.
 */
function DetailGroup({
  group,
  isShared,
  isFilled,
  lockedOn,
  onToggle,
  valueOf,
  addressOf,
  onValueChange,
  onAddressChange,
  photoPreviews,
  photoBusy,
  photoErrors,
  onPhotoSelect,
  onPhotoRemove,
  disabled,
  changedKeys,
}: DetailGroupProps) {
  const single = group.fields.length === 1 ? group.fields[0] : null;
  const isFlat =
    single !== null && single.inputKind !== "address" && single.inputKind !== "photo";

  const toggle = (
    <Switch
      checked={isShared && isFilled}
      disabled={disabled || !isFilled || lockedOn}
      onChange={onToggle}
      label={`Share ${group.title}`}
      title={
        !isFilled
          ? "Add a value to share this."
          : lockedOn
            ? "At least one detail has to be shared."
            : undefined
      }
    />
  );

  if (isFlat && single) {
    return (
      <div className="flex items-center gap-3 py-1.5">
        <span
          className={cn(
            "w-28 shrink-0 text-sm",
            changedKeys.has(single.key)
              ? "font-semibold text-foreground"
              : "text-muted-foreground",
          )}
        >
          {group.title}
        </span>
        <QuietInput
          field={single}
          value={valueOf(single)}
          disabled={disabled}
          onChange={(value) => onValueChange(single.key, value)}
        />
        {toggle}
      </div>
    );
  }

  return (
    <div className="space-y-2 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{group.title}</span>
        {toggle}
      </div>
      <div className="space-y-3">
        {group.fields.map((field) =>
          field.inputKind === "photo" ? (
            <PhotoField
              key={field.key}
              value={valueOf(field)}
              preview={photoPreviews[field.key]}
              busy={Boolean(photoBusy[field.key])}
              error={photoErrors[field.key]}
              disabled={disabled}
              onSelect={(file) => onPhotoSelect(field, file)}
              onRemove={() => onPhotoRemove(field)}
            />
          ) : field.inputKind === "address" ? (
            <AddressFields
              key={field.key}
              address={addressOf(field)}
              disabled={disabled}
              onChange={(address) => onAddressChange(field.key, address)}
            />
          ) : (
            <div key={field.key} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm text-muted-foreground">
                {field.label}
              </span>
              <QuietInput
                field={field}
                value={valueOf(field)}
                disabled={disabled}
                onChange={(value) => onValueChange(field.key, value)}
              />
            </div>
          ),
        )}
      </div>
      {group.fields.map((field) =>
        field.hint ? (
          <p key={`${field.key}-hint`} className="text-xs text-muted-foreground">
            {field.hint}
          </p>
        ) : null,
      )}
    </div>
  );
}

type QuietInputProps = {
  field: CardProfileField;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
};

/**
 * Reads as text until hovered or focused.
 *
 * Twelve boxed inputs made a settings list look like a form to be filled in
 * top-to-bottom; the values are the content here, so they are what should be
 * visible, not the chrome around them.
 */
function QuietInput({ field, value, disabled, onChange }: QuietInputProps) {
  return (
    <label className="min-w-0 flex-1">
      <span className="sr-only">{field.label}</span>
      <input
        type={
          field.inputKind === "date"
            ? "date"
            : field.inputKind === "email"
              ? "email"
              : "text"
        }
        inputMode={
          field.inputKind === "tel" ? "tel" : field.inputKind === "url" ? "url" : undefined
        }
        value={value}
        placeholder="Add a value"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-transparent bg-transparent px-2 text-sm text-foreground transition-colors duration-150 placeholder:text-muted-foreground hover:border-border focus:border-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

type AddressFieldsProps = {
  address: CardProfileAddress;
  disabled: boolean;
  onChange: (address: CardProfileAddress) => void;
};

const ADDRESS_PARTS: Array<{ key: keyof CardProfileAddress; label: string; wide?: boolean }> = [
  { key: "street", label: "Street" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "pincode", label: "Pincode" },
  { key: "country", label: "Country", wide: true },
];

function AddressFields({ address, disabled, onChange }: AddressFieldsProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ADDRESS_PARTS.map((part) => (
        <label
          key={part.key}
          className={cn("flex flex-col gap-1 text-sm", part.wide && "sm:col-span-2")}
        >
          <span className="text-xs text-muted-foreground">{part.label}</span>
          <Input
            value={address[part.key]}
            placeholder="Add a value"
            disabled={disabled}
            onChange={(event) => onChange({ ...address, [part.key]: event.target.value })}
          />
        </label>
      ))}
    </div>
  );
}

type PhotoFieldProps = {
  value: string;
  preview: string | undefined;
  busy: boolean;
  error: string | undefined;
  disabled: boolean;
  onSelect: (file: File | undefined) => void;
  onRemove: () => void;
};

function PhotoField({ value, preview, busy, error, disabled, onSelect, onRemove }: PhotoFieldProps) {
  const displaySrc = preview ?? value;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <label
          className={cn(
            "flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md border border-dashed border-border p-2 transition-colors duration-150 hover:bg-bg-hover",
            (disabled || busy) && "cursor-not-allowed opacity-60 hover:bg-transparent",
          )}
        >
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
            {displaySrc ? (
              <img src={displaySrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0 text-sm text-muted-foreground">
            {displaySrc ? "Replace image" : "Upload an image"}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={disabled || busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              onSelect(file);
            }}
          />
        </label>
        {displaySrc ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={disabled || busy}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Remove
          </Button>
        ) : null}
      </div>
      {busy ? <p className="text-xs font-medium text-muted-foreground">Uploading…</p> : null}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
