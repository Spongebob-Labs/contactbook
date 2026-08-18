import { useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { fetchWalletPass } from "@/lib/wallet-api";
import { triggerDownload } from "@/lib/vcard-from-snapshot";
import { logUiError } from "@/lib/friendly-errors";
import { cn } from "@/lib/utils";

/**
 * "Add to Apple Wallet" action.
 *
 * NOTE: Apple publishes official badge artwork with brand rules covering size,
 * clear space and wording. This renders the correct wording in a house-styled
 * button as a stand-in — swap in the official asset before anything ships to
 * real users, alongside the certificate switch to the client's account.
 */
export function WalletBadge({
  cardId,
  disabled,
  className,
}: {
  cardId: string;
  disabled?: boolean;
  className?: string;
}) {
  const [isBuilding, setIsBuilding] = useState(false);

  const handleClick = async () => {
    setIsBuilding(true);
    try {
      const blob = await fetchWalletPass(cardId);
      // iOS hands the file straight to Wallet when it arrives with the pkpass
      // content type, which the server sets; the browser just needs to save it.
      triggerDownload(URL.createObjectURL(blob), `${cardId}.pkpass`, true);
    } catch (err) {
      logUiError("Could not build Wallet pass", err);
      toast.error(
        err instanceof ApiError && err.message
          ? err.message
          : "Could not build the Wallet pass.",
      );
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <button
      type="button"
      disabled={disabled || isBuilding}
      onClick={() => void handleClick()}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-black px-4 text-[14px] font-semibold text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {isBuilding ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Wallet className="h-4 w-4" aria-hidden="true" />
      )}
      {isBuilding ? "Building pass…" : "Add to Apple Wallet"}
    </button>
  );
}
