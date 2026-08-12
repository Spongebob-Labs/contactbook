import {
  AtSign,
  BriefcaseBusiness,
  Building2,
  Cake,
  Image,
  Link as LinkIcon,
  Mail,
  MapPin,
  Phone,
  PhoneCall,
  Printer,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  SHAREABLE_FIELD_META,
  SHAREABLE_FIELD_TYPES,
  canonicaliseFieldTypes,
  type ShareableFieldType,
} from "@/lib/card-share-types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CardFieldTypesPickerProps = {
  value: ShareableFieldType[];
  onChange: (next: ShareableFieldType[]) => void;
  /**
   * Types this card can actually put in the file. A share filter only narrows
   * what the card already holds, so anything outside this list is shown but not
   * pickable — ticking it would promise a detail the recipient never gets.
   * `undefined` means "unknown", and leaves every type pickable.
   */
  availableTypes?: ShareableFieldType[];
  disabled?: boolean;
  /** Hides the "select all / clear" row. */
  hideBulkActions?: boolean;
  className?: string;
};

const FIELD_ICONS: Record<ShareableFieldType, LucideIcon> = {
  PHONE: Phone,
  LANDLINE: PhoneCall,
  FAX: Printer,
  EMAIL: Mail,
  ADDRESS: MapPin,
  URL: LinkIcon,
  SOCIAL_LINK: AtSign,
  PHOTO: Image,
  JOB_TITLE: BriefcaseBusiness,
  COMPANY: Building2,
  DEPARTMENT: Users,
  DATE: Cake,
};

const UNAVAILABLE_HINT = "This card doesn't carry this yet — add a value to it first.";
const LAST_ONE_HINT = "At least one detail has to be shared.";

/** Lets the user choose which profile field types are baked into a shared vCard. */
export function CardFieldTypesPicker({
  value,
  onChange,
  availableTypes,
  disabled = false,
  hideBulkActions = false,
  className,
}: CardFieldTypesPickerProps) {
  /**
   * What ticking a box can actually deliver. Everything stays pickable while the
   * card's contents are unknown — a picker that greys out a real detail is worse
   * than one that offers an empty one.
   */
  const available = new Set(availableTypes ?? SHAREABLE_FIELD_TYPES);

  /**
   * An empty selection means "everything mapped to the card", so it is drawn as
   * every available box ticked. Drawing the literal empty array meant showing
   * twelve unticked boxes above a caption saying they were all on.
   */
  const sharesEverything = value.length === 0;
  const selected = sharesEverything
    ? new Set(available)
    : new Set(value.filter((type) => available.has(type)));

  /**
   * The API reads an empty `fieldTypes` as "send everything", so unticking the
   * last box would quietly share the whole card — the opposite of what the click
   * asks for. The last one therefore stays ticked.
   */
  const isLastOne = (type: ShareableFieldType) =>
    selected.has(type) && selected.size <= 1;

  const toggle = (type: ShareableFieldType) => {
    const next = new Set(selected);
    if (next.has(type)) {
      if (next.size <= 1) {
        return;
      }
      next.delete(type);
    } else {
      next.add(type);
    }
    // Materialised from what this picker can offer, so narrowing away from
    // "everything" never leaves a type on screen that is silently still sent.
    onChange(canonicaliseFieldTypes([...next]));
  };

  return (
    <div className={cn("space-y-3", className)}>
      {!hideBulkActions ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {sharesEverything ? (
            <span />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => onChange([])}
            >
              Share everything
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            {selected.size} of {available.size} selected
          </p>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {SHAREABLE_FIELD_TYPES.map((type) => {
          const meta = SHAREABLE_FIELD_META[type];
          const Icon = FIELD_ICONS[type];
          const isAvailable = available.has(type);
          const isSelected = selected.has(type);
          const lockedOn = isLastOne(type);
          const isLocked = disabled || !isAvailable || lockedOn;
          const title = !isAvailable
            ? UNAVAILABLE_HINT
            : lockedOn
              ? LAST_ONE_HINT
              : undefined;
          return (
            <label
              key={type}
              title={title}
              className={cn(
                "flex items-start gap-2 rounded-md border p-3 transition-colors duration-150",
                isSelected
                  ? "border-foreground bg-bg-hover"
                  : "border-border hover:bg-bg-hover",
                isLocked ? "cursor-not-allowed" : "cursor-pointer",
                disabled || !isAvailable ? "opacity-60" : null,
              )}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0"
                checked={isSelected}
                disabled={isLocked}
                onChange={() => toggle(type)}
              />
              <Icon
                className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{meta.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {isAvailable ? meta.hint : UNAVAILABLE_HINT}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
