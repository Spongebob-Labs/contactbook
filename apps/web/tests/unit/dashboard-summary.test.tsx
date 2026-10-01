import { describe, expect, it } from "vitest";

import { cleanup, renderWithProviders, screen, within } from "../helpers/render";

import { resolveCard } from "@/card/resolve-card";
import { CARD_THUMB_LIMIT, CardsTile } from "@/components/dashboard/cards-tile";
import {
  ContactsTile,
  RECENT_CONTACT_LIMIT,
  formatAddedDate,
} from "@/components/dashboard/contacts-tile";
import {
  PROFILE_KEY_ITEMS,
  profileCompleteness,
  type ProfileSnapshot,
} from "@/components/dashboard/profile-completeness";
import {
  PROFILE_SUGGESTION_LIMIT,
  ProfileTile,
  roleLine,
} from "@/components/dashboard/profile-tile";
import { fixtureCards, fixtureContacts, fixtureFields, fixtureGroups, fixtureUser } from "@/fixtures";
import { formatPhoneDisplay } from "@/lib/format";
import { contactLabel, type Contact } from "@/types/domain";

/**
 * The three summary tiles at the top of `/dashboard` (Profile → Cards → Contacts) and the key
 * set the Profile tile measures completeness against.
 *
 * Copy is read from the modules that own it (`PROFILE_KEY_ITEMS[i].action`, the fixtures,
 * `contactLabel`) rather than restated here, so a wording change is not a test failure. What is
 * asserted is behaviour: which items count, how many actions are offered, where each link goes.
 */

/** The fixture owner: every key item present (photo, DOB, work address, socials…). */
const FULL: ProfileSnapshot = { user: fixtureUser, groups: fixtureGroups, fields: fixtureFields };

/** A first-day owner: onboarding gave them a name, a verified phone and an email, nothing else. */
const NEW_OWNER: ProfileSnapshot = {
  user: { ...fixtureUser, avatarUrl: null },
  groups: [],
  fields: [],
};

const item = (id: string) => PROFILE_KEY_ITEMS.find((i) => i.id === id)!;

describe("profileCompleteness", () => {
  it("measures against the eight named key items, and nothing else", () => {
    expect(PROFILE_KEY_ITEMS.map((i) => i.id)).toEqual([
      "photo",
      "mobile",
      "email",
      "jobTitle",
      "company",
      "address",
      "birthday",
      "social",
    ]);
    const full = profileCompleteness(FULL);
    expect(full).toMatchObject({ done: 8, total: 8 });
    expect(full.missing).toEqual([]);
  });

  it("counts the verified phone and the sign-up email for a brand-new owner", () => {
    const fresh = profileCompleteness(NEW_OWNER);
    expect(fresh.done).toBe(2);
    expect(fresh.missing.map((i) => i.id)).toEqual([
      "photo",
      "jobTitle",
      "company",
      "address",
      "birthday",
      "social",
    ]);
  });

  it("does not count a registered office as the owner's address, or an anniversary as a birthday", () => {
    const business = fixtureGroups.find((g) => g.category === "BUSINESS")!;
    const custom = fixtureGroups.find((g) => g.category === "CUSTOM")!;
    const snapshot: ProfileSnapshot = {
      user: NEW_OWNER.user,
      groups: [business, custom],
      fields: [
        { groupId: business.id, type: "ADDRESS", value: "1 Office Park" },
        { groupId: custom.id, type: "DATE", value: "2020-02-02" },
      ],
    };
    const { missing } = profileCompleteness(snapshot);
    expect(missing).toContain(item("address"));
    expect(missing).toContain(item("birthday"));
  });

  it("treats a blank value as absent", () => {
    const social = fixtureGroups.find((g) => g.category === "SOCIAL")!;
    const { missing } = profileCompleteness({
      ...NEW_OWNER,
      groups: [social],
      fields: [{ groupId: social.id, type: "SOCIAL_LINK", value: "   " }],
    });
    expect(missing).toContain(item("social"));
  });
});

