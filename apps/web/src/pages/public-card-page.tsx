import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { CardQr, qrPngDataUrl } from "@/components/cards/card-qr";
import { CardRenderer } from "@/components/cards/card-renderer";
import {
  ShareSheet,
  type ShareSheetOptionId,
} from "@/components/ui/share-sheet";
import { ApiError } from "@/lib/api";
import { parseCardSnapshot, type CardSnapshot } from "@/lib/card-schema";
import { backgroundBaseColor } from "@/lib/card-themes";
import { fetchPublicCard } from "@/lib/cards-api";
import { logUiError } from "@/lib/friendly-errors";
import {
  downloadVcard,
  triggerDownload,
} from "@/lib/vcard-from-snapshot";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; snapshot: CardSnapshot }
  | { status: "unavailable" }
  | { status: "error"; message: string };

/**
 * The public card at `/c/:slug` — what a stranger sees after scanning a QR or
 * opening a shared link. Unauthenticated, mobile-first, and rendered by the
 * same `CardRenderer` the builder previews with.
 *
 * Every failure resolves to a calm, self-explanatory page. Someone who just
 * pointed their camera at a business card has no idea what a 404 is, and no way
 * to fix one.
 */
export default function PublicCardPage() {
  const { slug } = useParams();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [shareOpen, setShareOpen] = useState(false);

  const shareUrl = useMemo(
    () => (slug ? `${window.location.origin}/c/${slug}` : ""),
    [slug],
  );

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!slug) {
        setState({ status: "unavailable" });
        return;
      }

      try {
        const response = await fetchPublicCard(slug);
        if (!isMounted) {
          return;
        }

        const parsed = parseCardSnapshot(response.snapshot);
        if (!parsed.ok) {
          setState({ status: "error", message: parsed.message });
          return;
        }
        setState({ status: "ready", snapshot: parsed.snapshot });
      } catch (err) {
        if (!isMounted) {
          return;
        }
        // The API returns the same 404 for an unknown slug and an unpublished
        // one, deliberately — so this page cannot be used to probe which slugs
        // belong to somebody.
        if (err instanceof ApiError && err.status === 404) {
          setState({ status: "unavailable" });
          return;
        }
        logUiError("Could not load public card", err);
        setState({
          status: "error",
          message: "This card could not be loaded right now.",
        });
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, [slug]);

  // Closest thing to a link preview without server rendering: at least the tab
  // and any bookmark carry the person's name.
  useEffect(() => {
    if (state.status === "ready") {
      document.title = `${state.snapshot.identity.displayName} | ContactBook`;
    }
    return () => {
      document.title = "ContactBook";
    };
  }, [state]);

  /**
   * Android's answer to a Wallet pass: point at the per-card manifest so "Add
   * to Home screen" installs *this card* standalone rather than a bookmark to
   * the app root. Served from a real same-origin URL because Chrome does not
   * reliably honour blob-URL manifests.
   */
  useEffect(() => {
    if (state.status !== "ready" || !slug) {
      return;
    }

    const manifest = document.createElement("link");
    manifest.rel = "manifest";
    manifest.href = `/c/${slug}/manifest.webmanifest`;

    const themeColor = document.createElement("meta");
    themeColor.name = "theme-color";
    themeColor.content = backgroundBaseColor(state.snapshot.theme.background);

    document.head.append(manifest, themeColor);
    return () => {
      manifest.remove();
      themeColor.remove();
    };
  }, [slug, state]);

  const handleShareOption = async (option: ShareSheetOptionId) => {
    if (state.status !== "ready") {
      return;
    }
    setShareOpen(false);

    try {
      if (option === "copy-link") {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied.");
        return;
      }
      if (option === "native-share") {
        await navigator.share({
          title: state.snapshot.identity.displayName,
          url: shareUrl,
        });
        return;
      }
      if (option === "save-contact") {
        downloadVcard(state.snapshot, shareUrl);
        return;
      }
      if (option === "download-qr") {
        triggerDownload(await qrPngDataUrl(shareUrl), `${slug}-qr.png`);
      }
    } catch (err) {
      // A cancelled native share rejects with AbortError; that is the user
      // changing their mind, not a failure worth shouting about.
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      logUiError("Public card share action failed", err);
      toast.error("That didn't work. Try another option.");
    }
  };

  if (state.status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B1220]">
        <span className="sr-only">Loading card</span>
        <span
          className="h-8 w-8 animate-spin rounded-full border-2 border-white/25 border-t-white/80"
          aria-hidden="true"
        />
      </main>
    );
  }

  if (state.status !== "ready") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B1220] px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-[20px] font-semibold text-white">
            {state.status === "unavailable"
              ? "This card isn't available"
              : "Something went wrong"}
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-white/60">
            {state.status === "unavailable"
              ? "The link may have changed, or the owner has taken this card offline."
              : state.message}
          </p>
        </div>
      </main>
    );
  }

  const shareOptions: ShareSheetOptionId[] = [
    "copy-link",
    ...(typeof navigator !== "undefined" && "share" in navigator
      ? (["native-share"] as const)
      : []),
    "save-contact",
    "download-qr",
  ];

  return (
    <main className="relative min-h-screen">
      <CardRenderer
        snapshot={state.snapshot}
        interactive
        qr={<CardQr url={shareUrl} size={132} />}
        onSaveContact={() => downloadVcard(state.snapshot, shareUrl)}
      />

      <button
        type="button"
        onClick={() => setShareOpen(true)}
        aria-label="Share this card"
        className="fixed right-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition-colors duration-150 hover:bg-black/50"
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
      </button>

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onSelect={(id) => void handleShareOption(id)}
        options={shareOptions}
        title={state.snapshot.identity.displayName}
      />
    </main>
  );
}
