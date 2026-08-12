import { useEffect, useRef, useState, type JSX } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  MessagesSquare,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { CardFieldTypesPicker } from "@/components/cards/card-field-types-picker";
import { ShareBatchStatus } from "@/components/cards/share-batch-status";
import {
  ShareRecipientPicker,
  toRecipientInputs,
  type ShareRecipientDraft,
} from "@/components/cards/share-recipient-picker";
import { ShareTemplatePicker } from "@/components/cards/share-template-picker";
import { VcardPreview } from "@/components/cards/vcard-preview";
import { WhatsappMessagePreview } from "@/components/cards/whatsapp-message-preview";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";
import { readCardFieldSelection } from "@/lib/card-field-selection";
import {
  generateCardVcard,
  listShareTemplates,
  shareCard,
} from "@/lib/card-share-api";
import {
  SHARE_LIMITS,
  type CardShareBatch,
  type ShareableFieldType,
  type ShareTemplate,
} from "@/lib/card-share-types";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import {
  classifyShareTemplate,
  pickDefaultShareTemplate,
} from "@/lib/share-template-capabilities";
import type { ContactCard } from "@/lib/types";
import { fetchVcardText, vcardFieldTypes } from "@/lib/vcard-content";

export type ShareCardDialogProps = {
  open: boolean;
  onClose: () => void;
  card: ContactCard;
  senderName: string;
  /**
   * Field types to start from; the dialog lets the user narrow them further for
   * this send only. Omit it and the card's own saved selection is read from the
   * store — every entry point then respects the narrowing the user set on the
   * card page, instead of quietly falling back to "share everything".
   */
  defaultFieldTypes?: ShareableFieldType[];
  onShared?: (batch: CardShareBatch) => void;
};

const STEP_LABELS = ["Message", "Details", "Recipients"] as const;
const TOTAL_STEPS = STEP_LABELS.length;

