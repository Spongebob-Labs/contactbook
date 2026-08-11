import { useEffect, useState } from "react";
import { AlertCircle, MessageCircle, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ShareTemplateForm } from "@/components/cards/share-template-form";
import { WhatsappMessagePreview } from "@/components/cards/whatsapp-message-preview";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";
import { listShareTemplates } from "@/lib/card-share-api";
import { SHARE_LIMITS, shareSenderNameFrom } from "@/lib/card-share-types";
import type { ShareTemplate } from "@/lib/card-share-types";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";

function templateFriendlyName(key: string): string {
  return key.startsWith("user_") ? "Your template" : "ContactBook default";
}

function formatSyncedAt(value: string): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

type TemplateCardProps = {
  template: ShareTemplate;
  pending: boolean;
  senderName: string;
};

/** One template's approval state, header image and message preview. */
function TemplateCard({ template, pending, senderName }: TemplateCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(template.headerImageUrl) && !imageFailed;

  return (
    <Panel className="space-y-3 p-5">
      {showImage ? (
        <img
          src={template.headerImageUrl ?? undefined}
          alt=""
          className="aspect-[1.91/1] w-full rounded-md object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {templateFriendlyName(template.key)}
          </p>
        </div>
        {pending ? (
          <StatusBadge variant="neutral">Awaiting approval</StatusBadge>
        ) : (
          <StatusBadge variant="connected">Approved</StatusBadge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {template.locale} · synced {formatSyncedAt(template.syncedAt)}
      </p>
      {pending ? (
        <p className="text-xs text-muted-foreground">
          This becomes usable once WhatsApp approves it, usually within a few
          minutes. Use Refresh to check — this notice only lasts until you
          leave the page.
        </p>
      ) : null}
      <WhatsappMessagePreview
        compact
        template={template}
        senderName={senderName}
        cardName="Your card"
      />
    </Panel>
  );
}

/** Approved-templates list plus a first-class, inline entry point for submitting a new one. */
export default function ShareTemplatesPage() {
  const { profileIdentity } = useAuth();
  const [templates, setTemplates] = useState<ShareTemplate[]>([]);
  const [pendingTemplates, setPendingTemplates] = useState<ShareTemplate[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Same derivation as the share flow, so the preview reads exactly like the
  // message that actually goes out.
  const senderName = shareSenderNameFrom(profileIdentity);

  const loadTemplates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const listed = await listShareTemplates();
      setTemplates(listed);
      setPendingTemplates((current) =>
        current.filter(
          (pending) => !listed.some((template) => template.key === pending.key),
        ),
      );
    } catch (err) {
      logUiError("Could not load share templates", err);
      setTemplates([]);
      setError(
        err instanceof ApiError && err.message
          ? err.message
          : friendlyErrorMessages.load,
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  const handleCreated = (template: ShareTemplate) => {
    setPendingTemplates((current) => [
      ...current.filter((item) => item.key !== template.key),
      template,
    ]);
    setShowForm(false);
    void loadTemplates();
  };

  const userTemplateCount = new Set(
    [...templates, ...pendingTemplates]
      .map((template) => template.key)
      .filter((key) => key.startsWith("user_")),
  ).size;

  const atLimit = userTemplateCount >= SHARE_LIMITS.maxUserTemplates;

  const items = [
    ...pendingTemplates.map((template) => ({ template, pending: true })),
    ...templates.map((template) => ({ template, pending: false })),
  ];

  return (
    <AppShell>
      <PageHeader
        title="Message templates"
        subtitle="WhatsApp has to approve the exact wording before a message can be sent, so you choose from ready-made options here instead of typing your own. The header image and which option you use are up to you."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => void loadTemplates()}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={showForm || atLimit}
              onClick={() => setShowForm(true)}
            >
              New template
            </Button>
          </>
        }
      />

      <p className="mt-4 text-sm text-muted-foreground">
        There's no editing wording after the fact — create another template
        (up to {SHARE_LIMITS.maxUserTemplates}) and pick whichever one you
        want when you share a card. You're using {userTemplateCount} of{" "}
        {SHARE_LIMITS.maxUserTemplates} now.
      </p>

      {showForm ? (
        <Panel className="mt-6 space-y-4">
          <PanelHeader title="New template" />
          <ShareTemplateForm
            onCreated={handleCreated}
            existingCount={userTemplateCount}
            onCancel={() => setShowForm(false)}
          />
        </Panel>
      ) : null}

      {isLoading ? (
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-72 w-full rounded-lg" />
          ))}
        </section>
      ) : null}

      {!isLoading && error ? (
        <Alert className="mt-6 flex items-start gap-3">
          <AlertCircle
            className="mt-0.5 h-4 w-4 text-destructive"
            aria-hidden="true"
          />
          <div>
            <p className="font-medium">Could not load templates</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
        </Alert>
      ) : null}

      {!isLoading && !error && items.length === 0 && !showForm ? (
        <Panel className="mt-6 border-dashed">
          <div className="flex min-h-56 flex-col items-center justify-center px-2 py-6 text-center">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-foreground">
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="text-base font-semibold text-foreground">
              No templates yet
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              You don't have any WhatsApp-approved wording yet. Create one to
              start sharing your cards.
            </p>
          </div>
        </Panel>
      ) : null}

      {!isLoading && !error && items.length > 0 ? (
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          {items.map(({ template, pending }) => (
            <TemplateCard
              key={pending ? `pending-${template.key}` : template.key}
              template={template}
              pending={pending}
              senderName={senderName}
            />
          ))}
        </section>
      ) : null}
    </AppShell>
  );
}
