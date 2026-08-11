/**
 * Renders a WhatsApp template body exactly as Twilio will send it, substituting the
 * same variables the dispatch service passes ({{1}} sender name, {{2}} card name,
 * {{3}} note). {{4}} is the vCard object key and only ever appears in the button URL,
 * never in the body.
 *
 * Mirrors apps/api/src/card-share/twilio-card-share.provider.ts: an empty note is
 * sent as a single space (WhatsApp rejects empty variable values), so the preview
 * must do the same for character-for-character parity with the delivered message.
 */
export function renderTemplatePreview(
  body: string,
  vars: { senderName: string; cardName: string; note?: string },
): string {
  const note = vars.note && vars.note.trim().length > 0 ? vars.note : " ";
  return body
    .replaceAll("{{1}}", vars.senderName)
    .replaceAll("{{2}}", vars.cardName)
    .replaceAll("{{3}}", note);
}
