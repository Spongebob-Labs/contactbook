import { useRef, useState, type ChangeEvent } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { loadCardPhotoFile, softTint, surfaceAccent } from "@/lib/card-maker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CardPhotoUploadProps = {
  value: string;
  primary: string;
  initials: string;
  onChange: (photoDataUrl: string) => void;
};

export function CardPhotoUpload({
  value,
  primary,
  initials,
  onChange,
}: CardPhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const hasPhoto = Boolean(value.trim());

  const pickFile = () => {
    inputRef.current?.click();
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setIsLoading(true);
    try {
      const dataUrl = await loadCardPhotoFile(file);
      onChange(dataUrl);
      toast.success("Photo added to your card.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not use that image.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={pickFile}
        disabled={isLoading}
        className={cn(
          "relative flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          hasPhoto
            ? "border-transparent shadow-sm"
            : "border-border hover:border-primary/50",
        )}
        style={
          hasPhoto
            ? undefined
            : {
                backgroundColor: softTint(primary, 0.18),
                color: surfaceAccent(primary),
              }
        }
        aria-label={hasPhoto ? "Change profile photo" : "Upload profile photo"}
      >
        {hasPhoto ? (
          <img
            src={value}
            alt="Card profile"
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="flex flex-col items-center gap-0.5">
            <Camera className="h-4 w-4" aria-hidden="true" />
            <span className="text-[10px] font-semibold tracking-wide">
              {initials || "Add"}
            </span>
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Profile photo</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          JPG, PNG, or WebP · under 2.5 MB
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={pickFile}
            disabled={isLoading}
          >
            <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
            {isLoading ? "Processing…" : hasPhoto ? "Change photo" : "Upload photo"}
          </Button>
          {hasPhoto ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange("")}
              disabled={isLoading}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="sr-only"
        onChange={(event) => {
          void onFileChange(event);
        }}
      />
    </div>
  );
}
