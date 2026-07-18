import { useRef, useState } from "react";
import { Cloud, FileUp, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SpotlightCard from "@/components/ui/SpotlightCard";
import { cn } from "@/lib/utils";

type ImportOption = {
  key: "google" | "vcf";
  title: string;
  description: string;
  badge: string;
  icon: typeof UploadCloud;
};

type ContactImportOptionsProps = {
  className?: string;
  compact?: boolean;
  featuredGoogle?: boolean;
  onUploadVcf?: (file: File) => void | Promise<void>;
  isUploadingVcf?: boolean;
} & (
  | {
      hideGoogle: true;
      onConnectGoogle?: () => void;
      isConnectingGoogle?: boolean;
    }
  | {
      hideGoogle?: false;
      onConnectGoogle: () => void;
      isConnectingGoogle: boolean;
    }
);

const options: ImportOption[] = [
  {
    key: "google",
    title: "Google Contacts",
    description: "Connect your Google account and sync contacts into ContactBook.",
    badge: "Available",
    icon: UploadCloud,
  },
  {
    key: "vcf",
    title: "Upload VCF file",
    description: "Upload exported vCard files from your device.",
    badge: "Available",
    icon: FileUp,
  },
];

export function ContactImportOptions({
  onConnectGoogle,
  isConnectingGoogle = false,
  onUploadVcf,
  isUploadingVcf = false,
  className,
  compact = false,
  featuredGoogle = false,
  hideGoogle = false,
}: ContactImportOptionsProps) {
  const vcfInputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingVcf, setIsDraggingVcf] = useState(false);
  const visibleOptions = hideGoogle
    ? options.filter((option) => option.key !== "google")
    : options;

  const handleVcfFileChange = (file: File | undefined) => {
    if (!file || !onUploadVcf) {
      return;
    }
    void onUploadVcf(file);
    if (vcfInputRef.current) {
      vcfInputRef.current.value = "";
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "grid gap-4",
          featuredGoogle && !hideGoogle
            ? "lg:grid-cols-2"
            : visibleOptions.length === 1
              ? "lg:grid-cols-1"
              : "lg:grid-cols-2",
        )}
      >
        {visibleOptions.map((option) => {
          const Icon = option.icon;
          const isVcfOption = option.key === "vcf";
          const isDisabled = isVcfOption && !onUploadVcf;
          const isGoogleFeatured = featuredGoogle && option.key === "google";

          return (
            <SpotlightCard
              key={option.key}
              className={cn(
                "rounded-[14px] border border-border bg-card transition-colors",
                compact ? "min-h-44" : "min-h-52",
                isGoogleFeatured && "lg:col-span-2",
                isDisabled && "opacity-60",
                isVcfOption &&
                  isDraggingVcf &&
                  "border-accent-border bg-accent-subtle/30",
              )}
              spotlightColor={
                isDisabled
                  ? "rgba(255,255,255,0.03)"
                  : "rgba(200,184,154,0.08)"
              }
            >
              <div
                className={cn(
                  "flex h-full min-h-[inherit] flex-col",
                  compact ? "p-4" : "p-5",
                )}
                onDragOver={
                  isVcfOption && onUploadVcf
                    ? (event) => {
                        event.preventDefault();
                        setIsDraggingVcf(true);
                      }
                    : undefined
                }
                onDragLeave={
                  isVcfOption
                    ? () => {
                        setIsDraggingVcf(false);
                      }
                    : undefined
                }
                onDrop={
                  isVcfOption && onUploadVcf
                    ? (event) => {
                        event.preventDefault();
                        setIsDraggingVcf(false);
                        handleVcfFileChange(event.dataTransfer.files?.[0]);
                      }
                    : undefined
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={cn(
                      "flex items-center justify-center rounded-full bg-accent-subtle text-primary",
                      compact ? "h-9 w-9" : "h-11 w-11",
                    )}
                  >
                    <Icon
                      className={cn(compact ? "h-4 w-4" : "h-5 w-5")}
                      aria-hidden="true"
                    />
                  </div>
                  <Badge
                    variant="secondary"
                    className="rounded-full border border-accent-border bg-accent-subtle text-primary"
                  >
                    {option.badge}
                  </Badge>
                </div>
                <div className={cn("flex-1", compact ? "mt-4" : "mt-5")}>
                  <h2
                    className={cn(
                      "font-semibold tracking-normal",
                      compact ? "text-base" : "text-lg",
                    )}
                  >
                    {option.title}
                  </h2>
                  <p className="mt-2 text-[13px] text-muted-foreground">
                    {option.description}
                  </p>
                  {isVcfOption && onUploadVcf && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {isDraggingVcf
                        ? "Drop file to upload"
                        : "Or drag and drop a .vcf file here"}
                    </p>
                  )}
                </div>
                {option.key === "google" ? (
                  <Button
                    type="button"
                    className={cn("w-full", compact ? "mt-4" : "mt-5")}
                    onClick={onConnectGoogle}
                    disabled={isConnectingGoogle}
                  >
                    <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
                    {isConnectingGoogle ? "Connecting" : "Connect Google"}
                  </Button>
                ) : (
                  <>
                    <input
                      ref={vcfInputRef}
                      type="file"
                      accept=".vcf,.vcard,text/vcard,text/x-vcard"
                      className="sr-only"
                      onChange={(event) =>
                        handleVcfFileChange(event.target.files?.[0])
                      }
                    />
                    <Button
                      type="button"
                      className={cn("w-full", compact ? "mt-4" : "mt-5")}
                      disabled={isUploadingVcf || !onUploadVcf}
                      onClick={() => vcfInputRef.current?.click()}
                    >
                      <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
                      {isUploadingVcf ? "Uploading" : "Upload"}
                    </Button>
                  </>
                )}
              </div>
            </SpotlightCard>
          );
        })}
      </div>

      <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Cloud className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        iCloud Contacts coming soon
      </p>
    </div>
  );
}
