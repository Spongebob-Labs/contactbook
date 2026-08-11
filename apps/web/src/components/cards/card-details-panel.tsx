import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Image as ImageIcon, Info, X } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import {
  EMPTY_ADDRESS,
  buildCardProfilePatch,
  isAddressEmpty,
  listCardProfileFields,
  usesWorkGroup,
  type CardProfileAddress,
  type CardProfileEdits,
  type CardProfileField,
} from "@/lib/card-profile-fields";
import { SHAREABLE_FIELD_TYPES, type ShareableFieldType } from "@/lib/card-share-types";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { fetchProfileMe, patchProfileMe, uploadProfilePhoto } from "@/lib/profile-api";
import type { ContactCardType, ProfileMeResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

export type CardDetailsPanelProps = {
  /** Null while a card is still being created — just hides card-specific copy. */
  cardId: string | null;
  cardType: ContactCardType;
  /** Types ticked for sharing. Empty array = share everything mapped to the card. */
  selectedTypes: ShareableFieldType[];
  onSelectedTypesChange: (next: ShareableFieldType[]) => void;
  /** Fired after a successful profile save, so the parent can refresh its vCard preview. */
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
};
const PERSONAL_GROUP_ORDER = ["You", "Contact", "Address", "Links"];

type FieldGroup = { heading: string; fields: CardProfileField[] };

function groupFields(fields: CardProfileField[], cardType: ContactCardType): FieldGroup[] {
  const map = usesWorkGroup(cardType) ? WORK_GROUPS : PERSONAL_GROUPS;
  const order = usesWorkGroup(cardType) ? WORK_GROUP_ORDER : PERSONAL_GROUP_ORDER;
  const buckets = new Map<string, CardProfileField[]>();
  for (const field of fields) {
    const heading = map[field.key] ?? "Other";
    const bucket = buckets.get(heading) ?? [];
    bucket.push(field);
    buckets.set(heading, bucket);
  }
  return order
    .filter((heading) => buckets.has(heading))
    .map((heading) => ({ heading, fields: buckets.get(heading) ?? [] }));
}

/** Lets the user fill in the profile values a card draws from, and pick which get shared. */
export function CardDetailsPanel({
  cardId,
  cardType,
  selectedTypes,
  onSelectedTypesChange,
  onSaved,
  className,
}: CardDetailsPanelProps) {
  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [edits, setEdits] = useState<CardProfileEdits>(EMPTY_EDITS);
  const [isSaving, setIsSaving] = useState(false);
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

  const fields = useMemo(() => listCardProfileFields(profile, cardType), [profile, cardType]);
  const groups = useMemo(() => groupFields(fields, cardType), [fields, cardType]);
  const selectedSet = useMemo(() => new Set(selectedTypes), [selectedTypes]);
  const isDirty =
    Object.keys(edits.values).length > 0 || Object.keys(edits.addresses).length > 0;

  const effectiveValue = (field: CardProfileField): string =>
    edits.values[field.key] ?? field.value;
  const effectiveAddress = (field: CardProfileField): CardProfileAddress =>
    edits.addresses[field.key] ?? field.address ?? EMPTY_ADDRESS;

  const setFieldValue = (key: string, value: string) => {
    setEdits((prev) => ({ ...prev, values: { ...prev.values, [key]: value } }));
  };
  const setFieldAddress = (key: string, address: CardProfileAddress) => {
    setEdits((prev) => ({ ...prev, addresses: { ...prev.addresses, [key]: address } }));
  };

  const toggleType = (type: ShareableFieldType) => {
    const next = new Set(selectedSet);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
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

  const handleSave = async () => {
    if (!isDirty || isSaving) {
      return;
    }
    setIsSaving(true);
    try {
      const patch = buildCardProfilePatch(profile, cardType, edits);
      await patchProfileMe(patch);
      const refreshed = await fetchProfileMe();
      setProfile(refreshed);
      setEdits(EMPTY_EDITS);
      toast.success("Details saved.");
      onSaved?.();
    } catch (error) {
      logUiError("Could not save card details", error);
      toast.error(
        error instanceof ApiError && error.message ? error.message : friendlyErrorMessages.save,
      );
    } finally {
      setIsSaving(false);
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
      <PanelHeader title="Card details" />
      <p className="text-sm text-muted-foreground">
        {cardId
          ? "These live on your profile, not just this card — editing them updates every card built from the same fields."
          : "These live on your profile — editing them updates every card built from the same fields."}
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-md" />
          ))}
        </div>
      ) : null}

      {!isLoading && loadError ? (
        <Alert className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-medium">Could not load your details</p>
            <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void loadProfile()}
            >
              Retry
            </Button>
          </div>
        </Alert>
      ) : null}

      {!isLoading && !loadError ? (
        <div className="space-y-6">
          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectedTypesChange([...SHAREABLE_FIELD_TYPES])}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectedTypesChange([])}
                >
                  Clear
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedTypes.length} of {SHAREABLE_FIELD_TYPES.length} selected
              </p>
            </div>
            {selectedTypes.length === 0 ? (
              <div className="flex items-start gap-2 rounded-md border border-border bg-secondary p-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground">
                  Nothing selected — every mapped field will be shared.
                </p>
              </div>
            ) : null}
          </div>

          {groups.map((group) => (
            <div key={group.heading} className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {group.heading}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.fields.map((field) => (
                  <FieldRow
                    key={field.key}
                    field={field}
                    isSelected={selectedSet.has(field.type)}
                    onToggleType={toggleType}
                    value={effectiveValue(field)}
                    onValueChange={(value) => setFieldValue(field.key, value)}
                    address={effectiveAddress(field)}
                    onAddressChange={(address) => setFieldAddress(field.key, address)}
                    photoPreview={photoPreviews[field.key]}
                    photoBusy={Boolean(photoBusy[field.key])}
                    photoError={photoErrors[field.key]}
                    onPhotoSelect={(file) => void handlePhotoSelect(field, file)}
                    onPhotoRemove={() => handlePhotoRemove(field)}
                    disabled={isSaving || !field.editable}
                  />
                ))}
              </div>
            </div>
          ))}

          {/*
            Typed values live in local state until "Save details" PATCHes the
            profile, but ticking "Include" regenerates the vCard immediately from
            what the server already has. Without this line the two look like one
            action, and a value typed-but-unsaved appears to have been ignored.
          */}
          {isDirty ? (
            <Alert className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
              <div>
                <p className="font-medium">Not saved yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The contact file still shows your saved details. Save to put these
                  edits in what recipients receive.
                </p>
              </div>
            </Alert>
          ) : null}

          <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={handleDiscard}
              disabled={!isDirty || isSaving}
            >
              Discard changes
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={!isDirty || isSaving}
            >
              {isSaving ? "Saving…" : "Save details"}
            </Button>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

