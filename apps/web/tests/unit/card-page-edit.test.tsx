import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { COVER_RATIO, CardPage } from "@/card/card-page";
import { resolveCard } from "@/card/resolve-card";
import { cardEmptyDemo, fixtureCards } from "@/fixtures/cards";
import { fixtureFields, fixtureGroups } from "@/fixtures/profile";
import { fixtureUser } from "@/fixtures/user";
import type { ContactCard } from "@/types/domain";

import { render } from "../helpers/render";

/**
 * `<CardPage edit>` — the slots `/welcome` draws its controls into.
 *
 * ## What this protects
 * `card-page.tsx` renders the public card, the builder's preview, the marketing cards and the
 * card detail page. The `edit` prop exists for one caller, so the first group below proves the
 * prop is inert everywhere else: with it absent, or present but empty, every fixture card
 * renders the same markup, byte for byte. The second group proves each slot replaces exactly
 * the element it names and nothing more.
 */

const resolve = (card: ContactCard) => resolveCard(card, fixtureUser, fixtureGroups, fixtureFields);

const CARDS: readonly ContactCard[] = [
  ...fixtureCards,
  cardEmptyDemo,
  {
    ...fixtureCards[0],
    coverUrl: "https://cdn.example/cover.jpg",
    headline: "Founder",
    bio: "A line about me.",
  },
];

describe("no edit slots — every other caller", () => {
  it.each(CARDS.map((card) => [card.id, card] as const))(
    "%s renders identically with `edit` absent or empty",
    (_id, card) => {
      const resolved = resolve(card);
      const plain = renderToStaticMarkup(<CardPage resolved={resolved} />);
      expect(renderToStaticMarkup(<CardPage resolved={resolved} edit={undefined} />)).toBe(plain);
      expect(renderToStaticMarkup(<CardPage resolved={resolved} edit={{}} />)).toBe(plain);
      expect(plain).not.toContain("data-card-edit");
    },
  );
});

describe("edit slots", () => {
  const bare: ContactCard = { ...cardEmptyDemo, coverUrl: null, headline: null, bio: null };

  it("puts the cover slot inside the cover, and an empty cover holds the photo aperture", () => {
    const resolved = resolve(bare);
    expect(resolved.cover.kind).toBe("none");

    const { container } = render(
      <CardPage resolved={resolved} edit={{ cover: <button type="button">Add a photo</button> }} />,
    );
    const cover = container.querySelector<HTMLElement>("[data-card-cover]");
    expect(cover?.querySelector('[data-card-edit="cover"] button')).toHaveTextContent("Add a photo");
    expect(cover?.style.aspectRatio).toBe(`1 / ${COVER_RATIO.photo}`);

    /* Without the slot, the same card keeps its short flat band. */
    const { container: plain } = render(<CardPage resolved={resolved} />);
    expect(plain.querySelector<HTMLElement>("[data-card-cover]")?.style.aspectRatio).toBe(
      `1 / ${COVER_RATIO.none}`,
    );
  });

  it("renders the headline and bio slots even when the card has neither", () => {
    const resolved = resolve(bare);
    const { container } = render(
      <CardPage
        resolved={resolved}
        edit={{
          headline: <button type="button">Add your role</button>,
          bio: <button type="button">Add a short bio</button>,
        }}
      />,
    );
    expect(container.querySelector('[data-card-edit="headline"]')).toHaveTextContent("Add your role");
    expect(container.querySelector('[data-card-edit="bio"]')).toHaveTextContent("Add a short bio");
  });

  it("replaces the role and bio lines rather than adding beside them", () => {
    const resolved = resolve({ ...fixtureCards[0], headline: "Founder", bio: "A line about me." });

    const { container: plain } = render(<CardPage resolved={resolved} />);
    expect(plain.querySelector("[data-card-role]")).toHaveTextContent("Founder");
    expect(plain.querySelector("[data-card-bio]")).toHaveTextContent("A line about me.");

    const { container } = render(
      <CardPage resolved={resolved} edit={{ headline: <span>role editor</span>, bio: <span>bio editor</span> }} />,
    );
    expect(container.querySelector("[data-card-role]")).toBeNull();
    expect(container.querySelector("[data-card-bio]")).toBeNull();
    expect(container.querySelector('[data-card-edit="headline"]')).toHaveTextContent("role editor");
    expect(container.querySelector('[data-card-edit="bio"]')).toHaveTextContent("bio editor");
    /* The rest of the hero is untouched. */
    expect(container.querySelector("[data-card-name]")).toHaveTextContent(resolved.fullName);
  });

  it("leaves the other regions alone when only one slot is given", () => {
    const resolved = resolve({ ...fixtureCards[0], headline: "Founder", bio: "A line about me." });
    const { container } = render(<CardPage resolved={resolved} edit={{ bio: <span>bio editor</span> }} />);
    expect(container.querySelector("[data-card-role]")).toHaveTextContent("Founder");
    expect(container.querySelector('[data-card-edit="cover"]')).toBeNull();
    expect(container.querySelector('[data-card-edit="headline"]')).toBeNull();
  });
});
