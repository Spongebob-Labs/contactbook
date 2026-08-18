import { createHash } from "node:crypto";
import { hexToRgb, solidPng, type Rgb } from "./solid-png";

/**
 * Builds the *contents* of a `.pkpass` — everything except the signature.
 *
 * Kept separate from signing so the two can vary independently: the same
 * content goes to a local `.p12` signer or a hosted signing service without
 * change. Everything here is pure and testable, which matters because the
 * signature is the one part that cannot be exercised without an Apple cert.
 */

export type PassConfig = {
  passTypeIdentifier: string;
  teamIdentifier: string;
  organizationName: string;
};

export type PassInput = {
  slug: string;
  shareUrl: string;
  displayName: string;
  title: string;
  company: string;
  /** Hex; drives the pass background and the generated icon. */
  backgroundHex: string;
  /** Hex; drives the pass label/foreground text. */
  foregroundHex: string;
};

function rgbCss({ r, g, b }: Rgb): string {
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * The snapshot is an opaque, frontend-owned blob everywhere else in the API.
 * The pass face is the one place the server has to look inside it, so it reads
 * exactly four fields, defensively: an unexpected shape degrades to a
 * name-only pass rather than failing the request.
 */
export function passInputFromSnapshot(
  snapshot: unknown,
  slug: string,
  shareUrl: string,
): PassInput {
  const root = (snapshot ?? {}) as Record<string, unknown>;
  const identity = (root.identity ?? {}) as Record<string, unknown>;
  const theme = (root.theme ?? {}) as Record<string, unknown>;
  const background = (theme.background ?? {}) as Record<string, unknown>;

  const text = (value: unknown): string =>
    typeof value === "string" ? value.trim() : "";

  const backgroundHex =
    background.kind === "solid" && typeof background.color === "string"
      ? background.color
      : background.kind === "gradient" && typeof background.from === "string"
        ? background.from
        : "#1B2430";

  return {
    slug,
    shareUrl,
    displayName: text(identity.displayName) || "Contact card",
    title: text(identity.title),
    company: text(identity.company),
    backgroundHex,
    foregroundHex: text(theme.textColor) || "#FFFFFF",
  };
}

export function buildPassJson(input: PassInput, config: PassConfig): string {
  const background = hexToRgb(input.backgroundHex);
  const foreground = hexToRgb(input.foregroundHex);

  const secondaryFields = [
    input.title ? { key: "role", label: "ROLE", value: input.title } : null,
    input.company
      ? { key: "company", label: "COMPANY", value: input.company }
      : null,
  ].filter(Boolean);

  const pass = {
    formatVersion: 1,
    passTypeIdentifier: config.passTypeIdentifier,
    teamIdentifier: config.teamIdentifier,
    organizationName: config.organizationName,
    // Stable per card, so re-issuing replaces the pass in Wallet instead of
    // stacking duplicates.
    serialNumber: input.slug,
    description: `Contact card for ${input.displayName}`,
    backgroundColor: rgbCss(background),
    foregroundColor: rgbCss(foreground),
    labelColor: rgbCss(foreground),
    logoText: input.company || input.displayName,
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: input.shareUrl,
        // ISO-8859-1 is what Wallet documents for QR payloads, and a share URL
        // is ASCII, so nothing is lost.
        messageEncoding: "iso-8859-1",
      },
    ],
    generic: {
      primaryFields: [
        { key: "name", label: "", value: input.displayName },
      ],
      secondaryFields,
      // Deliberately no phone or email on the pass. Text printed into a pass
      // is frozen at issue time and cannot be corrected in someone's Wallet
      // without the pass update web service. The QR resolves to the live card,
      // so the details stay current by never being duplicated here.
      backFields: [
        {
          key: "link",
          label: "CARD",
          value: input.shareUrl,
          attributedValue: `<a href="${input.shareUrl}">View this card</a>`,
        },
        {
          key: "about",
          label: "ABOUT",
          value:
            "Scan the code on the front to open the latest version of this card. Details stay up to date automatically.",
        },
      ],
    },
  };

  return JSON.stringify(pass, null, 2);
}

export type PassFile = { name: string; data: Buffer };

/**
 * Wallet requires `icon.png`; the rest improve how the pass looks. Sizes follow
 * Apple's expected @1x/@2x pairs.
 */
export function buildPassImages(input: PassInput): PassFile[] {
  const color = hexToRgb(input.backgroundHex);
  return [
    { name: "icon.png", data: solidPng(29, color) },
    { name: "icon@2x.png", data: solidPng(58, color) },
    { name: "logo.png", data: solidPng(50, color) },
    { name: "logo@2x.png", data: solidPng(100, color) },
  ];
}

/**
 * manifest.json maps every file in the bundle to its SHA-1. The signature is
 * computed over this file, which is what binds the payload together — so the
 * manifest must list every entry except itself and the signature.
 */
export function buildManifest(files: PassFile[]): string {
  const manifest: Record<string, string> = {};
  for (const file of files) {
    manifest[file.name] = createHash("sha1").update(file.data).digest("hex");
  }
  return JSON.stringify(manifest, null, 2);
}

/** Everything a signer needs: the payload files plus the manifest over them. */
export function buildPassBundle(
  input: PassInput,
  config: PassConfig,
): { files: PassFile[]; manifest: Buffer } {
  const files: PassFile[] = [
    { name: "pass.json", data: Buffer.from(buildPassJson(input, config), "utf8") },
    ...buildPassImages(input),
  ];
  return { files, manifest: Buffer.from(buildManifest(files), "utf8") };
}
