import {
  AtSign,
  BriefcaseBusiness,
  Building2,
  Cake,
  Image,
  Info,
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
  type ShareableFieldType,
} from "@/lib/card-share-types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CardFieldTypesPickerProps = {
  value: ShareableFieldType[];
  onChange: (next: ShareableFieldType[]) => void;
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

/** Keeps a selection in the canonical `SHAREABLE_FIELD_TYPES` order regardless of click order. */
function toCanonicalOrder(types: Iterable<ShareableFieldType>): ShareableFieldType[] {
  const selected = new Set(types);
  return SHAREABLE_FIELD_TYPES.filter((type) => selected.has(type));
}

/** Lets the user choose which profile field types are baked into a shared vCard. */
export function CardFieldTypesPicker({
  value,
  onChange,
  disabled = false,
  hideBulkActions = false,
  className,
}: CardFieldTypesPickerProps) {
  const selected = new Set(value);

  const toggle = (type: ShareableFieldType) => {
    const next = new Set(selected);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    onChange(toCanonicalOrder(next));
  };

  return (
    <div className={cn("space-y-3", className)}>
      {!hideBulkActions ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => onChange([...SHAREABLE_FIELD_TYPES])}
            >
              Select all
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => onChange([])}
            >
              Clear
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {value.length} of {SHAREABLE_FIELD_TYPES.length} selected
          </p>
        </div>
      ) : null}

      {value.length === 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-border bg-secondary p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">
            Nothing selected — every mapped field will be shared.
          </p>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {SHAREABLE_FIELD_TYPES.map((type) => {
          const meta = SHAREABLE_FIELD_META[type];
          const Icon = FIELD_ICONS[type];
          const isSelected = selected.has(type);
          return (
            <label
              key={type}
              className={cn(
                "flex items-start gap-2 rounded-md border p-3 transition-colors duration-150",
                isSelected
                  ? "border-foreground bg-bg-hover"
                  : "border-border hover:bg-bg-hover",
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
              )}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0"
                checked={isSelected}
                disabled={disabled}
                onChange={() => toggle(type)}
              />
              <Icon
                className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{meta.label}</span>
                <span className="block text-xs text-muted-foreground">{meta.hint}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
