import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, Link2, Plus, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";
import { fetchShareTemplates, shareCard } from "@/lib/card-share-api";
import { DIAL_COUNTRIES } from "@/lib/dial-countries";
import { nationalDigits } from "@/lib/phone";
import { renderTemplatePreview } from "@/lib/template-preview";
import type { ContactCard, ShareRecipientInput, ShareTemplate } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_RECIPIENTS = 50;
const MAX_NOTE_LENGTH = 300;

type Step = "template" | "details" | "confirm";

type ShareCardDialogProps = {
  card: ContactCard;
  open: boolean;
  onClose: () => void;
};

/**
 * WhatsApp-style preview of a template card. The body comes straight from the synced
 * Twilio template, so what's rendered here is exactly what the recipient receives.
 */
function TemplateBubble({
  template,
  senderName,
  cardName,
  note,
}: {
  template: ShareTemplate;
  senderName: string;
  cardName: string;
  note?: string;
}) {
  return (
    <div className="w-full rounded-lg rounded-tl-none border border-emerald-200 bg-emerald-50 text-left shadow-xs dark:border-emerald-900 dark:bg-emerald-950/40">
      {template.headerImageUrl && (
        <img
          src={template.headerImageUrl}
          alt=""
          className="max-h-32 w-full rounded-t-lg object-cover"
        />
      )}
      <p className="whitespace-pre-wrap px-3 py-2 text-sm text-foreground">
        {renderTemplatePreview(template.body, { senderName, cardName, note })}
      </p>
      <div className="flex items-center justify-center gap-1.5 border-t border-emerald-200 px-3 py-2 text-sm font-medium text-sky-600 dark:border-emerald-900 dark:text-sky-400">
        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
        {template.buttonTitle}
      </div>
    </div>
  );
}

