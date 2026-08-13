import { useRef, useState } from "react";
import { FileUp, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

type ContactImportOptionsProps = {
  className?: string;
  /** @deprecated Row layout ignores card density flags. */
  compact?: boolean;
  /** @deprecated Row layout ignores featured grid flags. */
  featuredGoogle?: boolean;
  hideGoogle?: boolean;
  onConnectGoogle?: () => void;
  isConnectingGoogle?: boolean;
  onSyncGoogle?: () => void;
  isSyncingGoogle?: boolean;
  onFullImportGoogle?: () => void;
  isFullImportingGoogle?: boolean;
  onDisconnectGoogle?: () => void;
  isDisconnectingGoogle?: boolean;
  googleConnected?: boolean;
  googleMeta?: string;
  onUploadVcf?: (file: File) => void | Promise<void>;
  isUploadingVcf?: boolean;
  vcfMeta?: string;
};

export function ContactImportOptions({
  onConnectGoogle,
  isConnectingGoogle = false,
  onSyncGoogle,
  isSyncingGoogle = false,
  onFullImportGoogle,
  isFullImportingGoogle = false,
  onDisconnectGoogle,
  isDisconnectingGoogle = false,
  googleConnected = false,
  googleMeta,
  onUploadVcf,
  isUploadingVcf = false,
  vcfMeta,
  className,
  hideGoogle = false,
}: ContactImportOptionsProps) {
  const vcfInputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingVcf, setIsDraggingVcf] = useState(false);

  const handleVcfFileChange = (file: File | undefined) => {
    if (!file || !onUploadVcf) {
      return;
    }
    void onUploadVcf(file);
    if (vcfInputRef.current) {
      vcfInputRef.current.value = "";
    }
  };

  const googleBusy =
    isConnectingGoogle ||
    isSyncingGoogle ||
    isFullImportingGoogle ||
    isDisconnectingGoogle;

  return (
    <Panel className={cn("overflow-hidden p-0", className)}>
      {!hideGoogle ? (
        <>
          <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground">
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">
                  Google Contacts
                </p>
                {googleConnected ? (
                  <StatusBadge variant="connected">Connected</StatusBadge>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {googleMeta ??
                  (googleConnected
                    ? "Sync or fully re-import contacts from Google"
                    : "Connect your Google account to sync contacts")}
              </p>
            </div>
            {googleConnected ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 rounded-full"
                  onClick={onSyncGoogle}
                  disabled={googleBusy || !onSyncGoogle}
                >
                  {isSyncingGoogle ? "Syncing…" : "Sync"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 rounded-full"
                  onClick={onFullImportGoogle}
                  disabled={googleBusy || !onFullImportGoogle}
                >
                  {isFullImportingGoogle ? "Importing…" : "Full import"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 rounded-full text-destructive"
                  onClick={onDisconnectGoogle}
                  disabled={googleBusy || !onDisconnectGoogle}
                >
                  {isDisconnectingGoogle ? "Disconnecting…" : "Disconnect"}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 rounded-full"
                onClick={onConnectGoogle}
                disabled={googleBusy || !onConnectGoogle}
              >
                {isConnectingGoogle ? "Connecting…" : "Connect"}
              </Button>
            )}
          </div>
          <div className="border-t border-border" role="separator" />
        </>
      ) : null}

      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3.5 sm:px-5",
          isDraggingVcf && "bg-bg-hover",
        )}
        onDragOver={
          onUploadVcf
            ? (event) => {
                event.preventDefault();
                setIsDraggingVcf(true);
              }
            : undefined
        }
        onDragLeave={
          onUploadVcf
            ? () => {
                setIsDraggingVcf(false);
              }
            : undefined
        }
        onDrop={
          onUploadVcf
            ? (event) => {
                event.preventDefault();
                setIsDraggingVcf(false);
                handleVcfFileChange(event.dataTransfer.files?.[0]);
              }
            : undefined
        }
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground">
          <FileUp className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">Upload VCF</p>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isDraggingVcf
              ? "Drop file to upload"
              : (vcfMeta ?? "Upload a .vcf or .vcard file from your device")}
          </p>
        </div>
        <input
          ref={vcfInputRef}
          type="file"
          accept=".vcf,.vcard,text/vcard,text/x-vcard"
          className="sr-only"
          onChange={(event) => handleVcfFileChange(event.target.files?.[0])}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 rounded-full"
          disabled={isUploadingVcf || !onUploadVcf}
          onClick={() => vcfInputRef.current?.click()}
        >
          {isUploadingVcf ? "Uploading…" : "Upload file"}
        </Button>
      </div>
    </Panel>
  );
}