describe("ProfileTile", () => {
  const props = (snapshot: ProfileSnapshot) => ({
    firstName: fixtureUser.firstName,
    lastName: fixtureUser.lastName,
    role: roleLine(snapshot.fields),
    phone: fixtureUser.phone,
    email: fixtureUser.email,
    photoUrl: snapshot.user.avatarUrl,
    completeness: profileCompleteness(snapshot),
  });

  it("summarises who the owner is: name, role, number, email", () => {
    renderWithProviders(<ProfileTile {...props(FULL)} />);
    const tile = document.querySelector('[data-dashboard-region="profile"]') as HTMLElement;

    expect(within(tile).getByRole("heading", { level: 2 })).toBeInTheDocument();
    expect(tile.querySelector("[data-profile-name]")).toHaveTextContent(
      `${fixtureUser.firstName} ${fixtureUser.lastName}`,
    );
    expect(tile.querySelector("[data-profile-phone]")).toHaveTextContent(
      formatPhoneDisplay(fixtureUser.phone),
    );
    expect(tile.querySelector("[data-profile-email]")).toHaveTextContent(fixtureUser.email!);
    expect(tile.querySelector("[data-profile-role]")).toHaveTextContent(roleLine(fixtureFields)!);
    expect(within(tile).getByRole("link", { name: /edit profile/i })).toHaveAttribute(
      "href",
      "/profile",
    );
  });

  it("offers no actions once every key item is present", () => {
    renderWithProviders(<ProfileTile {...props(FULL)} />);
    expect(document.querySelector("[data-profile-completeness]")).toHaveAttribute(
      "data-profile-completeness",
      "8/8",
    );
    expect(document.querySelector("[data-profile-suggestions]")).toBeNull();
  });

  it("offers at most two missing items, most useful first, each linking to /profile", () => {
    renderWithProviders(<ProfileTile {...props(NEW_OWNER)} />);

    const expected = profileCompleteness(NEW_OWNER).missing.slice(0, PROFILE_SUGGESTION_LIMIT);
    const links = [...document.querySelectorAll("[data-profile-suggestion]")];
    expect(links).toHaveLength(PROFILE_SUGGESTION_LIMIT);
    expect(links.map((l) => l.getAttribute("data-profile-suggestion"))).toEqual(
      expected.map((i) => i.id),
    );
    links.forEach((link, i) => {
      expect(link).toHaveTextContent(expected[i]!.action);
      expect(link).toHaveAttribute("href", "/profile");
    });
    expect(document.querySelector("[data-profile-completeness]")).toHaveAttribute(
      "data-profile-completeness",
      "2/8",
    );
  });

  it("falls back to the number as the heading when the owner has no name yet", () => {
    renderWithProviders(
      <ProfileTile {...props(NEW_OWNER)} firstName="" lastName="" role={null} />,
    );
    expect(document.querySelector("[data-profile-name]")).toHaveTextContent(
      formatPhoneDisplay(fixtureUser.phone),
    );
    // Stated once, not twice.
    expect(document.querySelector("[data-profile-phone]")).toBeNull();
  });
});

