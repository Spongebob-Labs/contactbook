import { Cloud, FileUp, UploadCloud } from "lucide-react";
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
    description: "Upload exported vCard files after file import support is available.",
    badge: "Coming soon",
    icon: FileUp,
    disabled: true,
  },
];

export function ContactImportOptions({
  onConnectGoogle,
  isConnectingGoogle,
  className,
  compact = false,
  featuredGoogle = false,
}: {
  onConnectGoogle: () => void;
  isConnectingGoogle: boolean;
  className?: string;
  compact?: boolean;
  featuredGoogle?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-4",
        featuredGoogle ? "lg:grid-cols-2" : "lg:grid-cols-3",
        className,
      )}
    >
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <div
            key={option.key}
            className={cn(
              "flex flex-col rounded-lg border border-border bg-card",
              compact ? "min-h-52 p-4" : "min-h-64 p-5",
              featuredGoogle && option.key === "google" && "lg:col-span-2 lg:min-h-44",
              option.disabled && "bg-muted/30",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={cn(
                  "flex items-center justify-center rounded-md bg-secondary text-primary",
                  compact ? "h-9 w-9" : "h-11 w-11",
                )}
              >
                <Icon className={cn(compact ? "h-4 w-4" : "h-5 w-5")} aria-hidden="true" />
              </div>
              <Badge variant={option.disabled ? "outline" : "success"}>
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
                className={cn("w-full", compact ? "mt-4" : "mt-5")}
                onClick={onConnectGoogle}
                disabled={isConnectingGoogle}
              >
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
                {isConnectingGoogle ? "Connecting" : "Connect Google"}
              </Button>
            ) : (
              <Button
                type="button"
                className={cn("w-full", compact ? "mt-4" : "mt-5")}
                variant="outline"
                disabled
              >
                {option.key === "vcf" ? "Upload unavailable" : "Connector unavailable"}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
