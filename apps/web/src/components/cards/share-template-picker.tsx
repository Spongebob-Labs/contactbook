import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import type { ShareTemplate } from "@/lib/card-share-types";
import {
  classifyShareTemplate,
  templateCapabilitySummary,
} from "@/lib/share-template-capabilities";
import { cn } from "@/lib/utils";

export type ShareTemplatePickerProps = {
  templates: ShareTemplate[];
  value: string | null;
  onChange: (templateKey: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  /** Shown as a "Create your own" affordance when provided. */
  onCreateTemplate?: () => void;
  className?: string;
};

/** Friendly source label — the raw key is never a fitting user-facing name. */
function templateSourceLabel(key: string): string {
  return key.startsWith("user_") ? "Your template" : "ContactBook default";
}

function firstBodyLine(body: string): string {
  const [firstLine] = body.split("\n");
  return (firstLine ?? body).trim();
}

type TemplateOptionProps = {
  template: ShareTemplate;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
};

function TemplateOption({ template, selected, disabled, onSelect }: TemplateOptionProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showThumbnail = Boolean(template.headerImageUrl) && !imageFailed;
  // The delivery behaviour is the only difference a recipient actually feels,
  // so it leads the option rather than sitting beside the button title.
  const capabilities = classifyShareTemplate(template);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors duration-150",
        selected ? "border-foreground bg-bg-hover" : "border-border hover:bg-bg-hover",
      )}
    >
      {showThumbnail ? (
        <img
          src={template.headerImageUrl ?? undefined}
          alt=""
          className="h-12 w-12 shrink-0 rounded-md object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : null}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="line-clamp-2 text-sm text-foreground">{firstBodyLine(template.body)}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={capabilities.deliversVcfInButton ? "success" : "secondary"}>
            {templateCapabilitySummary(capabilities)}
          </Badge>
          <Badge variant="outline">{template.buttonTitle}</Badge>
          <span className="text-xs text-muted-foreground">{template.locale}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {templateSourceLabel(template.key)}
        </p>
      </div>
    </button>
  );
}

/** Accessible radiogroup of approved WhatsApp templates the user can send. */
export function ShareTemplatePicker({
  templates,
  value,
  onChange,
  isLoading = false,
  disabled = false,
  onCreateTemplate,
  className,
}: ShareTemplatePickerProps) {
  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <Panel className={cn("border-dashed", className)}>
        <div className="flex min-h-56 flex-col items-center justify-center px-2 py-6 text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-foreground">
            <MessageSquare className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-foreground">No approved templates yet</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            New templates take a few minutes to be approved by WhatsApp before they can be used
            to share a card.
          </p>
          {onCreateTemplate ? (
            <Button type="button" className="mt-4" onClick={onCreateTemplate} disabled={disabled}>
              Create a template
            </Button>
          ) : null}
        </div>
      </Panel>
    );
  }

  return (
    <div className={cn("space-y-2", className)} role="radiogroup" aria-label="Message template">
      {templates.map((template) => (
        <TemplateOption
          key={template.key}
          template={template}
          selected={template.key === value}
          disabled={disabled}
          onSelect={() => onChange(template.key)}
        />
      ))}

      {onCreateTemplate ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onCreateTemplate}
          disabled={disabled}
        >
          Create your own template
        </Button>
      ) : null}
    </div>
  );
}
