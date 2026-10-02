"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";

import { Button } from "@/components/primitives";
import { cards as cardsApi, profile as profileApi } from "@/lib/api/browser";
import { dataUrlToFile, imageToDataUrl } from "@/lib/image-to-data-url";

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

      /* 2 — the card, on Ivory, wearing a logo and all the fields at once. Both the logo and
            `fieldIds` ride `POST /cards`: the logo because a create is the only door for it, and
            the fields because the create attaches them atomically rather than as a second call
            that could half-fail. */
      const logo = await fileFrom(LOGO_SRC, "logo.png");
      const created = await cardsApi.create(
        {
          name: CARD_NAME,
          paletteId: "ivory",
          templateId: "meridian",
          finish: "gradient",
          /* Real columns, so they ride the create. Only the cover cannot — see step 4. */
          headline: HEADLINE,
          bio: BIO,
          fieldIds: fields.map((field: { id: string }) => field.id),
        },
        logo,
      );
      say(`Created "${CARD_NAME}" with a logo, position, bio and ${fields.length} fields.`);

      /* 3 — the cover, which is always its own call: `POST /cards` carries no cover part and
            `PATCH` rejects a URL string, so the upload is the only door and it needs the id.

            Downscaled first, exactly as the builder's picker does, so the seeded card carries
            bytes the same shape a real owner's would — the API stores what it is sent and
            resizes nothing, so seeding a full-resolution portrait here would put a card in the
            fixture set that no real flow can produce. */
      const source = await fileFrom(COVER_SRC, "cover.png");
      const { dataUrl, bytes } = await imageToDataUrl(source);
      await cardsApi.uploadCover(created.id, dataUrlToFile(dataUrl, "cover.jpg"));
      say(`Uploaded the cover (${Math.round(bytes / 1024)}KB).`);

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
