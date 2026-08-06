import { useEffect, useState } from "react";
import { AlertCircle, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApiError } from "@/lib/api";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import {
  createWhatsappTemplate,
  deleteWhatsappTemplate,
  getWhatsappTemplate,
  listWhatsappTemplates,
  updateWhatsappTemplate,
  type WhatsappTemplate,
} from "@/lib/whatsapp-templates-api";

const DEFAULT_TEMPLATE_BODY =
  'Hi! {{1}} shared their contact card "{{2}}" with you on ContactBook.{{3}}\n\nTap the button below — I\'ll send you the contact file so you can save it straight to your phonebook.';

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function approvalVariant(
  status: WhatsappTemplate["approvalStatus"],
): "connected" | "danger" | "neutral" {
  if (status === "approved") {
    return "connected";
  }
  if (status === "rejected") {
    return "danger";
  }
  return "neutral";
}

export default function WhatsappTemplatesPage() {
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createKey, setCreateKey] = useState("");
  const [createBody, setCreateBody] = useState(DEFAULT_TEMPLATE_BODY);
  const [createButtonTitle, setCreateButtonTitle] = useState("Get Contact");
  const [createAsDefault, setCreateAsDefault] = useState(false);

  const loadTemplates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const listed = await listWhatsappTemplates("CARD_SHARE");
      const enriched = await Promise.all(
        listed.map(async (template) => {
          try {
            return await getWhatsappTemplate(template.key);
          } catch {
            return template;
          }
        }),
      );
      setTemplates(enriched);
    } catch (err) {
      logUiError("Could not load WhatsApp templates", err);
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

  const toggleActive = async (template: WhatsappTemplate) => {
    setBusyKey(template.key);
    try {
      const updated = await updateWhatsappTemplate(template.key, {
        isActive: !template.isActive,
      });
      setTemplates((current) =>
        current.map((item) =>
          item.key === template.key ? { ...item, ...updated } : item,
        ),
      );
      toast.success(
        updated.isActive
          ? `"${template.key}" activated.`
          : `"${template.key}" deactivated.`,
      );
    } catch (err) {
      logUiError("Could not update WhatsApp template", err);
      toast.error(
        err instanceof ApiError && err.message
          ? err.message
          : friendlyErrorMessages.save,
      );
    } finally {
      setBusyKey(null);
    }
  };

  const makeDefault = async (template: WhatsappTemplate) => {
    setBusyKey(template.key);
    try {
      const updated = await updateWhatsappTemplate(template.key, {
        isDefault: true,
        isActive: true,
      });
      setTemplates((current) =>
        current.map((item) => {
          if (item.key === template.key) {
            return { ...item, ...updated, isDefault: true, isActive: true };
          }
          if (item.useCase === template.useCase) {
            return { ...item, isDefault: false };
          }
          return item;
        }),
      );
      toast.success(`"${template.key}" set as default.`);
    } catch (err) {
      logUiError("Could not set default WhatsApp template", err);
      toast.error(
        err instanceof ApiError && err.message
          ? err.message
          : friendlyErrorMessages.save,
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleCreate = async () => {
    const key = createKey.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,64}$/.test(key)) {
      toast.error("Key must be 3–64 chars: lowercase, digits, underscores.");
      return;
    }
    if (createBody.trim().length < 10) {
      toast.error("Template body must be at least 10 characters.");
      return;
    }
    setIsCreating(true);
    try {
      const created = await createWhatsappTemplate({
        key,
        body: createBody,
        buttonTitle: createButtonTitle,
        isDefault: createAsDefault,
      });
      setTemplates((current) => [created, ...current]);
      setShowCreate(false);
      setCreateKey("");
      setCreateBody(DEFAULT_TEMPLATE_BODY);
      setCreateButtonTitle("Get Contact");
      setCreateAsDefault(false);
      toast.success(`Template "${key}" submitted for WhatsApp approval.`);
      await loadTemplates();
    } catch (err) {
      logUiError("Could not create WhatsApp template", err);
      toast.error(
        err instanceof ApiError && err.message
          ? err.message
          : "Could not create template.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (template: WhatsappTemplate) => {
    const confirmed = window.confirm(
      `Delete template “${template.key}”? This removes it from Twilio and cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }
    setBusyKey(template.key);
    try {
      await deleteWhatsappTemplate(template.key);
      setTemplates((current) =>
        current.filter((item) => item.key !== template.key),
      );
      toast.success(`"${template.key}" deleted.`);
    } catch (err) {
      logUiError("Could not delete WhatsApp template", err);
      toast.error(
        err instanceof ApiError && err.message
          ? err.message
          : "Could not delete template.",
      );
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="WhatsApp templates"
        subtitle="Card-share templates from Twilio Content API. Activate an approved template before sharing cards."
        actions={
          <div className="flex flex-wrap gap-2">
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
              onClick={() => setShowCreate((open) => !open)}
            >
              {showCreate ? "Hide form" : "New template"}
            </Button>
          </div>
        }
      />

      {showCreate ? (
        <Panel className="mb-6 space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Create template
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Submits to Twilio for WhatsApp approval. Use {"{{1}}"} {"{{2}}"}{" "}
              {"{{3}}"} for sender, card name, and note.
            </p>
          </div>
          <label className="flex flex-col gap-2 text-sm font-medium">
            <span>Key</span>
            <Input
              placeholder="card_share_v4_quick_reply"
              value={createKey}
              onChange={(event) => setCreateKey(event.target.value)}
              disabled={isCreating}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            <span>Body</span>
            <textarea
              className="min-h-32 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
              value={createBody}
              onChange={(event) => setCreateBody(event.target.value)}
              disabled={isCreating}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            <span>Button title</span>
            <Input
              value={createButtonTitle}
              onChange={(event) => setCreateButtonTitle(event.target.value)}
              disabled={isCreating}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={createAsDefault}
              onChange={(event) => setCreateAsDefault(event.target.checked)}
              disabled={isCreating}
            />
            Set as default for card share when approved
          </label>
          <Button
            type="button"
            disabled={isCreating}
            onClick={() => void handleCreate()}
          >
            {isCreating ? "Submitting…" : "Create & submit"}
          </Button>
        </Panel>
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : null}

      {!isLoading && error ? (
        <Alert className="flex items-start gap-3">
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

      {!isLoading && !error && templates.length === 0 ? (
        <Panel className="p-6 text-sm text-muted-foreground">
          No card-share templates yet. Create them via the API or backend admin,
          then refresh this page.
        </Panel>
      ) : null}

      {!isLoading && !error ? (
        <ul className="space-y-3">
          {templates.map((template) => (
            <li key={template.id}>
              <Panel className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <MessageCircle
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <h2 className="truncate text-base font-semibold text-foreground">
                        {template.key}
                      </h2>
                      {template.isDefault ? (
                        <StatusBadge variant="connected">Default</StatusBadge>
                      ) : null}
                      <StatusBadge
                        variant={template.isActive ? "connected" : "neutral"}
                      >
                        {template.isActive ? "Active" : "Inactive"}
                      </StatusBadge>
                      {template.approvalStatus ? (
                        <StatusBadge
                          variant={approvalVariant(template.approvalStatus)}
                        >
                          {template.approvalStatus}
                        </StatusBadge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {template.bodyPreview}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {template.useCase} · {template.locale} · created{" "}
                      {formatDate(template.createdAt)}
                    </p>
                    {template.rejectionReason ? (
                      <p className="mt-1 text-xs text-destructive">
                        {template.rejectionReason}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyKey === template.key}
                      onClick={() => void toggleActive(template)}
                    >
                      {template.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        busyKey === template.key || template.isDefault
                      }
                      onClick={() => void makeDefault(template)}
                    >
                      Set default
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyKey === template.key}
                      onClick={() => void handleDelete(template)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      ) : null}
    </AppShell>
  );
}
