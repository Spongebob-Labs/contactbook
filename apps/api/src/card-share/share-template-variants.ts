/**
 * The fixed set of body copy variants users can pick when creating their own share
 * template. Users choose a variant + optionally upload a header image — they cannot
 * write freeform body text, which keeps Meta approval predictable and prevents abuse.
 *
 * All bodies use the standard card-share variables ({{1}} sender name, {{2}} card name,
 * {{3}} note — single space when empty) and pair with a "Get Contact" QUICK_REPLY
 * button that triggers the VCF document follow-up. No {{4}}: quick-reply templates
 * have no URL button.
 */
export type ShareTemplateVariant = {
  /** Stable identifier clients pass to POST /cards/share-templates. */
  id: string;
  label: string;
  body: string;
};

export const SHARE_TEMPLATE_BUTTON_TITLE = "Get Contact";

export const SHARE_TEMPLATE_VARIANTS: readonly ShareTemplateVariant[] = [
  {
    id: "classic",
    label: "Classic",
    body:
      'New contact card: {{1}} shared "{{2}}" with you on ContactBook.{{3}}\n\n' +
      "Tap the button below and I'll send you the contact file so you can save it straight to your phonebook.",
  },
  {
    id: "warm",
    label: "Warm",
    body:
      'Hi! {{1}} would love to stay in touch and shared their "{{2}}" card with you.{{3}}\n\n' +
      "Tap below and I'll send over the contact file to save to your phone.",
  },
  {
    id: "professional",
    label: "Professional",
    body:
      'Hello — {{1}} has shared their "{{2}}" contact card with you via ContactBook.{{3}}\n\n' +
      "Tap the button to receive the contact file for your address book.",
  },
  {
    id: "minimal",
    label: "Minimal",
    body: '{{1}} shared "{{2}}" with you.{{3}}\n\nTap below to get the contact file.',
  },
] as const;

export function findShareTemplateVariant(
  id: string,
): ShareTemplateVariant | undefined {
  return SHARE_TEMPLATE_VARIANTS.find((v) => v.id === id);
}
