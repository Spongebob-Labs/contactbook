import { Suspense } from "react";

import type { Metadata } from "next";

import { BuilderClient, BuilderSkeleton } from "@/components/builder";
import { ScreenStateRoot } from "@/components/data";

/**
 * `/cards/new` — the card builder, opened on a brand-new card (spec §6.1 R-11, §8D.4, plan T23).
 *
 * ## Three Next 16 facts this file depends on
 * - **A static segment beats a dynamic sibling.** `/cards/new` wins over `/cards/[cardId]`, so
 *   this page — not the detail screen with `cardId === "new"` — is what the URL resolves to.
 *   Fixture ids are `card_`-prefixed so a real card can never be addressed as `new` either
 *   (§11 E-38, AC-05).
 * - **`useSearchParams()` requires a `<Suspense>` boundary above it** or `next build` fails on
 *   prerender. `useFixture` reads `?state=` through it, so every data route is a two-file pair:
 *   this server component, and a `'use client'` child (plan §0.5).
 * - **`PageProps` / `LayoutProps` are globally generated and are never imported.** This page
 *   takes no props at all.
 *
 * ## What a new card opens on
 *
 * The first template's **preset**, resolved against the owner's own profile — Meridian, so a
 * work number and a work email. That is the promise its gallery caption makes ("Starts with your
 * work number and work email"), and until `src/card/template-seed.ts` existed nothing kept it:
 * a template chose a default colour and a font weight, so "which card is this for" was answered
 * by nothing.
 *
 * §11 E-01 is therefore reached two ways rather than one, and both are real:
 *
 * · a profile with nothing to seed from (`?state=empty`) opens the builder at zero fields;
 * · unticking the seeded fields returns it to zero, live.
 *
 * The permanent demonstration of the empty card is `card_empty_demo` at
 * `/cards/card_empty_demo/edit`, which maps nothing by design and is the newest card in the
 * fixture set — the exact shape the old build shipped and ranked first.
 *
 * ## No card-font wrapper on this route
 *
 * There used to be one, opting in two card-only display faces, because `typeFamily` was a
 * per-template axis. It is not any more — the product is Geist throughout and a template's
 * typography is a weight and a tracking value on that one family. A wrapper here would declare
 * two font variables nothing reads.
 */

export const metadata: Metadata = {
  title: "New card",
  description: "Build a contact card from the fields in your profile.",
};

export default function NewCardPage() {
  return (
    <Suspense
      fallback={
        <ScreenStateRoot state="loading" className="flex flex-col gap-8 pb-16">
          <BuilderSkeleton />
        </ScreenStateRoot>
      }
    >
      <BuilderClient cardId={null} />
    </Suspense>
  );
}

/**
 * Fetch the profile a new card will filter.
 *
 * No card to load — `card={null}` is what tells the builder that Save creates rather than
 * updates. What is needed is the profile, because the template's preset is resolved against it:
 * that is what makes "starts with your work number and work email" true rather than aspirational,
 * and on an empty profile it honestly seeds nothing.
 */
