import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { API_BASE } from "@/lib/api";
import { generateCardVcard } from "@/lib/card-share-api";
import {
  SHAREABLE_FIELD_META,
  type CardVcardAsset,
  type ShareableFieldType,
} from "@/lib/card-share-types";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { cn } from "@/lib/utils";

export type VcardPreviewProps = {
  cardId: string;
  /** Empty array = every mapped field. */
  fieldTypes: ShareableFieldType[];
  cardName: string;
  className?: string;
};

/** One displayable line parsed out of the generated `.vcf`. */
type VcardRow = {
  label: string;
  value: string;
  isImage?: boolean;
};

const DEBOUNCE_MS = 400;
const SKIP_PROPERTIES = new Set(["BEGIN", "END", "VERSION", "PRODID", "REV", "UID"]);

/**
 * Where to read the generated VCF text from.
 *
 * Not `asset.url`: that points straight at the GCS bucket, which serves no
 * `Access-Control-Allow-Origin`, so the browser blocked every read and the
 * preview fell back to bare field-type badges — the file's actual values were
 * never displayable. `GET /v1/vcards/download/:objectKey` proxies the same bytes
 * from our own API, which does send CORS headers. It needs no auth (the
 * WhatsApp "Save to Contacts" page uses it too), so a plain fetch is enough.
 */
function vcfTextUrl(objectKey: string): string {
  const path = objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${API_BASE}/v1/vcards/download/${path}`;
}

/** Renders a byte count the way a person would say it, e.g. "1.4 KB". */
function humanFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function unescapeVcardValue(raw: string): string {
  return raw
    .replaceAll("\\n", "\n")
    .replaceAll("\\N", "\n")
    .replaceAll("\\,", ",")
    .replaceAll("\\;", ";")
    .replaceAll("\\\\", "\\");
}

/** Joins folded continuation lines (leading space/tab) back onto their parent line. */
function unfoldVcardLines(text: string): string[] {
  const rawLines = text.split(/\r\n|\n|\r/);
  const lines: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] = `${lines[lines.length - 1]}${line.slice(1)}`;
    } else if (line.length > 0) {
      lines.push(line);
    }
  }
  return lines;
}

function phoneKind(params: string): string {
  const upper = params.toUpperCase();
  if (upper.includes("FAX")) {
    return "Fax";
  }
  if (upper.includes("HOME")) {
    return "Home";
  }
  if (upper.includes("CELL") || upper.includes("MOBILE")) {
    return "Mobile";
  }
  return "Phone";
}

/** Turns vCard 3.0 text into friendly rows; unsupported/blank properties are skipped. */
function parseVcard(text: string): VcardRow[] {
  const rows: VcardRow[] = [];
  let hasName = false;

  for (const line of unfoldVcardLines(text)) {
    const colonIndex = line.indexOf(":");
    if (colonIndex < 0) {
      continue;
    }
    const head = line.slice(0, colonIndex);
    const rawValue = line.slice(colonIndex + 1);
    const [propertyName = "", ...paramParts] = head.split(";");
    const property = propertyName.toUpperCase();
    if (SKIP_PROPERTIES.has(property)) {
      continue;
    }
    const params = paramParts.join(";");
    const value = unescapeVcardValue(rawValue).trim();
    if (!value) {
      continue;
    }

    switch (property) {
      case "FN":
      case "N":
        if (!hasName) {
          hasName = true;
          rows.push({ label: "Name", value });
        }
        break;
      case "TEL":
        rows.push({ label: phoneKind(params), value });
        break;
      case "EMAIL":
        rows.push({ label: "Email", value });
        break;
      case "ADR": {
        const joined = value
          .split(";")
          .map((part) => part.trim())
          .filter(Boolean)
          .join(", ");
        if (joined) {
          rows.push({ label: "Address", value: joined });
        }
        break;
      }
      case "URL":
        rows.push({
          label: params.toUpperCase().includes("TYPE=SOCIAL") ? "Social" : "Website",
          value,
        });
        break;
      case "ORG":
        rows.push({
          label: "Company",
          value: value
            .split(";")
            .map((part) => part.trim())
            .filter(Boolean)
            .join(" · "),
        });
        break;
      case "TITLE":
        rows.push({ label: "Job title", value });
        break;
      case "BDAY":
        rows.push({ label: "Birthday", value });
        break;
      case "PHOTO":
        if (value.startsWith("https://")) {
          rows.push({ label: "Photo", value, isImage: true });
        }
        break;
      default:
        break;
    }
  }

  return rows;
}

/** Shows exactly what a recipient will save: a parsed vCard, or a safe field-type summary. */
export function VcardPreview({ cardId, fieldTypes, cardName, className }: VcardPreviewProps) {
  const [asset, setAsset] = useState<CardVcardAsset | null>(null);
  const [rows, setRows] = useState<VcardRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(cardId));
  const [error, setError] = useState<string | null>(null);
  const fieldTypesKey = fieldTypes.join(",");

  useEffect(() => {
    if (!cardId) {
      return;
    }
    let isCurrent = true;
    setIsLoading(true);
    setError(null);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await generateCardVcard(cardId, fieldTypes);
          if (!isCurrent) {
            return;
          }
          setAsset(result);
          setRows(null);

          try {
            const response = await fetch(vcfTextUrl(result.objectKey));
            if (!isCurrent) {
              return;
            }
            if (!response.ok) {
              throw new Error(`Unexpected status ${response.status}`);
            }
            const text = await response.text();
            if (!isCurrent) {
              return;
            }
            setRows(parseVcard(text));
          } catch {
            // Proxy unreachable, or the file failed to parse — the field-type
            // summary below still gives an honest preview.
          }
        } catch (loadError) {
          if (!isCurrent) {
            return;
          }
          logUiError("Could not build the contact file", loadError);
          setError(friendlyErrorMessages.load);
          setAsset(null);
          setRows(null);
        } finally {
          if (isCurrent) {
            setIsLoading(false);
          }
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
    // fieldTypesKey stands in for fieldTypes so a new array reference with the
    // same members does not re-trigger the debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, fieldTypesKey]);

  if (!cardId) {
    return <></>;
  }

  return (
    <Panel className={className}>
      <PanelHeader title="What they'll save" />
      <p className="mb-4 truncate text-sm font-medium text-foreground">
        {cardName || "Untitled contact"}
      </p>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      ) : null}

      {!isLoading && error ? (
        <Alert className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium">Could not build the contact file</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
        </Alert>
      ) : null}

      {!isLoading && !error && asset ? (
        <div className="space-y-4">
          {rows && rows.length > 0 ? (
            <dl className="space-y-2">
              {rows.map((row, index) => (
                <div
                  key={`${row.label}-${index}`}
                  className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0"
                >
                  <dt className="shrink-0 text-xs font-medium text-muted-foreground">
                    {row.label}
                  </dt>
                  <dd className="min-w-0 text-right text-sm text-foreground">
                    {row.isImage ? (
                      <img
                        src={row.value}
                        alt="Contact"
                        className="ml-auto h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="break-words">{row.value}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ) : asset.fieldTypes.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {asset.fieldTypes.map((type) => (
                <Badge key={type} variant="outline">
                  {SHAREABLE_FIELD_META[type].label}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Includes every mapped field.</p>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-muted-foreground">{humanFileSize(asset.sizeBytes)}</p>
            <a
              href={asset.url}
              download
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Download .vcf
            </a>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
