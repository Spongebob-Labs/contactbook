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
}: {
  onConnectGoogle: () => void;
  isConnectingGoogle: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 lg:grid-cols-3", className)}>
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <div
            key={option.key}
            className={cn(
              "flex min-h-64 flex-col rounded-lg border border-border bg-card p-5",
              option.disabled && "bg-muted/30",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-secondary text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <Badge variant={option.disabled ? "outline" : "success"}>
                {option.badge}
              </Badge>
            </div>
            <div className="mt-5 flex-1">
              <h2 className="text-lg font-semibold tracking-normal">{option.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{option.description}</p>
            </div>
            {option.key === "google" ? (
              <Button
                type="button"
                className="mt-5 w-full"
                onClick={onConnectGoogle}
                disabled={isConnectingGoogle}
              >
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
                {isConnectingGoogle ? "Connecting" : "Connect Google"}
              </Button>
            ) : (
              <Button type="button" className="mt-5 w-full" variant="outline" disabled>
                {option.key === "vcf" ? "Upload unavailable" : "Connector unavailable"}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