export function ShareCardDialog({ card, open, onClose }: ShareCardDialogProps) {
  const { profileIdentity } = useAuth();
  const senderName =
    `${profileIdentity?.firstName ?? ""} ${profileIdentity?.lastName ?? ""}`.trim() ||
    "You";

  const [step, setStep] = useState<Step>("template");
  const [templates, setTemplates] = useState<ShareTemplate[] | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [note, setNote] = useState("");
  const [recipients, setRecipients] = useState<ShareRecipientInput[]>([]);
  const [dialCode, setDialCode] = useState<string>("+91");
  const [phoneInput, setPhoneInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  const selectedTemplate = useMemo(
    () => templates?.find((t) => t.key === selectedKey) ?? null,
    [templates, selectedKey],
  );

  const loadTemplates = useCallback(async () => {
    setTemplates(null);
    setTemplatesError(null);
    try {
      const items = await fetchShareTemplates();
      setTemplates(items);
      // Preselect when there is exactly one option; otherwise force an explicit pick.
      setSelectedKey(items.length === 1 ? items[0].key : null);
    } catch (error) {
      setTemplatesError(
        error instanceof Error ? error.message : "Could not load templates.",
      );
      setTemplates([]);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setStep("template");
      setNote("");
      setRecipients([]);
      setPhoneInput("");
      void loadTemplates();
    }
  }, [open, loadTemplates]);

  const addRecipient = () => {
    const digits = nationalDigits(phoneInput);
    if (!/^\d{4,15}$/.test(digits)) {
      toast.error("Enter a valid phone number.");
      return;
    }
    if (recipients.length >= MAX_RECIPIENTS) {
      toast.error(`At most ${MAX_RECIPIENTS} recipients per share.`);
      return;
    }
    const exists = recipients.some(
      (r) => r.countryCode === dialCode && r.phone === digits,
    );
    if (!exists) {
      setRecipients([...recipients, { countryCode: dialCode, phone: digits }]);
    }
    setPhoneInput("");
  };

  const handleSend = async () => {
    if (!selectedTemplate || recipients.length === 0) {
      return;
    }
    setIsSending(true);
    try {
      const batch = await shareCard(card.id, {
        templateKey: selectedTemplate.key,
        note: note.trim() ? note.trim() : undefined,
        recipients,
      });
      toast.success(
        `Card queued for ${batch.recipients.length} recipient${batch.recipients.length === 1 ? "" : "s"}.`,
      );
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // The picked template became unavailable between pick and send
        // (deactivated, approval revoked, or drifted). Re-pick from a fresh list.
        toast.error(error.message);
        setStep("template");
        void loadTemplates();
      } else {
        toast.error(
          error instanceof Error ? error.message : "Could not share the card.",
        );
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader
        title={`Share "${card.name}"`}
        description={
          step === "template"
            ? "Pick the message your recipients will get on WhatsApp."
            : step === "details"
              ? "Add recipients and an optional personal note."
              : "Review the exact message before sending."
        }
      />

      {step === "template" && (
        <>
          <DialogBody className="space-y-3">
            {templates === null && !templatesError && (
              <>
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
              </>
            )}

            {templates !== null && templates.length === 0 && (
              <Alert className="flex items-start gap-3">
                <AlertCircle
                  className="mt-0.5 h-4 w-4 text-destructive"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-medium">Sharing is temporarily unavailable</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {templatesError ??
                      "No approved message templates right now. Please try again later."}
                  </p>
                </div>
              </Alert>
            )}

            {templates?.map((template) => (
              <button
                key={template.key}
                type="button"
                onClick={() => setSelectedKey(template.key)}
                aria-pressed={selectedKey === template.key}
                className={cn(
                  "w-full rounded-lg border-2 p-3 text-left transition-colors",
                  selectedKey === template.key
                    ? "border-primary bg-primary/5"
                    : "border-transparent hover:border-border",
                )}
              >
                <TemplateBubble
                  template={template}
                  senderName={senderName}
                  cardName={card.name}
                />
              </button>
            ))}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!selectedTemplate}
              onClick={() => setStep("details")}
            >
              Continue
            </Button>
          </DialogFooter>
        </>
      )}

      {step === "details" && selectedTemplate && (
        <>
          <DialogBody className="space-y-4">
            <div>
              <label
                htmlFor="share-note"
                className="text-xs font-medium uppercase text-muted-foreground"
              >
                Personal note (optional)
              </label>
              <Input
                id="share-note"
                value={note}
                maxLength={MAX_NOTE_LENGTH}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Great meeting you!"
                className="mt-1"
              />
            </div>

            <TemplateBubble
              template={selectedTemplate}
              senderName={senderName}
              cardName={card.name}
              note={note}
            />

            <div>
              <label
                htmlFor="share-phone"
                className="text-xs font-medium uppercase text-muted-foreground"
              >
                Recipients ({recipients.length}/{MAX_RECIPIENTS})
              </label>
              <div className="mt-1 flex gap-2">
                <Select
                  aria-label="Country code"
                  value={dialCode}
                  onChange={(event) => setDialCode(event.target.value)}
                  className="w-32"
                >
                  {DIAL_COUNTRIES.map((country) => (
                    <option key={country.iso2} value={country.dial}>
                      {country.iso2} {country.dial}
                    </option>
                  ))}
                </Select>
                <Input
                  id="share-phone"
                  value={phoneInput}
                  onChange={(event) => setPhoneInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addRecipient();
                    }
                  }}
                  placeholder="Phone number"
                  inputMode="tel"
                />
                <Button variant="outline" size="icon" onClick={addRecipient} aria-label="Add recipient">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              {recipients.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {recipients.map((recipient) => (
                    <li
                      key={`${recipient.countryCode}${recipient.phone}`}
                      className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm"
                    >
                      {recipient.countryCode} {recipient.phone}
                      <button
                        type="button"
                        aria-label={`Remove ${recipient.countryCode} ${recipient.phone}`}
                        onClick={() =>
                          setRecipients(recipients.filter((r) => r !== recipient))
                        }
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStep("template")}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </Button>
            <Button
              disabled={recipients.length === 0}
              onClick={() => setStep("confirm")}
            >
              Review
            </Button>
          </DialogFooter>
        </>
      )}

      {step === "confirm" && selectedTemplate && (
        <>
          <DialogBody className="space-y-4">
            <TemplateBubble
              template={selectedTemplate}
              senderName={senderName}
              cardName={card.name}
              note={note}
            />
            <p className="text-sm text-muted-foreground">
              This exact message goes to{" "}
              <span className="font-medium text-foreground">
                {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
              </span>{" "}
              on WhatsApp:{" "}
              {recipients
                .map((r) => `${r.countryCode} ${r.phone}`)
                .join(", ")}
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStep("details")}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </Button>
            <Button disabled={isSending} onClick={handleSend}>
              <Send className="h-4 w-4" aria-hidden="true" />
              {isSending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  );
}