type FieldRowProps = {
  field: CardProfileField;
  isSelected: boolean;
  onToggleType: (type: ShareableFieldType) => void;
  value: string;
  onValueChange: (value: string) => void;
  address: CardProfileAddress;
  onAddressChange: (address: CardProfileAddress) => void;
  photoPreview: string | undefined;
  photoBusy: boolean;
  photoError: string | undefined;
  onPhotoSelect: (file: File | undefined) => void;
  onPhotoRemove: () => void;
  /** True while saving is in flight, or when the field can't be edited at all. */
  disabled: boolean;
};

function FieldRow({
  field,
  isSelected,
  onToggleType,
  value,
  onValueChange,
  address,
  onAddressChange,
  photoPreview,
  photoBusy,
  photoError,
  onPhotoSelect,
  onPhotoRemove,
  disabled,
}: FieldRowProps) {
  const isWide = field.inputKind === "address" || field.inputKind === "photo";

  return (
    <div
      className={cn(
        "space-y-2 rounded-md border border-border bg-surface p-3",
        !field.editable && "bg-muted opacity-70",
        isWide && "sm:col-span-2",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{field.label}</span>
        <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={isSelected}
            disabled={!field.editable}
            onChange={() => onToggleType(field.type)}
            aria-label={`Include ${field.label} when sharing`}
          />
          Include
        </label>
      </div>

      {field.inputKind === "photo" ? (
        <PhotoField
          value={value}
          preview={photoPreview}
          busy={photoBusy}
          error={photoError}
          disabled={disabled}
          onSelect={onPhotoSelect}
          onRemove={onPhotoRemove}
        />
      ) : field.inputKind === "address" ? (
        <AddressFields address={address} disabled={disabled} onChange={onAddressChange} />
      ) : (
        <label className="flex flex-col gap-2 text-sm font-medium">
          <span className="sr-only">{field.label}</span>
          <Input
            type={field.inputKind === "date" ? "date" : field.inputKind === "email" ? "email" : "text"}
            inputMode={
              field.inputKind === "tel" ? "tel" : field.inputKind === "url" ? "url" : undefined
            }
            value={value}
            placeholder="Not added yet"
            disabled={disabled}
            onChange={(event) => onValueChange(event.target.value)}
          />
        </label>
      )}

      {field.hint ? <p className="text-xs text-muted-foreground">{field.hint}</p> : null}
      {!field.editable && field.unavailableReason ? (
        <p className="text-xs text-muted-foreground">{field.unavailableReason}</p>
      ) : null}
    </div>
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
    <div className="space-y-2">
      {isAddressEmpty(address) ? (
        <p className="text-xs text-muted-foreground">Not added yet</p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {ADDRESS_PARTS.map((part) => (
          <label
            key={part.key}
            className={cn("flex flex-col gap-2 text-sm font-medium", part.wide && "sm:col-span-2")}
          >
            <span>{part.label}</span>
            <Input
              value={address[part.key]}
              disabled={disabled}
              onChange={(event) => onChange({ ...address, [part.key]: event.target.value })}
            />
          </label>
        ))}
      </div>
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label
          className={cn(
            "group flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md border border-dashed border-border bg-muted p-3 transition-colors duration-150 hover:bg-bg-hover",
            (disabled || busy) && "cursor-not-allowed opacity-60 hover:bg-muted",
          )}
        >
          <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
            {displaySrc ? (
              <img src={displaySrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0 text-sm text-muted-foreground">
            {displaySrc ? "Replace image" : "Not added yet — click to upload"}
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
