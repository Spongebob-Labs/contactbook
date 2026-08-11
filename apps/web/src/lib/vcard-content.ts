/**
 * Reads a generated `.vcf` back.
 *
 * A card's vCard is built server-side from its `CardFieldMapping` rows, and no
 * endpoint lists those rows — `VcardAssetResponseDto.fieldTypes` only echoes the
 * filter that was sent in. So the file itself is the only answer to "what does
 * this card actually hold", which is what `vcardFieldTypes` recovers.
 *
 * Fetch the text through `GET /v1/vcards/download/:objectKey`, never the asset's
 * bucket `url` — that host sends no CORS headers. See `vcard-preview.tsx`.
 */
import { API_BASE } from "@/lib/api";
import {
  canonicaliseFieldTypes,
  type ShareableFieldType,
} from "@/lib/card-share-types";

/**
 * Where to read a generated VCF's text from.
 *
 * Not the asset's `url`: that points straight at the GCS bucket, which serves no
 * `Access-Control-Allow-Origin`, so the browser blocks every read and the caller
 * silently falls back. `GET /v1/vcards/download/:objectKey` proxies the same
 * bytes from our own API, which does send CORS headers, and needs no auth — the
 * WhatsApp "Save to Contacts" page uses it too.
 */
export function vcardTextUrl(objectKey: string): string {
  const path = objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${API_BASE}/v1/vcards/download/${path}`;
}

/** Reads a generated VCF's text through the proxy. Throws on a non-2xx. */
export async function fetchVcardText(objectKey: string): Promise<string> {
  const response = await fetch(vcardTextUrl(objectKey));
  if (!response.ok) {
    throw new Error(`Unexpected status ${response.status}`);
  }
  return response.text();
}

/** One displayable line parsed out of a generated `.vcf`. */
export type VcardRow = {
  label: string;
  value: string;
  isImage?: boolean;
};

const SKIP_PROPERTIES = new Set(["BEGIN", "END", "VERSION", "PRODID", "REV", "UID"]);

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

type VcardProperty = {
  /** Upper-cased property name, e.g. `TEL`. */
  property: string;
  /** Everything between the name and the colon, e.g. `TYPE=CELL`. */
  params: string;
  value: string;
};

/** Non-empty properties worth reading, in file order. */
function readProperties(text: string): VcardProperty[] {
  const properties: VcardProperty[] = [];
  for (const line of unfoldVcardLines(text)) {
    const colonIndex = line.indexOf(":");
    if (colonIndex < 0) {
      continue;
    }
    const head = line.slice(0, colonIndex);
    const [propertyName = "", ...paramParts] = head.split(";");
    const property = propertyName.toUpperCase();
    if (SKIP_PROPERTIES.has(property)) {
      continue;
    }
    const value = unescapeVcardValue(line.slice(colonIndex + 1)).trim();
    if (!value) {
      continue;
    }
    properties.push({ property, params: paramParts.join(";"), value });
  }
  return properties;
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
export function parseVcardRows(text: string): VcardRow[] {
  const rows: VcardRow[] = [];
  let hasName = false;

  for (const { property, params, value } of readProperties(text)) {
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

/**
 * Which `FieldType`s a generated vCard proves the card holds, in canonical order.
 *
 * The inverse of `serializeCard` in the API, which writes one distinct property
 * (or `TYPE=` param) per type, so this is an exact reading rather than a guess:
 * `TEL;TYPE=CELL` is PHONE, `TYPE=HOME` LANDLINE, `TYPE=FAX` FAX, a bare `URL`
 * is URL and `TYPE=social` SOCIAL_LINK.
 *
 * Call it on an **unfiltered** vCard — one generated with no `fieldTypes` — or it
 * reports the filter back rather than the card.
 *
 * `FN`/`N` are deliberately ignored: they come from the user row, not a mapping,
 * so a name-only file correctly reads as holding nothing.
 */
export function vcardFieldTypes(text: string): ShareableFieldType[] {
  const found: ShareableFieldType[] = [];

  for (const { property, params, value } of readProperties(text)) {
    const upperParams = params.toUpperCase();
    switch (property) {
      case "TEL":
        found.push(
          upperParams.includes("FAX")
            ? "FAX"
            : upperParams.includes("HOME")
              ? "LANDLINE"
              : "PHONE",
        );
        break;
      case "EMAIL":
        found.push("EMAIL");
        break;
      case "ADR":
        found.push("ADDRESS");
        break;
      case "URL":
        found.push(upperParams.includes("TYPE=SOCIAL") ? "SOCIAL_LINK" : "URL");
        break;
      case "PHOTO":
        found.push("PHOTO");
        break;
      case "TITLE":
        found.push("JOB_TITLE");
        break;
      case "ORG":
        // The serializer collapses a group's company and department into one
        // ORG with the department as its second part.
        found.push("COMPANY");
        if (value.split(";").filter((part) => part.trim().length > 0).length > 1) {
          found.push("DEPARTMENT");
        }
        break;
      case "BDAY":
        found.push("DATE");
        break;
      default:
        break;
    }
  }

  return canonicaliseFieldTypes(found);
}
