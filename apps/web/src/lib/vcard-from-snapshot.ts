import type { CardSnapshot } from "@/lib/card-schema";
import { visibleContactMethods, visibleSocials } from "@/lib/card-schema";

/**
 * Build a vCard from a published snapshot, in the browser.
 *
 * The server has a vCard generator, but the public card page has no session to
 * call it with — a stranger who scanned a QR is not logged in. This is also why
 * the card keeps a structured contact core instead of a bag of links: `TEL` and
 * `EMAIL` only exist because those fields are typed.
 */

/** Photos beyond this produce a .vcf some address books refuse to import. */
const PHOTO_MAX_BASE64_CHARS = 250_000;

/** RFC 6350 §3.4: backslash, comma, semicolon and newline are special. */
function escapeValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Fold to 75 octets with a leading space on continuations (RFC 6350 §3.2).
 * Without this an inlined photo is one enormous line that several importers
 * silently truncate.
 */
function foldLine(line: string): string {
  if (line.length <= 75) {
    return line;
  }
  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest.length > 0) {
    parts.push(` ${rest}`);
  }
  return parts.join("\r\n");
}

function splitName(displayName: string): { last: string; first: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { last: "", first: "" };
  }
  if (parts.length === 1) {
    return { last: "", first: parts[0] };
  }
  return { last: parts[parts.length - 1], first: parts.slice(0, -1).join(" ") };
}

function photoLine(photo: string): string | null {
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i.exec(
    photo.trim(),
  );
  if (!match) {
    return null;
  }
  const [, rawType, base64] = match;
  if (base64.length > PHOTO_MAX_BASE64_CHARS) {
    return null;
  }
  const type = rawType.toLowerCase() === "jpg" ? "JPEG" : rawType.toUpperCase();
  return `PHOTO;ENCODING=b;TYPE=${type}:${base64}`;
}

export function vcardFromSnapshot(
  snapshot: CardSnapshot,
  shareUrl?: string,
): string {
  const { identity } = snapshot;
  const { last, first } = splitName(identity.displayName);
  const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0"];

  lines.push(`N:${escapeValue(last)};${escapeValue(first)};;;`);
  lines.push(`FN:${escapeValue(identity.displayName)}`);

  if (identity.title.trim()) {
    lines.push(`TITLE:${escapeValue(identity.title)}`);
  }
  if (identity.company.trim()) {
    lines.push(`ORG:${escapeValue(identity.company)}`);
  }

  for (const method of visibleContactMethods(snapshot)) {
    const value = method.value.trim();
    if (!value) {
      continue;
    }
    switch (method.type) {
      case "phone":
        lines.push(`TEL;TYPE=CELL:${escapeValue(value)}`);
        break;
      case "email":
        lines.push(`EMAIL;TYPE=INTERNET:${escapeValue(value)}`);
        break;
      case "website":
        lines.push(`URL:${escapeValue(value)}`);
        break;
      case "address":
        // Everything goes in the street component. The snapshot stores one
        // free-text address, and splitting it into city/region/country would
        // guess wrong more often than it helped.
        lines.push(`ADR;TYPE=WORK:;;${escapeValue(value)};;;;`);
        break;
      default:
        break;
    }
  }

  for (const social of visibleSocials(snapshot)) {
    if (social.url.trim()) {
      lines.push(
        `X-SOCIALPROFILE;TYPE=${social.platform}:${escapeValue(social.url.trim())}`,
      );
    }
  }

  if (shareUrl) {
    lines.push(`URL;TYPE=card:${escapeValue(shareUrl)}`);
  }
  if (identity.bio.trim()) {
    lines.push(`NOTE:${escapeValue(identity.bio)}`);
  }

  const photo = photoLine(identity.photo);
  if (photo) {
    lines.push(photo);
  }

  lines.push("END:VCARD");

  // CRLF throughout — RFC 6350 requires it, and Outlook is strict about it.
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

export function vcardFilename(snapshot: CardSnapshot): string {
  const base =
    snapshot.identity.displayName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "contact";
  return `${base}.vcf`;
}

/** Trigger a browser download of the card as a .vcf. */
export function downloadVcard(snapshot: CardSnapshot, shareUrl?: string): void {
  const blob = new Blob([vcardFromSnapshot(snapshot, shareUrl)], {
    type: "text/vcard;charset=utf-8",
  });
  triggerDownload(URL.createObjectURL(blob), vcardFilename(snapshot), true);
}

export function triggerDownload(
  href: string,
  filename: string,
  revoke = false,
): void {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  if (revoke) {
    URL.revokeObjectURL(href);
  }
}
