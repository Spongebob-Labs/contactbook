"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";

import { Button } from "@/components/primitives";
import { cards as cardsApi, profile as profileApi } from "@/lib/api/browser";
import { toCardFieldEntries } from "@/lib/api/map";
import { saveLocalCardDraft } from "@/lib/card-local-draft";
import { imageToDataUrl } from "@/lib/image-to-data-url";

/** ⚠ Development utility — see the route's own note. Delete with it. */

/** What the seeded card says about itself. Edit freely; nothing else reads these. */
const CARD_NAME = "Showcase";
const HEADLINE = "Founder and CEO";
const BIO = "Tech enthusiast, building big architectures and connecting the people behind them.";

/** Bundled images, so the seeder needs no upload dialog. Both ship in `/public`. */
const LOGO_SRC = "/portraits/arjun.png";
const COVER_SRC = "/portraits/priyanka.png";

async function fileFrom(src: string, name: string): Promise<File> {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`Could not read ${src}`);
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || "image/png" });
}

export function SeedDemoCard(): ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const say = (line: string): void => setLog((prev) => [...prev, line]);

  async function seed(): Promise<void> {
    setBusy(true);
    setError(null);
    setLog([]);
    try {
      /* 1 — every field the profile has. A card is a filter over the profile, so "maximum
            fields" means "all of them", and the API is the only place that knows what they are. */
      const fields = await profileApi.listFields();
      say(`Found ${fields.length} profile fields.`);

      /* 2 — the card, on Ivory, wearing a logo. The logo rides along on `POST /cards` because
            that is the only way it can be set at creation (see `cards.ts`). */
      const logo = await fileFrom(LOGO_SRC, "logo.png");
      const created = await cardsApi.create(
        { name: CARD_NAME, paletteId: "ivory", templateId: "meridian", finish: "gradient" },
        logo,
      );
      say(`Created "${CARD_NAME}" with a logo.`);

      /* 3 — tick all of them onto it. */
      await cardsApi.setFields(created.id, {
        fields: toCardFieldEntries(fields.map((field: { id: string }) => field.id)),
      });
      say(`Shared all ${fields.length} fields on the card.`);

      /* 4 — the three the API has no column for, into the local store. ⚠ This is the part that
            does not travel: it is this browser only, until the backend carries them. */
      const cover = await fileFrom(COVER_SRC, "cover.png");
      const { dataUrl, bytes } = await imageToDataUrl(cover);
      saveLocalCardDraft(created.id, { coverUrl: dataUrl, headline: HEADLINE, bio: BIO });
      say(`Set the cover (${Math.round(bytes / 1024)}KB), position and bio — this browser only.`);

      router.push(`/cards/${created.id}`);
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-ink">Seed a showcase card</h1>
        <p data-prose className="text-sm text-ink-3">
          Creates one card on the Ivory theme carrying <strong>every field in your profile</strong>
          , a logo, a cover image, a position and a bio — then opens it.
        </p>
        <p data-prose className="text-xs text-ink-3">
          It writes to your real account. The cover, position and bio are held in this browser
          only, because the API has no column for them yet.
        </p>
      </div>

      <Button onClick={() => void seed()} loading={busy} loadingLabel="Building…">
        Create the showcase card
      </Button>

      {log.length === 0 ? null : (
        <ul className="flex list-none flex-col gap-1 text-xs text-ink-2">
          {log.map((line) => (
            <li key={line}>· {line}</li>
          ))}
        </ul>
      )}

      {error === null ? null : (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
