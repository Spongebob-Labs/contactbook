import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EditableSectionProps = {
  title: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  saving?: boolean;
  children: ReactNode;
  className?: string;
  description?: string;
};

export function EditableSection({
  title,
  editing,
  onEdit,
  onCancel,
  onSave,
  saving = false,
  children,
  className,
  description,
}: EditableSectionProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-surface p-5 md:p-6",
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {editing ? (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            Edit
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

type ViewFieldProps = {
  label: string;
  value?: string | null;
};

export function ViewField({ label, value }: ViewFieldProps) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-foreground">
        {value?.trim() || "—"}
      </p>
    </div>
  );
}

type EditFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
};

export function EditField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: EditFieldProps) {
  return (
    <label className="block min-w-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 flex h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground transition-colors duration-150 placeholder:text-[#9CA3AF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      />
    </label>
  );
}
