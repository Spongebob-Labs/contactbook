"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, type ReactElement } from "react";
import { ArrowLeft } from "lucide-react";

import { CardPage, COVER_RATIO, type CardPageEditSlots } from "@/card/card-page";
import { heroBio, splitHeroFields } from "@/card/card-page-rows";
import { resolveCard } from "@/card/resolve-card";
import { TEMPLATE_PALETTES, type PaletteId } from "@/card/template-palettes";
import { AuthProgress } from "@/components/auth/auth-progress";
import { ImageCropDialog } from "@/components/builder/image-crop-dialog";
import { PreviewOption, PreviewOptionGroup } from "@/components/builder/preview-option";
import { SurfaceSwatch } from "@/components/builder/surface-swatch";
import { ErrorPanel } from "@/components/data";
import { useToast } from "@/components/overlay";
import { Button, Skeleton, buttonClassName } from "@/components/primitives";
import { cards as cardsApi } from "@/lib/api/browser";
import { fetchCardsData } from "@/lib/api/browser-loaders";
import { toScreenError } from "@/lib/api/errors";
import { toContactCard } from "@/lib/api/map";
import { cn } from "@/lib/cn";
import { dataUrlToFile, imageToDataUrl } from "@/lib/image-to-data-url";
import { useApiResource } from "@/lib/use-api";
import type { ContactCard, FieldGroup, ProfileField, User } from "@/types/domain";

import { CoverEditButton, InlineText } from "./card-edit-regions";
import {
  BIO_MAX,
  HEADLINE_MAX,
  WELCOME_PALETTES,
  WELCOME_STEPS,
  WELCOME_STEP_COUNT,
  pickStarterCard,
  textPatchValue,
  welcomeHref,
  welcomeStepFor,
  type WelcomeStep,
} from "./welcome-steps";

/**
 * `/welcome` — the first-run walkthrough. The owner finishes the card onboarding made for them,
 * by editing the card itself.
 *
 * ## Shape
 * The real `<CardPage>` at the centre — the component `/c/{token}` serves — with the current
 * step's regions turned into controls through its `edit` slots. Nothing is edited in a form
 * beside the card; the card is the form. Around it: a progress row, the step's one-line title,
 * and at most two buttons, pinned to the thumb on a phone and beside the card on a desktop.
 *
 * ## Writes, and what never goes in one
 * · The cover is uploaded the moment a crop is applied: `POST /cards/{id}/cover` with the BAKED
 *   crop (`dataUrlToFile` on the dialog's output). The API stores bytes as sent and crops
 *   nothing, so the raw file must never go up.
 * · Position and bio: `PATCH /cards/{id}` with that one key, on commit (Enter or blur).
 * · Colour: `PATCH /cards/{id}` `{paletteId, groundHex: null}` — `null` because a preset and a
 *   free colour are one axis, and a stale custom colour would otherwise keep painting over the
 *   swatch the owner just picked.
 * · ⚠ **`coverUrl` is never in a PATCH body**, and no body here names `phoneE164` — this screen
 *   writes to the card only.
 *
 * Every write is optimistic and rolls its own key back on failure, merging only the keys that
 * request owns, so a slow bio save cannot undo a colour chosen while it was in flight.
 */
export function WelcomeClient(): ReactElement {
  const result = useApiResource(fetchCardsData);

  if (result.state === "loading" || (result.data === null && result.error === null)) {
    return <WelcomeSkeleton />;
  }

  if (result.data === null) {
    return (
      <div className="px-4 py-16">
        <ErrorPanel
          error={result.error}
          headingLevel={1}
          onRetry={result.reload}
          homeHref="/dashboard"
          homeLabel="Go to dashboard"
        />
      </div>
    );
  }

  const { user, groups, fields } = result.data;
  const starter = pickStarterCard(result.data.cards);

  if (starter === null) return <NoCard />;

  return (
    <Walkthrough
      /* A different card is a different walkthrough — nothing optimistic may carry across. */
      key={starter.id}
      initialCard={starter}
      user={user}
      groups={groups}
      fields={fields}
    />
  );
}