describe("CardsTile", () => {
  const resolved = fixtureCards
    .slice(0, CARD_THUMB_LIMIT)
    .map((card) => resolveCard(card, fixtureUser, fixtureGroups, fixtureFields));

  it("leads with the count and previews up to three cards, each one link to its page", () => {
    renderWithProviders(<CardsTile count={fixtureCards.length} recent={resolved} />);

    expect(document.querySelector("[data-summary-tile-count]")).toHaveTextContent(
      String(fixtureCards.length),
    );

    const thumbs = [...document.querySelectorAll("[data-dashboard-card-thumb]")];
    expect(thumbs).toHaveLength(CARD_THUMB_LIMIT);
    thumbs.forEach((thumb, i) => {
      const card = resolved[i]!;
      /* The tile rule: exactly one control per thumbnail, and it is the way to the card. The
         preview itself is hidden and inert, so nothing inside it is reachable. */
      const links = [...thumb.querySelectorAll("a")].filter(
        (a) => a.closest('[aria-hidden="true"]') === null,
      );
      expect(links).toHaveLength(1);
      expect(links[0]).toHaveAttribute("href", `/cards/${card.cardId}`);
      expect(links[0]).toHaveAccessibleName(card.cardName);
      expect(thumb.querySelector('[aria-hidden="true"] [data-card-thumb]')).toHaveAttribute("inert");
    });

    expect(screen.getByRole("link", { name: /new card/i })).toHaveAttribute("href", "/cards/new");
    expect(screen.getByRole("link", { name: /view all cards/i })).toHaveAttribute("href", "/cards");
  });

  it("prompts the first card when there are none", () => {
    renderWithProviders(<CardsTile count={0} recent={[]} />);

    const create = document.querySelector("[data-cards-tile-create]");
    expect(create).toHaveAttribute("href", "/cards/new");
    expect(document.querySelector("[data-dashboard-card-thumb]")).toBeNull();
    expect(document.querySelector("[data-summary-tile-count]")).toBeNull();
  });

  it("prints a dash, never 0, for a count the API did not send", () => {
    renderWithProviders(<CardsTile count={null} recent={resolved} />);
    const count = document.querySelector("[data-summary-tile-count]")!;
    expect(count).toHaveTextContent("—");
    expect(count).not.toHaveTextContent(/\d/);
    expect(document.querySelector("[data-cards-tile-create]")).toBeNull();
  });
});

describe("ContactsTile", () => {
  const newestFirst = [...fixtureContacts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  it("lists the most recent contacts, each linking to its page", () => {
    renderWithProviders(
      <ContactsTile
        count={fixtureContacts.length}
        recent={newestFirst.slice(0, RECENT_CONTACT_LIMIT)}
        shareCardId="card_x"
        hasCards
      />,
    );

    const rows = [...document.querySelectorAll("[data-contacts-tile-row]")];
    expect(rows).toHaveLength(RECENT_CONTACT_LIMIT);
    rows.forEach((row, i) => {
      const contact = newestFirst[i]!;
      expect(row.querySelector("a")).toHaveAttribute("href", `/contacts/${contact.id}`);
      expect(row).toHaveTextContent(contactLabel(contact));
    });
    expect(screen.getByRole("link", { name: /view all contacts/i })).toHaveAttribute(
      "href",
      "/contacts",
    );
  });

  it("heads an unnamed contact with the formatted number, and states it once", () => {
    const unnamed: Contact = { ...fixtureContacts[0]!, id: "c_unnamed", displayName: null };
    renderWithProviders(
      <ContactsTile count={1} recent={[unnamed]} shareCardId="card_x" hasCards />,
    );
    const row = document.querySelector("[data-contacts-tile-row]")!;
    const shown = formatPhoneDisplay(unnamed.phoneE164);
    expect(row).toHaveTextContent(shown);
    expect(row.textContent!.split(shown)).toHaveLength(2);
  });

  it("sends an owner with a card but no contacts to that card to share it", () => {
    renderWithProviders(<ContactsTile count={0} recent={[]} shareCardId="card_x" hasCards />);
    expect(document.querySelector("[data-contacts-tile-action]")).toHaveAttribute(
      "href",
      "/cards/card_x",
    );
  });

  it("sends an owner with no card to the builder, as a secondary action", () => {
    cleanup();
    renderWithProviders(
      <ContactsTile count={0} recent={[]} shareCardId={null} hasCards={false} />,
    );
    const action = document.querySelector("[data-contacts-tile-action]")!;
    expect(action).toHaveAttribute("href", "/cards/new");
    /* The Cards tile carries the primary "create" action; this one must not compete with it. */
    expect(action.className).not.toMatch(/\bbg-accent\b/);
  });
});

describe("formatAddedDate", () => {
  const now = new Date("2026-09-28T12:00:00Z");

  it("drops the year inside the current year and keeps it otherwise", () => {
    expect(formatAddedDate("2026-01-01T00:00:00.000Z", now)).toBe("1 Jan");
    expect(formatAddedDate("2025-12-31T23:00:00.000Z", now)).toBe("31 Dec 2025");
  });

  it("returns nothing for an unreadable date rather than 'Invalid Date'", () => {
    expect(formatAddedDate("not-a-date", now)).toBe("");
  });
});
