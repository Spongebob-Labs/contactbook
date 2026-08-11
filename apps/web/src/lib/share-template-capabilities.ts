/**
 * What a share template actually does when the recipient taps its button.
 *
 * Two behaviours exist and recipients experience them very differently:
 * a URL button downloads the `.vcf` on tap, because the share endpoint bakes the
 * generated object key into the template's `{{4}}` variable; a quick-reply
 * button only opens a session, and the server then sends the `.vcf` as a second
 * message.
 *
 * Only an explicit `buttonType` of `URL` counts as a download. There was once a
 * fallback that read the seeded `card_share_vcf*` key prefix as proof of a URL
 * button; production disproved it on 2026-08-09 — `card_share_vcf_en` is a
 * QUICK_REPLY, and its own body copy says "I'll send you the contact file".
 * The UI had been promising an instant download that never happened, so the
 * guess is gone: unknown means "not a download", never the reverse.
 */
import type { ShareTemplate } from "@/lib/card-share-types";

/** User-created templates are keyed `user_…`; anything else is ContactBook's own. */
const USER_KEY_PREFIX = "user_";

export type TemplateCapabilities = {
  /** Tapping the button downloads the contact file straight away. */
  deliversVcfInButton: boolean;
  hasImage: boolean;
};

function deliversVcfInButton(template: ShareTemplate): boolean {
  return template.buttonType === "URL";
}

export function classifyShareTemplate(
  template: ShareTemplate,
): TemplateCapabilities {
  return {
    deliversVcfInButton: deliversVcfInButton(template),
    hasImage: Boolean(template.headerImageUrl),
  };
}

/**
 * The template to preselect in the share dialog: the least surprising one for
 * the recipient, since a direct download needs no second tap and an image makes
 * the message look less like spam.
 */
export function pickDefaultShareTemplate(
  templates: ShareTemplate[],
): ShareTemplate | null {
  if (templates.length === 0) {
    return null;
  }
  const ranked = templates.map((template) => ({
    template,
    capabilities: classifyShareTemplate(template),
  }));
  const direct = ranked.filter((entry) => entry.capabilities.deliversVcfInButton);
  const withImage = direct.find((entry) => entry.capabilities.hasImage);
  // Failing a real URL button, prefer the seeded ContactBook template: it is the
  // one the backend nominates to carry the contact file, so choosing it must be
  // deliberate rather than a side effect of the API's response order.
  const system = templates.find((entry) => !entry.key.startsWith(USER_KEY_PREFIX));
  return withImage?.template ?? direct[0]?.template ?? system ?? templates[0];
}

/** One-line description of a template's behaviour, shown next to its option. */
export function templateCapabilitySummary(caps: TemplateCapabilities): string {
  const delivery = caps.deliversVcfInButton
    ? "Downloads the contact instantly"
    : "Sends the contact after they tap";
  return caps.hasImage ? `${delivery} · With image` : delivery;
}