/* ── the walkthrough ───────────────────────────────────────────────────────── */

type TextRegion = "headline" | "bio";

/** The three types the cover endpoint accepts. Offering HEIC would teach a habit the API rejects. */
const COVER_ACCEPT = "image/jpeg,image/png,image/webp";

/** Long edge of the baked cover, px — the same bound the builder's cover picker uses. */
const COVER_MAX_EDGE = 1280;

function Walkthrough({
  initialCard,
  user,
  groups,
  fields,
}: {
  initialCard: ContactCard;
  user: User;
  groups: readonly FieldGroup[];
  fields: readonly ProfileField[];
}): ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const step = welcomeStepFor(searchParams.get("step"));

  const [card, setCard] = useState(initialCard);
  const [editing, setEditing] = useState<TextRegion | null>(null);
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());
  const [reading, setReading] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  /* The image being composed — held between "file chosen" and "crop applied", never saved. */
  const [cropping, setCropping] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /* Last palette request wins: rapid taps across the row must not land out of order. */
  const paletteTicket = useRef(0);

  const resolved = useMemo(
    () => resolveCard(card, user, groups, fields),
    [card, user, groups, fields],
  );

  /* What each text line shows right now, computed the way `<CardPage>` computes it — the card's
     own value, else the derivation it falls back to — so the editor opens on the text the owner
     was looking at. */
  const shownHeadline = resolved.headline ?? "";
  const shownBio =
    heroBio(resolved.bio, resolved.headline, splitHeroFields(resolved.fields, resolved.bio).org) ??
    "";

  const hasPhoto = resolved.cover.kind === "photo";
  const busy = saving.size > 0 || coverBusy || reading;

  function track(key: string, on: boolean) {
    setSaving((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function fail(thrown: unknown) {
    const shown = toScreenError(thrown);
    toast({ title: shown.title, description: shown.detail, tone: "danger" });
  }

  /* ── navigation ─────────────────────────────────────────────────────────── */

  function goTo(next: WelcomeStep) {
    setEditing(null);
    router.push(welcomeHref(next));
  }

  /* The walkthrough ends at the dashboard (client, 2026-10-11) — the same place "Skip setup"
     goes. It used to open this card's own page, which read as the flow not having ended. */
  function finish() {
    router.push("/dashboard");
  }

  /* ── the cover ──────────────────────────────────────────────────────────── */

  function openPicker() {
    fileRef.current?.click();
  }

  function onFileChosen(file: File | undefined) {
    if (file === undefined) return;
    setReading(true);
    /* Downscale first so the dialog composes against a bounded bitmap, then crop. */
    void imageToDataUrl(file)
      .then((decoded) => setCropping(decoded.dataUrl))
      .catch(() =>
        toast({
          title: "That image could not be read",
          description: "Try a JPEG, PNG or WebP.",
          tone: "danger",
        }),
      )
      .finally(() => setReading(false));
  }

  function applyCover(dataUrl: string) {
    const previous = card.coverUrl ?? null;
    /* The card wears the crop while it uploads, from the same bytes that are being sent. */
    setCard((c) => ({ ...c, coverUrl: dataUrl }));
    setCoverBusy(true);
    void (async () => {
      try {
        const dto = await cardsApi.uploadCover(card.id, dataUrlToFile(dataUrl, "cover.jpg"));
        setCard((c) => ({ ...c, coverUrl: dto.coverUrl ?? null }));
      } catch (thrown) {
        fail(thrown);
        /* Back to what the server still has — the card must not claim a photo it lacks. */
        setCard((c) => ({ ...c, coverUrl: previous }));
      } finally {
        setCoverBusy(false);
      }
    })();
  }

  /* ── position and bio ───────────────────────────────────────────────────── */

  function commitText(region: TextRegion, raw: string) {
    setEditing(null);
    const own = region === "headline" ? card.headline : card.bio;
    const shown = region === "headline" ? shownHeadline : shownBio;
    const value = textPatchValue(raw, shown, own);
    if (value === undefined) return;

    const previous = own ?? null;
    setCard((c) => ({ ...c, [region]: value }));
    track(region, true);
    void (async () => {
      try {
        const dto = await cardsApi.update(
          card.id,
          region === "headline" ? { headline: value } : { bio: value },
        );
        const saved = toContactCard(dto, user.id);
        setCard((c) => ({ ...c, [region]: saved[region] ?? null }));
      } catch (thrown) {
        fail(thrown);
        setCard((c) => ({ ...c, [region]: previous }));
      } finally {
        track(region, false);
      }
    })();
  }

  /* ── colour ─────────────────────────────────────────────────────────────── */

  function pickPalette(paletteId: PaletteId) {
    const previous = { paletteId: card.paletteId, groundHex: card.groundHex };
    const ticket = ++paletteTicket.current;
    setCard((c) => ({ ...c, paletteId, groundHex: undefined }));
    track("palette", true);
    void (async () => {
      try {
        const dto = await cardsApi.update(card.id, { paletteId, groundHex: null });
        if (ticket !== paletteTicket.current) return;
        const saved = toContactCard(dto, user.id);
        setCard((c) => ({ ...c, paletteId: saved.paletteId, groundHex: saved.groundHex }));
      } catch (thrown) {
        if (ticket !== paletteTicket.current) return;
        fail(thrown);
        setCard((c) => ({ ...c, ...previous }));
      } finally {
        track("palette", false);
      }
    })();
  }

  /* ── what this step turns into controls ─────────────────────────────────── */

  const edit: CardPageEditSlots = {};
  if (step.id === "photo") {
    edit.cover = (
      <CoverEditButton hasPhoto={hasPhoto} busy={coverBusy || reading} onPick={openPicker} />
    );
  }
  if (step.id === "about") {
    edit.headline = (
      <InlineText
        region="headline"
        label="Role"
        hint="Add your role"
        placeholder="Your role or title"
        value={shownHeadline}
        maxLength={HEADLINE_MAX}
        editing={editing === "headline"}
        busy={saving.has("headline")}
        onEdit={() => setEditing("headline")}
        onCommit={(raw) => commitText("headline", raw)}
        onCancel={() => setEditing(null)}
      />
    );
    edit.bio = (
      <InlineText
        region="bio"
        label="Bio"
        hint="Add a short bio"
        placeholder="A line about you"
        value={shownBio}
        maxLength={BIO_MAX}
        multiline
        editing={editing === "bio"}
        busy={saving.has("bio")}
        onEdit={() => setEditing("bio")}
        onCommit={(raw) => commitText("bio", raw)}
        onCancel={() => setEditing(null)}
      />
    );
  }

  /* ── the step's buttons ─────────────────────────────────────────────────── */

  const nextStep = WELCOME_STEPS[step.index] as WelcomeStep | undefined;
  const previousStep = step.index > 1 ? WELCOME_STEPS[step.index - 2] : undefined;
  const advance = () => (nextStep === undefined ? finish() : goTo(nextStep));

  /* Until the step's own thing is done, the primary DOES it and "Skip" moves on; once it is
     done the primary is "Next". A step never shows two buttons that do the same thing. */
  const stepDone =
    step.id === "photo"
      ? hasPhoto
      : step.id === "about"
        ? (card.headline ?? "").trim() !== "" || (card.bio ?? "").trim() !== ""
        : true;

  const primary =
    editing !== null ? (
      /* An open field saves on blur, so this only has to move focus off it. ⚠ The press must
         NOT blur the field itself: that would save, re-render this slot as "Next", and let the
         click land on Next — one tap, two steps. So the focus move waits for the click. */
      <Button
        size="lg"
        data-welcome-primary="save"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => (document.activeElement as HTMLElement | null)?.blur()}
        className="flex-1 lg:flex-none lg:min-w-40"
      >
        Save
      </Button>
    ) : step.id === "colour" ? (
      <Button
        size="lg"
        data-welcome-primary="done"
        loading={busy}
        loadingLabel="Saving…"
        onClick={finish}
        className="flex-1 lg:flex-none lg:min-w-40"
      >
        Done
      </Button>
    ) : stepDone ? (
      <Button
        size="lg"
        data-welcome-primary="next"
        onClick={advance}
        className="flex-1 lg:flex-none lg:min-w-40"
      >
        Next
      </Button>
    ) : step.id === "photo" ? (
      <Button
        size="lg"
        data-welcome-primary="photo"
        loading={coverBusy || reading}
        loadingLabel={reading ? "Reading…" : "Uploading…"}
        onClick={openPicker}
        className="flex-1 lg:flex-none lg:min-w-40"
      >
        Choose photo
      </Button>
    ) : (
      <Button
        size="lg"
        data-welcome-primary="bio"
        onClick={() => setEditing("bio")}
        className="flex-1 lg:flex-none lg:min-w-40"
      >
        Add a bio
      </Button>
    );

  const selectedPalette = card.groundHex === undefined ? resolved.palette.id : "";

  return (
    <div
      data-welcome=""
      data-welcome-step={step.id}
      className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col"
    >
      <header className="flex h-14 shrink-0 items-center justify-between px-4 lg:h-16 lg:px-8">
        {/* The slot holds its width on step 1 so "Skip setup" does not jump when Back appears. */}
        <div className="min-w-16">
          {previousStep === undefined ? null : (
            <Link
              href={welcomeHref(previousStep)}
              data-welcome-back=""
              onClick={() => setEditing(null)}
              className={buttonClassName({
                variant: "text-link",
                className: "min-h-11 gap-1 no-underline hover:underline",
              })}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back
            </Link>
          )}
        </div>
        <Link
          href="/dashboard"
          data-welcome-skip-all=""
          className={buttonClassName({
            variant: "text-link",
            className: "min-h-11 text-ink-3 no-underline hover:underline",
          })}
        >
          Skip setup
        </Link>
      </header>

      <WelcomeStyles />

      <div className="flex flex-1 flex-col px-4 pb-4 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:px-8 lg:pb-16 xl:grid-cols-[minmax(0,1fr)_420px_minmax(0,1fr)]">
        {/* ── progress and title ── */}
        <div
          key={step.id}
          data-welcome-head=""
          className="flex flex-col gap-4 pt-2 pb-5 lg:col-start-1 lg:row-start-1 lg:w-full lg:max-w-[320px] lg:justify-self-end lg:pt-16 lg:pb-8"
        >
          <AuthProgress step={step.index} total={WELCOME_STEP_COUNT} />
          <h1 className="text-h2 text-ink">{step.title}</h1>
        </div>

        {/* ── the card ── */}
        <div className="flex justify-center lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-6">
          <div className="w-full max-w-[420px]">
            <CardPage
              resolved={resolved}
              edit={edit}
              className="rounded-[28px] border border-line"
            />
          </div>
        </div>

        {/* ── the step's controls ──
            After the card in the DOM, so a keyboard reaches the card's own controls first — the
            card is where the editing happens. Pinned to the bottom of a phone screen, where a
            thumb is; in the left column on a desktop. */}
        <div
          data-welcome-controls=""
          className={cn(
            "sticky bottom-0 z-10 -mx-4 mt-6 flex flex-col gap-4 border-t border-line bg-canvas px-4 pt-4",
            "pb-[max(1rem,env(safe-area-inset-bottom))]",
            "lg:static lg:col-start-1 lg:row-start-2 lg:mx-0 lg:mt-0 lg:w-full lg:max-w-[320px] lg:justify-self-end lg:self-start lg:border-t-0 lg:bg-transparent lg:p-0",
          )}
        >
          {step.id === "colour" ? (
            <PreviewOptionGroup
              label="Card colour"
              value={selectedPalette}
              onValueChange={(value) => pickPalette(value as PaletteId)}
              orientation="horizontal"
              className="flex flex-wrap justify-between gap-3 lg:justify-start lg:gap-2"
            >
              {WELCOME_PALETTES.map((id) => (
                <PreviewOption
                  key={id}
                  value={id}
                  data-welcome-palette={id}
                  name={TEMPLATE_PALETTES[id].name}
                  hideName
                  compact
                  selected={id === selectedPalette}
                  className="w-11"
                >
                  <SurfaceSwatch
                    palette={TEMPLATE_PALETTES[id]}
                    finish={resolved.surface.finish}
                    texture="none"
                    className="aspect-square h-auto w-full rounded-[7px]"
                  />
                </PreviewOption>
              ))}
            </PreviewOptionGroup>
          ) : null}

          <div className="flex items-center gap-3">
            {stepDone || step.id === "colour" || editing !== null ? null : (
              <Button
                variant="secondary"
                size="lg"
                data-welcome-skip=""
                onClick={advance}
                className="lg:order-2"
              >
                Skip
              </Button>
            )}
            {primary}
          </div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={COVER_ACCEPT}
        data-welcome-cover-input=""
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          /* Reset first: picking the same file twice must fire `change` both times. */
          event.target.value = "";
          onFileChosen(file);
        }}
      />

      <ImageCropDialog
        open={cropping !== null}
        onOpenChange={(open) => {
          if (!open) setCropping(null);
        }}
        src={cropping}
        aspect={1 / COVER_RATIO.photo}
        maxEdge={COVER_MAX_EDGE}
        title="Position your photo"
        onApply={(dataUrl) => {
          setCropping(null);
          applyCover(dataUrl);
        }}
      />
    </div>
  );
}