/** Three-step WhatsApp share flow: message + note, vCard field types, recipients. */
export function ShareCardDialog({
  open,
  onClose,
  card,
  senderName,
  defaultFieldTypes,
  onShared,
}: ShareCardDialogProps): JSX.Element | null {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [step, setStep] = useState(1);

  const [templates, setTemplates] = useState<ShareTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templateKey, setTemplateKey] = useState<string | null>(null);

  const [note, setNote] = useState("");
  const [fieldTypes, setFieldTypes] = useState<ShareableFieldType[]>([]);
  const [recipients, setRecipients] = useState<ShareRecipientDraft[]>([]);
  /** Undefined until the card's vCard is read — the picker then offers every type. */
  const [availableTypes, setAvailableTypes] = useState<
    ShareableFieldType[] | undefined
  >(undefined);
  /** Identifies the current open, so a stale probe cannot land on a new card. */
  const openTokenRef = useRef(0);

  const [isSending, setIsSending] = useState(false);
  const [batch, setBatch] = useState<CardShareBatch | null>(null);

  const isBlocked = card.isSensitive === true;
  /**
   * Two independent ways to know the card holds nothing, because neither is
   * always available: `mappedFieldIds` is absent from some list responses, and
   * the vCard probe can fail. `undefined` on either side means unknown, not
   * empty, so no claim is made from it.
   */
  const isNameOnly =
    card.mappedFieldIds?.length === 0 || availableTypes?.length === 0;
  /**
   * The probe has come back and found nothing, so there is genuinely no choice to
   * offer. `mappedFieldIds` alone is not enough to hide the picker: it can be
   * stale or absent, and hiding the picker on a card that does carry details
   * would strand the user with no way to narrow.
   */
  const hasNothingToFilter = availableTypes?.length === 0;

  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    setTemplatesError(null);
    try {
      const listed = await listShareTemplates();
      setTemplates(listed);
      // Selected in the same commit as the list. Choosing in a follow-up effect
      // left one render where the picker showed options with nothing selected
      // and the preview fell back to its placeholder — a visible flash.
      // The functional form keeps a choice the user already made.
      setTemplateKey(
        (current) => current ?? pickDefaultShareTemplate(listed)?.key ?? null,
      );
    } catch (error) {
      logUiError("Could not load share templates", error);
      setTemplates([]);
      setTemplatesError(
        error instanceof ApiError && error.message
          ? error.message
          : friendlyErrorMessages.load,
      );
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  /**
   * What this card carries, read off its own unfiltered vCard — the file the
   * server builds from the card's field mappings, and the only place that answer
   * exists (`fieldTypes` in the response merely echoes the filter sent in).
   *
   * A failure leaves it unknown and every type stays pickable: greying out a
   * detail the card really holds is worse than offering one it does not.
   */
  const loadAvailableTypes = async (token: number) => {
    try {
      // No filter: everything mapped to the card. Content-addressed, so this is
      // the same asset the preview will show when nothing is narrowed.
      const asset = await generateCardVcard(card.id);
      const text = await fetchVcardText(asset.objectKey);
      if (openTokenRef.current !== token) {
        return;
      }
      setAvailableTypes(vcardFieldTypes(text));
    } catch (error) {
      logUiError("Could not read what this card carries", error);
      if (openTokenRef.current === token) {
        setAvailableTypes(undefined);
      }
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    // Reopening for a different card must not accept the previous card's
    // in-flight answer about what it carries.
    const token = openTokenRef.current + 1;
    openTokenRef.current = token;
    setStep(1);
    setTemplateKey(null);
    setNote("");
    // Falls back to the card's stored selection rather than `[]`: an empty list
    // is "share everything" to the API, so a caller that forgets the prop would
    // widen what goes out without anyone touching a switch.
    setFieldTypes(defaultFieldTypes ?? readCardFieldSelection(userId, card.id));
    setRecipients([]);
    setAvailableTypes(undefined);
    setBatch(null);
    if (card.isSensitive) {
      setTemplates([]);
      setTemplatesError(null);
      setIsLoadingTemplates(false);
      return;
    }
    void loadTemplates();
    void loadAvailableTypes(token);
    // Only re-run when the dialog opens — reopening should start from a clean slate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (isSending) {
        return;
      }
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, isSending]);

  if (!open) {
    return null;
  }

  const selectedTemplate = templates.find((template) => template.key === templateKey) ?? null;

  const handleNext = () => {
    if (step === 1 && !templateKey) {
      return;
    }
    setStep((current) => Math.min(TOTAL_STEPS, current + 1));
  };

  const handleBack = () => {
    setStep((current) => Math.max(1, current - 1));
  };

  const handleSend = async () => {
    if (!templateKey || recipients.length < SHARE_LIMITS.minRecipientsPerBatch) {
      return;
    }
    setIsSending(true);
    try {
      const created = await shareCard(card.id, {
        templateKey,
        recipients: toRecipientInputs(recipients),
        note,
        fieldTypes,
      });
      setBatch(created);
      onShared?.(created);
    } catch (error) {
      logUiError("Could not share card", error);
      toast.error(
        error instanceof ApiError && error.message
          ? error.message
          : friendlyErrorMessages.save,
      );
    } finally {
      setIsSending(false);
    }
  };

  const nextDisabled = isSending || (step === 1 && !templateKey);
  const sendDisabled = isSending || recipients.length < SHARE_LIMITS.minRecipientsPerBatch;

  if (isBlocked) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Share card"
          className="overlay-enter relative z-10 max-h-[85vh] w-full max-w-3xl space-y-4 overflow-y-auto overscroll-contain rounded-t-xl border border-border bg-surface p-5 sm:max-h-[calc(100vh-2rem)] sm:rounded-xl"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-destructive">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Can't share this card</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                "{card.name}" is marked sensitive, so it can't be sent over WhatsApp. Remove the
                sensitive flag from the card first if you need to share it.
              </p>
            </div>
          </div>
          <div className="flex justify-end border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Share card"
        className="overlay-enter relative z-10 max-h-[85vh] w-full max-w-3xl space-y-4 overflow-y-auto overscroll-contain rounded-t-xl border border-border bg-surface p-5 sm:max-h-[calc(100vh-2rem)] sm:rounded-xl"
      >
        {batch ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
              <h2 className="text-base font-semibold text-foreground">Card sent</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              We'll keep dispatching to each recipient in the background. You can watch delivery
              land below.
            </p>
            <ShareBatchStatus batch={batch} onChange={setBatch} autoPoll />
            <div className="flex justify-end border-t border-border pt-4">
              <Button type="button" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Share card</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Send "{card.name}" as a WhatsApp message with a button to save the contact.
              </p>
            </div>

            <p className="label-section">{STEP_LABELS[step - 1]}</p>

            {step === 1 ? (
              <div className="space-y-4">
                {templatesError ? (
                  <Alert className="flex items-start gap-3">
                    <AlertCircle
                      className="mt-0.5 h-4 w-4 text-destructive"
                      aria-hidden="true"
                    />
                    <div className="flex-1">
                      <p className="font-medium">Could not load templates</p>
                      <p className="mt-1 text-sm text-muted-foreground">{templatesError}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => void loadTemplates()}
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        Retry
                      </Button>
                    </div>
                  </Alert>
                ) : (
                  <div className="lg:grid lg:grid-cols-2 lg:gap-5">
                    <div className="space-y-4">
                      <ShareTemplatePicker
                        templates={templates}
                        value={templateKey}
                        onChange={setTemplateKey}
                        isLoading={isLoadingTemplates}
                        disabled={isSending}
                        onCreateTemplate={() => navigate("/dashboard/share-templates")}
                      />
                      <label className="flex flex-col gap-2 text-sm font-medium">
                        <span>Add a note (optional)</span>
                        <textarea
                          className="min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
                          maxLength={SHARE_LIMITS.maxNoteLength}
                          value={note}
                          disabled={isSending}
                          onChange={(event) => setNote(event.target.value)}
                        />
                        <span className="text-xs text-muted-foreground">
                          {note.length}/{SHARE_LIMITS.maxNoteLength}
                        </span>
                      </label>
                    </div>
                    <div className="mt-4 lg:mt-0">
                      <p className="mb-2 text-sm font-medium text-foreground">Preview</p>
                      <WhatsappMessagePreview
                        template={selectedTemplate}
                        senderName={senderName}
                        cardName={card.name}
                        note={note}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                {/*
                  A card with no field mappings sends FN/N and nothing else. A
                  filter cannot conjure a field, so the picker is not shown at
                  all here — a grid of twelve dead checkboxes above "0 of 0
                  selected" reads as a broken screen, and there is no decision on
                  it for the user to make.
                */}
                {hasNothingToFilter ? (
                  <>
                    <Alert className="flex items-start gap-3">
                      <AlertCircle
                        className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="font-medium">
                          "{card.name}" has no details attached yet
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Recipients would get your name and nothing else. There
                          is nothing to pick here until the card carries
                          something — attach your details to it first, then come
                          back.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => navigate(`/dashboard/cards/${card.id}`)}
                        >
                          Open card and attach details
                        </Button>
                      </div>
                    </Alert>
                    <div className="lg:max-w-sm">
                      <VcardPreview
                        cardId={card.id}
                        fieldTypes={fieldTypes}
                        cardName={card.name}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Tick the details that end up in the contact file the
                      recipient saves. Untick nothing and they get everything this
                      card carries. Only details already on the card can be sent.
                    </p>
                    {/*
                      The probe could not read the card, but the card itself says
                      it holds nothing — still worth warning about, even though
                      the picker has to stay usable in case that is stale.
                    */}
                    {isNameOnly ? (
                      <Alert className="flex items-start gap-3">
                        <AlertCircle
                          className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="font-medium">
                            "{card.name}" may have no details attached
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Check the preview before sending — if it shows only
                            your name, open the card and attach your details
                            first.
                          </p>
                        </div>
                      </Alert>
                    ) : null}
                    <div className="lg:grid lg:grid-cols-2 lg:gap-5">
                      <CardFieldTypesPicker
                        value={fieldTypes}
                        onChange={setFieldTypes}
                        availableTypes={availableTypes}
                        disabled={isSending}
                      />
                      {/*
                        Driven by the same `fieldTypes` the share call sends, so
                        the file on screen is the file the recipient gets. The VCF
                        is content-addressed by card + selection, so previewing
                        one selection while sending another is how a photo goes
                        missing.
                      */}
                      <div className="mt-4 lg:mt-0">
                        <VcardPreview
                          cardId={card.id}
                          fieldTypes={fieldTypes}
                          cardName={card.name}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {step === 3 && selectedTemplate ? (
              <DeliveryNotice
                deliversVcfInButton={
                  classifyShareTemplate(selectedTemplate).deliversVcfInButton
                }
              />
            ) : null}

            {step === 3 ? (
              <ShareRecipientPicker
                value={recipients}
                onChange={setRecipients}
                disabled={isSending}
              />
            ) : null}

            <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={step === 1 || isSending}
              >
                Back
              </Button>
              <div className="flex items-center gap-3">
                <Badge variant="success">
                  Step {step} of {TOTAL_STEPS}
                </Badge>
                {step < TOTAL_STEPS ? (
                  <Button type="button" onClick={handleNext} disabled={nextDisabled}>
                    Next
                  </Button>
                ) : (
                  <Button type="button" onClick={() => void handleSend()} disabled={sendDisabled}>
                    {isSending ? "Sending…" : "Send card"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type DeliveryNoticeProps = {
  deliversVcfInButton: boolean;
};

/**
 * What the recipient will actually experience, stated on the step where the
 * sender is about to commit.
 *
 * The two template kinds behave very differently and the sender cannot tell
 * them apart from the message preview alone — the button looks identical. The
 * wording hedges deliberately: the API does not return `buttonType`, so the
 * behaviour is inferred from the template key and must not be promised outright.
 */
function DeliveryNotice({ deliversVcfInButton }: DeliveryNoticeProps): JSX.Element {
  const Icon = deliversVcfInButton ? Download : MessagesSquare;
  return (
    <Alert className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
      <div>
        <p className="font-medium">
          {deliversVcfInButton
            ? "They can save you in one tap"
            : "Your contact follows in a second message"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {deliversVcfInButton
            ? "Tapping the button should open your contact file straight away, ready to add to their phonebook."
            : "They tap Get Contact, and the contact file arrives as a separate message moments later, ready to add to their phonebook. Nothing more is needed from you."}
        </p>
      </div>
    </Alert>
  );
}
