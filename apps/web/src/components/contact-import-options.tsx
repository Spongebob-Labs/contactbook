import { useRef } from "react";
import { Cloud, FileUp, Lock, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ImportOption = {
  key: "google" | "icloud" | "vcf";
  title: string;
  description: string;
  badge: string;
  icon: typeof UploadCloud;
  disabled?: boolean;
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
    key: "icloud",
    title: "iCloud Contacts",
    description: "Import contacts from iCloud once the secure connector is ready.",
    badge: "Coming soon",
    icon: Cloud,
    disabled: true,
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
    <div
      className={cn(
        "grid gap-4",
        featuredGoogle && !hideGoogle ? "lg:grid-cols-2" : "lg:grid-cols-3",
        className,
      )}
    >
      {visibleOptions.map((option) => {
        const Icon = option.icon;
        const isVcfOption = option.key === "vcf";
        const isDisabled = option.disabled || (isVcfOption && !onUploadVcf);
        return (
          <div
            key={option.key}
            className={cn(
              "flex flex-col rounded-[28px] border border-border bg-card shadow-[0_12px_32px_rgba(20,52,48,0.05)]",
              compact ? "min-h-52 p-4" : "min-h-64 p-5",
              featuredGoogle && option.key === "google" && "lg:col-span-2 lg:min-h-44",
              isDisabled && "bg-muted/30",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={cn(
                  "flex items-center justify-center rounded-full bg-secondary text-primary",
                  compact ? "h-9 w-9" : "h-11 w-11",
                )}
              >
                <Icon className={cn(compact ? "h-4 w-4" : "h-5 w-5")} aria-hidden="true" />
              </div>
              <Badge variant={isDisabled ? "outline" : "success"} className="rounded-full">
                {option.badge}
              </Badge>
            </div>
            <div className={cn("flex-1", compact ? "mt-4" : "mt-5")}>
              <h2 className={cn("font-semibold tracking-normal", compact ? "text-base" : "text-lg")}>
                {option.title}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{option.description}</p>
            </div>
            {option.key === "google" ? (
              <Button
                type="button"
                className={cn("w-full rounded-full", compact ? "mt-4" : "mt-5")}
                onClick={onConnectGoogle}
                disabled={isConnectingGoogle}
              >
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
                {isConnectingGoogle ? "Connecting" : "Connect Google"}
              </Button>
            ) : isVcfOption ? (
              <>
                <input
                  ref={vcfInputRef}
                  type="file"
                  accept=".vcf,.vcard,text/vcard,text/x-vcard"
                  className="sr-only"
                  onChange={(event) => handleVcfFileChange(event.target.files?.[0])}
                />
                <Button
                  type="button"
                  className={cn("w-full rounded-full", compact ? "mt-4" : "mt-5")}
                  disabled={isUploadingVcf || !onUploadVcf}
                  onClick={() => vcfInputRef.current?.click()}
                >
                  <FileUp className="h-4 w-4" aria-hidden="true" />
                  {isUploadingVcf ? "Uploading" : "Upload"}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                className={cn("w-full rounded-full", compact ? "mt-4" : "mt-5")}
                variant="outline"
                disabled
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
                Connect now
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
