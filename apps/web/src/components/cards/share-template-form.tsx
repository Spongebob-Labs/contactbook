import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, ImageIcon, RefreshCw, X } from "lucide-react";
import { WhatsappMessagePreview } from "@/components/cards/whatsapp-message-preview";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import {
  createShareTemplate,
  listShareTemplateVariants,
} from "@/lib/card-share-api";
import {
  SHARE_LIMITS,
  type ShareTemplate,
  type ShareTemplateVariant,
} from "@/lib/card-share-types";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { cn } from "@/lib/utils";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SAMPLE_NOTE = "Great connecting today — save my number!";

export type ShareTemplateFormProps = {
  onCreated: (template: ShareTemplate) => void;
  /** How many templates the user already has, for the max-3 guard. */
  existingCount: number;
  /** Rendered inline on a page rather than inside a modal. */
  onCancel?: () => void;
  className?: string;
};

/**
 * Submits one of WhatsApp's pre-approved body-copy variants (plus an optional
 * header image) for Meta approval. The wording itself is never editable.
 */
export function ShareTemplateForm({
  onCreated,
  existingCount,
  onCancel,
  className,
}: ShareTemplateFormProps) {
  const [variants, setVariants] = useState<ShareTemplateVariant[]>([]);
  const [isLoadingVariants, setIsLoadingVariants] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBlocked = existingCount >= SHARE_LIMITS.maxUserTemplates;
  const formDisabled = isSubmitting || isBlocked;

  const loadVariants = async () => {
    setIsLoadingVariants(true);
    setLoadError(null);
    try {
      const listed = await listShareTemplateVariants();
      setVariants(listed);
    } catch (error) {
      logUiError("Could not load share template variants", error);
      setVariants([]);
      setLoadError(
        error instanceof ApiError && error.message
          ? error.message
          : friendlyErrorMessages.load,
      );
    } finally {
      setIsLoadingVariants(false);
    }
  };

  useEffect(() => {
    void loadVariants();
    // Loads once per mount — the page/modal remounts this form each time it
    // is opened, which is what should reset the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const selectedVariant =
    variants.find((variant) => variant.id === selectedVariantId) ?? null;

  const previewTemplate: ShareTemplate | null = selectedVariant
    ? {
        key: "",
        locale: "en",
        body: selectedVariant.body,
        buttonTitle: selectedVariant.buttonTitle,
        headerImageUrl: imagePreviewUrl,
        syncedAt: "",
      }
    : null;

  const handleImageSelect = (file: File | undefined) => {
    if (!file) {
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setImageError("Choose a JPEG or PNG image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Choose an image under 5 MB.");
      return;
    }
    setImageError(null);
    setImageFile(file);
  };

  const handleImageRemove = () => {
    setImageFile(null);
    setImageError(null);
  };

  const handleSubmit = async () => {
    if (formDisabled || !selectedVariantId) {
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await createShareTemplate({
        variant: selectedVariantId,
        image: imageFile,
      });
      toast.success("Template submitted for WhatsApp approval.");
      onCreated(created);
    } catch (error) {
      logUiError("Could not create share template", error);
      toast.error(
        error instanceof ApiError && error.message
          ? error.message
          : "Could not create the template.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {isBlocked ? (
        <Alert className="flex items-start gap-3">
          <AlertCircle
            className="mt-0.5 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <div>
            <p className="font-medium">Template limit reached</p>
            <p className="mt-1 text-sm text-muted-foreground">
              WhatsApp allows up to {SHARE_LIMITS.maxUserTemplates} custom
              templates per account. You already have that many, so new
              templates can't be submitted right now.
            </p>
          </div>
        </Alert>
      ) : null}

      {isLoadingVariants ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-md" />
          ))}
        </div>
      ) : null}

      {!isLoadingVariants && loadError ? (
        <Alert className="flex items-start gap-3">
          <AlertCircle
            className="mt-0.5 h-4 w-4 text-destructive"
            aria-hidden="true"
          />
          <div className="flex-1">
            <p className="font-medium">Could not load template options</p>
            <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void loadVariants()}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry
            </Button>
          </div>
        </Alert>
      ) : null}

      {!isLoadingVariants && !loadError && variants.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No template wording is available right now.
        </p>
      ) : null}

      {!isLoadingVariants && !loadError && variants.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <p className="label-section mb-2">Wording</p>
              <div
                role="radiogroup"
                aria-label="Template wording"
                className="space-y-2"
              >
                {variants.map((variant) => {
                  const selected = selectedVariantId === variant.id;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={formDisabled}
                      onClick={() => setSelectedVariantId(variant.id)}
                      className={cn(
                        "w-full rounded-md border p-3 text-left transition-colors duration-150",
                        selected
                          ? "border-foreground bg-bg-hover"
                          : "border-border hover:bg-bg-hover",
                        formDisabled && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <p className="text-sm font-semibold text-foreground">
                        {variant.label}
                      </p>
                      <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">
                        {variant.body}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Header image
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Optional. Appears at the very top of the WhatsApp message,
                  above the text — JPEG or PNG, under 5 MB.
                </p>
              </div>
              <label
                className={cn(
                  "group relative flex aspect-[1.91/1] w-full cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/30 transition-colors hover:bg-muted",
                  formDisabled &&
                    "cursor-not-allowed opacity-60 hover:bg-muted/30",
                )}
              >
                {imagePreviewUrl ? (
                  <>
                    <img
                      src={imagePreviewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-foreground/70 px-2 py-1 text-center text-xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100">
                      Replace image
                    </span>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                    <ImageIcon className="h-6 w-6" aria-hidden="true" />
                    <span className="text-sm font-medium">
                      Upload an image
                    </span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  className="sr-only"
                  disabled={formDisabled}
                  onChange={(event) => {
                    handleImageSelect(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
              {imageError ? (
                <p className="text-xs font-medium text-destructive">
                  {imageError}
                </p>
              ) : null}
              {imageFile ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleImageRemove}
                  disabled={formDisabled}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Remove image
                </Button>
              ) : null}
            </div>
          </div>

          <div className="min-w-0">
            <p className="label-section mb-2">Preview</p>
            <WhatsappMessagePreview
              template={previewTemplate}
              senderName="Your name"
              cardName="Your card"
              note={SAMPLE_NOTE}
            />
          </div>
        </div>
      ) : null}

      <p className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        WhatsApp usually approves new templates within a few minutes. You'll
        be able to use it once it's approved.
      </p>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        ) : null}
        <Button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={
            formDisabled ||
            isLoadingVariants ||
            !!loadError ||
            !selectedVariantId
          }
        >
          {isSubmitting ? "Submitting…" : "Submit for approval"}
        </Button>
      </div>
    </div>
  );
}