/* ── the step's entrance ───────────────────────────────────────────────────── */

/**
 * The title arrives the way an auth step does: a 16px slide and a fade, `--dur-slow`. Only
 * `opacity` and `transform`; `backwards` so the resting state is the default and a zeroed
 * duration (reduced motion, the e2e harness) leaves it fully painted.
 */
const WELCOME_CSS = `
@keyframes cb-welcome-step-enter {
  from { opacity: 0; transform: translateX(16px); }
}
[data-welcome-head] {
  animation: cb-welcome-step-enter var(--dur-slow) var(--ease-out) backwards;
}
`;

function WelcomeStyles(): ReactElement {
  return (
    <style href="contactbook-welcome-step" precedence="default">
      {WELCOME_CSS}
    </style>
  );
}

/* ── the other states ──────────────────────────────────────────────────────── */

/** The walkthrough's own shape, held open while the card loads, so nothing jumps on arrival. */
function WelcomeSkeleton(): ReactElement {
  return (
    <div
      data-welcome-skeleton=""
      aria-busy="true"
      aria-label="Loading your card"
      className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col px-4 pt-16 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-x-16 lg:px-8 lg:pt-20 xl:grid-cols-[minmax(0,1fr)_420px_minmax(0,1fr)]"
    >
      <div className="flex flex-col gap-4 pb-5 lg:w-full lg:max-w-[320px] lg:justify-self-end lg:pt-16">
        <Skeleton variant="text" className="w-24" />
        <Skeleton className="h-9 w-3/4 rounded-sm" />
      </div>
      <div className="flex justify-center lg:pt-6">
        <Skeleton className="aspect-[3/4] w-full max-w-[420px] rounded-[28px]" />
      </div>
    </div>
  );
}

/**
 * Onboarding always makes a card, so this is reached only if that card was deleted. The way
 * forward is the builder, not an apology.
 */
function NoCard(): ReactElement {
  return (
    <div
      data-welcome-empty=""
      className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center gap-6 px-4 py-16"
    >
      <h1 className="text-h2 text-ink">Make your first card</h1>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/cards/new" className={buttonClassName({ size: "lg" })}>
          New card
        </Link>
        <Link href="/dashboard" className={buttonClassName({ variant: "text-link" })}>
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
