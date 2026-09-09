"use client";

import { useCallback, useState, type ReactNode } from "react";

import { FlipCard } from "./flip-card";
import { LiveCard } from "./live-card";

/**
 * The hero's card, assembled: a server-rendered `<ShareFace>` on the front and the animated
 * `<LiveCard>` on the back.
 *
 * ## Why this thin component exists at all
 * `<ShareFace>` must be resolved on the SERVER — `resolveCard` reads the fixture database and
 * `<QrZone>` computes the symbol at render time, so a client component cannot build it without
 * shipping both to the browser. `<FlipCard>` must be a CLIENT component, because it owns a
 * timer, an observer and a press.
 *
 * So the face is passed down as an element (`hero.tsx` resolves it and hands it over) and this
 * file is the one place allowed to know that the back's animation should run only while the
 * back is showing. Putting that `useState` in `hero.tsx` would make the whole hero a client
 * component and ship the headline's markup twice.
 */
export function HeroCard({
  face,
  frontLabel,
  backLabel,
  caption,
}: {
  /** The real `<ShareFace>`, resolved by the server component that renders this. */
  face: ReactNode;
  frontLabel: string;
  backLabel: string;
  caption: string;
}) {
  const [showingBack, setShowingBack] = useState(false);

  /* Stable, so `<FlipCard>`'s effect does not re-run on every render of this one. */
  const onFaceChange = useCallback((next: "front" | "back") => {
    setShowingBack(next === "back");
  }, []);

  return (
    <FlipCard
      front={face}
      back={<LiveCard active={showingBack} />}
      frontLabel={frontLabel}
      backLabel={backLabel}
      caption={caption}
      onFaceChange={onFaceChange}
    />
  );
}
