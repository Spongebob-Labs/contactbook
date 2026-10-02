import { FIXTURE_DB } from "@/fixtures";
import * as mayaFacts from "@/fixtures/marketing-identity";
/* `marketingUser`'s own import, kept separate from the namespace import above so the two section
   passes cannot break each other's. */
import { MAYA } from "@/fixtures/marketing-identity";
import type {
  ContactCard,
  FieldGroup,
  ProfileField as DomainProfileField,
  User,
} from "@/types/domain";

/**
 * Copy for `/`.
 *
 * ⚠ REBUILT 2026-09-08 AGAINST THE CLIENT'S WEBSITE BRIEF. Everything here is new except the
 * hero's card script and the example-card set, which were built earlier in the same rebuild.
 *
 * The section order, the headlines and most of the sentences are the client's, from
 * `ContactBook_Website_Brief.docx` and the voice note that came with it. What we changed, and
 * the four places the brief, the 2018 deck and this build disagreed, is written up in
 * `plan.md` at the repo root — read that before rewriting a line of this.
 *
 * ## What was deleted, and where it went
 * The previous page had seven sections. Three are gone as sections and none of their arguments
 * were dropped:
 *
 *   · `broadcast` — "No app can change your number inside someone else's phone." The best
 *     writing on the old page, and structurally in the wrong place: a rebuttal delivered before
 *     the claim, so a visitor met our caveat before they knew what the product did. It is now
 *     the last paragraph of `solution`, where it answers a question the reader has just formed.
 *   · `trust` — "A card is a filter, not a copy." This *was* the brief's Solution section,
 *     sitting three screens too low under a different name. Its four panels are now the
 *     interactive half of `solution`, where a reader can check the claim instead of reading it.
 *   · `faq` — five accordion questions on a one-scroll overview page, which is exactly the
 *     text-heaviness the client pushed back on. Two of its answers survive inside `solution`;
 *     the rest can return on their own page.
 *
 * ## The register
 * Short. The client's note on the previous build was that it is *"so text-heavy"* and wants
 * *"just to the point, crisp, and just relevant information"*. Every section below carries one
 * idea, and the visual beside it is expected to do the work a second paragraph used to.
 *
 * ⚠ Fixture hygiene: every domain here must be RFC-2606 reserved and every phone number must
 * come from a range that cannot be allocated. `tests/contract/fixture-hygiene.test.ts` enforces
 * the first as an allowlist. The 2018 deck this content derives from contains the founder's
 * real friends and their real mobile numbers; none of it crosses into a fixture.
 */

/**
 * ⚠ THE ORDER IS THE PAGE, AND EACH SECTION ANSWERS THE QUESTION THE LAST ONE RAISES.
 *
 * That is the whole correction this rebuild makes. The previous seven sections were assembled
 * one at a time and had no argument running through them, so a visitor was told what the
 * product was careful about before being told what it was.
 *
 *   hero      → what is this?
 *   problem   → why do I care?
 *   solution  → what is the fix?
 *   cards     → what will mine look like?
 *   how       → what do I actually do?
 *   corporate → is this for my company?
 *   belief    → why should I trust you?
 *   start     → right, what now?
 *
 * ⚠ `cards` SITS BEFORE `how-it-works`, WHICH IS NOT THE BRIEF'S ORDER. The brief runs
 * how-it-works then example-cards. Swapped deliberately: `solution` ends on an interactive
 * exhibit and `how-it-works` is the page's one deliberately quiet, factual stretch, so putting
 * the six coloured cards between them keeps two dense sections apart. Worth raising with the
 * client, since it is their order being changed.
 *
 * ⚠ `corporate` IS THE SECOND DARK SURFACE, which the close used to be alone in being. That is
 * deliberate: it addresses a different reader than every section around it, and a change of
 * ground is the only way this page says so. `belief` sits between the two on the wash, so the
 * alternation still holds and the two dark bands never touch.
 */
/* `cards`, `corporate` and `belief` were removed on 2026-09-19 with their sections. The nav's
   "Example cards" link moved to `/templates` rather than being dropped — see `pill-nav.tsx`,
   where this is now the second time a nav anchor has been orphaned by a section cut. */
export const MARKETING_SECTION_IDS = [
  "hero",
  "problem",
  "solution",
  "how-it-works",
  "start",
] as const;
export type MarketingSectionId = (typeof MARKETING_SECTION_IDS)[number];

export interface MarketingLink {
  readonly href: string;
  readonly label: string;
}

export interface HeroCopy {
  readonly eyebrow: string;
  readonly headline: string;
  /** The functional explainer, set one step down from the headline. */
  readonly subhead: string;
  /** One short paragraph under the explainer. See the note on `hero` before lengthening it. */
  readonly lead: string;
  readonly primary: MarketingLink;
  readonly secondary: MarketingLink;
  readonly aside: string;
  readonly cardFrontLabel: string;
  readonly cardBackLabel: string;
  readonly cardHint: string;
  /**
   * The four claims under the hero's controls, added 2026-09-19.
   *
   * `icon` names a `lucide-react` export. It is a STRING rather than a component so that this
   * file stays copy-only and imports no React — `fixture-hygiene.test.ts` sweeps this module
   * and a component import here would make the fixtures a rendering concern.
   */
  readonly proof: readonly {
    readonly icon: string;
    readonly title: string;
    readonly body: string;
  }[];
}

/**
 * ⚠ THE WORDS ARE THE CLIENT'S AND ARE NOT OURS TO IMPROVE.
 *
 * `headline` and `subhead` are the two locked lines from the website brief — "ContactBook —
 * Never Lose Contact" and "The address book that updates itself." They are the brand, they
 * appear on the deck's cover, and a rewrite of either is a rewrite of the identity. The
 * previous headline here ("Hand over one card. Keep it true for years.") was ours, was good,
 * and is gone for that reason.
 *
 * ⚠ `subhead` IS THE ONE LINE WE CHANGED, AND WHY.
 * The brief's third line reads "ContactBook keeps the right people updated automatically."
 * The product deliberately does not do that: no app on iOS or Android can silently rewrite an
 * entry in someone else's address book, and the page has said so for two builds. What IS
 * automatic is the shared card — it resolves from live data at request time, so the link a
 * recipient already holds shows today's details with nobody resending anything.
 *
 * So the promise is split rather than dropped: this line claims only what the card does, and
 * the Solution section carries the full distinction. Raised with the client as an open
 * question; if they insist on "automatically", that is their call to make knowingly.
 */
export const hero = {
  eyebrow: "Contact Book",
  headline: "Never lose contact.",
  subhead: "The address book that updates itself.",
  /* Deliberately two short sentences rather than the previous 46-word paragraph. The client's
     note on the old page was that it is "so text-heavy"; the hero now carries one idea and the
     card beside it carries the demonstration. */
  lead: "Your details change. The card you handed out changes with them.",
  /* ⚠ 2026-09-28 — THE WAITLIST AND "FOR COMPANIES" ARE OFF THE HOMEPAGE, ON THE CLIENT'S
     WORD: *"Still showing old version: 'join the waitlist' copy and 'for companies' tag need
     removing."* The product is open, so the primary is the real front door — phone sign-in,
     which is both sign-up and log-in (`/signin/phone` → OTP → onboarding for a new number).
     The secondary stays on the page instead of sending a reader to a second one.
     `/waitlist` and `/corporate` still exist as routes; nothing on the homepage or its chrome
     links to them any more. */
  primary: { href: "/signin/phone", label: "Create your card" },
  secondary: { href: "#how-it-works", label: "See how it works" },
  /* ⚠ NOT RENDERED SINCE 2026-09-19, AND DELIBERATELY KEPT ANYWAY.
     `proof[2]` ("Nothing to install" / "They tap a link. It opens in their browser.") now makes
     this exact claim, with an icon and a heading, a few rows below where this used to sit — the
     page was saying the same sentence twice on one screen. The row is what a reader actually
     stops on, so the row won.
     This line is the client's own phrasing and the origin of that claim, so it stays here as
     the record rather than being deleted. If the proof row is ever cut, restore this render in
     `hero.tsx` rather than rewriting the sentence from memory. */
  aside: "Nothing to install for the person you hand it to. It opens in their browser.",
  /* The flip control's accessible name, which changes with the face so it describes what a
     press will do rather than what is currently showing. */
  cardFrontLabel: "Showing the card you hand over. Press to see the card it opens.",
  cardBackLabel: "Showing the card it opens. Press to see the card you hand over.",
  /* Shown under the card. The automatic flip demonstrates that there are two faces, but only
     to a reader who happens to be looking at the right moment — and once somebody presses it,
     the cycle stops for good, so the hint is how they learn they are allowed to. */
  cardHint: "Turns on its own \u2014 or press it.",
  /* The four-up row under the controls. It exists because the hero had a measurable amount of
     dead space beneath the buttons at desktop widths, and because these are the four things
     the rest of the page spends a section each proving \u2014 stating them once, early, lets a
     reader decide to keep scrolling before they have read any of it.

     Each one is a promise the product actually keeps. "Take it back" in particular is not
     decoration: revocation is a real capability and, since the `cards` section was cut, this
     is now the only place above the fold that mentions it. */
  proof: [
    {
      icon: "RefreshCw",
      title: "Always current",
      body: "Edit once. Everyone holding your card sees it.",
    },
    {
      icon: "SlidersHorizontal",
      title: "You choose the fields",
      body: "Each card shows only what you put on it.",
    },
    {
      icon: "Link2",
      title: "Nothing to install",
      body: "They tap a link. It opens in their browser.",
    },
    {
      icon: "Undo2",
      title: "Take it back",
      body: "Revoke a card and it stops resolving.",
    },
  ],
} as const satisfies HeroCopy;
/* ════════════════════════════════════════════════════════════════════════════════════════
   RETIRED — THE HERO'S LIVE CARD (2026-09-28 → 2026-09-29).

   The hero card used to cycle through Maya Lauren's four cities, re-resolving the product's
   `<CardPage>` per beat and tagging changed lines "Updated". The client rejected it; the hero
   now draws their reference card still (see `heroPhone` below). The beats, `LIVE_FIELD` and
   `heroCard` went with it. What remains here is only what `contact-card.tsx` still compiles
   against.
   ════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠ THE FIVE ROW STATES BELOW BELONG TO THE RETIRED `<ContactCard>` RENDITION
 * (`contact-card.tsx`), which nothing on the page renders any more. They are kept only so that
 * file still compiles; the hero's beats no longer use them.
 *
 * What is happening to one row at one beat.
 *
 * - `stable`   — nothing. The row is simply true.
 * - `stale`    — the value is wrong. Marked and struck, still fully legible.
 * - `updated`  — the value has just been corrected. Carries `was`, which rolls out upward as
 *                the new value rolls in beneath it.
 * - `arriving` — the row is new to this card.
 * - `leaving`  — the owner revoked it. Last beat this row appears in.
 */
export type LiveRowState = "stable" | "stale" | "updated" | "arriving" | "leaving";

export interface LiveCardRow {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly state: LiveRowState;
  /** Only on `updated`. The value being replaced. */
  readonly was?: string;
}

/** Only `contact-card.tsx`'s retired rendition reads this. See the note on `LiveRowState`. */
export const LIVE_CARD_SLOTS = 5;

/* ════════════════════════════════════════════════════════════════════════════════════════
   SECTION 2 — THE PROBLEM.  Brief Section 2.

   The job: make the reader recognise their own address book, uncomfortably.

   ⚠ TWO IDEAS ONLY — WRONG, AND THIN. The 2018 deck lists five problems (outdated,
   incomplete, duplicated, staying informed, control and privacy). Three of those are answered
   later by the product, so listing them here turns a punch into an inventory. The sharpest
   line in either document is the deck's — "it's out-dated the minute it's up-dated" — and it
   is the second sentence below.

   The visual is the client's own strongest asset: deck page 13, the before/after. A native
   phone contact with three fields struck through, beside the same person's live card. It makes
   the argument without a word of copy, which is why the copy here is two short paragraphs and
   not five.
   ════════════════════════════════════════════════════════════════════════════════════════ */

export interface StaleRow {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  /** Struck through and tagged. Three of four, matching the deck's three red arrows. */
  readonly stale?: boolean;
}

export interface ProblemCopy {
  readonly heading: string;
  /** The phrase set in `--mk-green-display`. Must appear verbatim in `heading`. */
  readonly accent: string;
  readonly paragraphs: readonly string[];
  readonly beforeLabel: string;
  readonly afterLabel: string;
  readonly staleTag: string;
  readonly beforeRows: readonly StaleRow[];
  readonly caption: string;
}

export const problem = {
  heading: "Your address book is already out of date.",
  accent: "out of date.",
  paragraphs: [
    "It went out of date the minute you updated it. People move home, switch jobs, open a new email account, change a number. Unless they tell you, you lose contact.",
    "And most address books are not just wrong, they are thin. You may have someone's mobile but not their current email, their company, their office, or the way they would rather be contacted.",
  ],
  beforeLabel: "Saved in your phone",
  afterLabel: "The same person, on Contact Book",
  staleTag: "out of date",
  /* Maya Laurent's entry as it sits in your phone two years after you saved it — the one person
     the whole landing page is about (`fixtures/marketing-identity.ts`; 2026-09-28 moved the
     Indian number and Mumbai details out, 2026-09-29 made her the hero's person). The mobile is
     still true; the three work rows are what she had before she founded Maya Partners.

     ⚠ NOT RENDERED TODAY — `problem.tsx`'s header explains why these five fields outlived the
     before/after device. Kept current anyway so no Indian number survives in the fixture. */
  beforeRows: [
    /* `stale: false` is written out rather than omitted. With `as const satisfies`, an absent
       optional field is absent from that member's literal type, so a consumer reading
       `row.stale` gets a type error on this row alone — the narrowing is the point of
       `as const` and this is the cost of it. */
    { id: "mobile", label: "Mobile", value: mayaFacts.MAYA.mobile, stale: false },
    { id: "email", label: "Work email", value: "maya@harbourline.example", stale: true },
    { id: "company", label: "Company", value: "Harbourline Networks", stale: true },
    { id: "role", label: "Role", value: "Partnerships Lead", stale: true },
  ],
  caption:
    "Three of these four were true when you saved them. Nothing told you when they stopped being true.",
} as const satisfies ProblemCopy;

/* ════════════════════════════════════════════════════════════════════════════════════════
   SECTION 3 — THE SOLUTION.  Brief Section 3, and the section that carries the product idea.

   ## ⚠ COPY REWRITTEN 2026-09-28, IN THE CLIENT'S OWN VOICE
   The client: *"'Live contact' copy: rewrite in direct voice, e.g. 'Create a contact card with
   info you want to share, for work, personal, or family'"*. So `lead` is now that sentence,
   second person, naming the three cards the exhibit shows, and the two explanatory paragraphs
   are one short one. "A card is a filter over your profile, not a second copy of it" is cut:
   it explained the product to its own reader, which is the filler the client asked to strip.
   `heading` is still the client's and is untouched.

   ## The exhibit is the argument, not an illustration of it
   One profile band above a deck of three real cards. The front card's fields light up in the
   band, so "one profile, many cards" is performed rather than asserted — see `solution.tsx`.

   ⚠ THE PRIVATE FIELD IS IN THE PROFILE ON PURPOSE. `bank` is marked private and appears on
   NO card, and cannot be put on one — that is a real product rule (§7.3: a private field is
   masked everywhere and cannot be added to a shared card at all, not a warning you can click
   past). Leaving it out of this exhibit would have made the strongest trust claim invisible.
   ════════════════════════════════════════════════════════════════════════════════════════ */

export interface ProfileField {
  readonly id: string;
  readonly label: string;
  /** Masked everywhere, and cannot be added to any shared card. Never appears in `fields`. */
  readonly private?: boolean;
}

export interface SolutionCard {
  readonly id: string;
  /** The card's own name, as the owner would call it. Used in the chips' screen-reader line. */
  readonly name: string;
  /** The bold label shown while this card is at the front of the deck. */
  readonly title: string;
  /** One line: what is on it, and who it is for. */
  readonly note: string;
  readonly paletteId: string;
  /** Ids from `profile`. A private field id here is a bug the component cannot express. */
  readonly fields: readonly string[];
}

export interface SolutionCopy {
  readonly heading: string;
  readonly accent: string;
  readonly lead: string;
  readonly paragraphs: readonly string[];
  /** Plain sentences under the exhibit. No headed block — see the note on the value. */
  readonly honesty: string;
  readonly profileLabel: string;
  readonly cardsLabel: string;
  readonly privateTag: string;
  readonly allLabel: string;
  /** The deck's pause control (WCAG 2.2.2): its label while running, and once paused. */
  readonly pauseLabel: string;
  readonly pausedLabel: string;
  readonly profile: readonly ProfileField[];
  readonly cards: readonly SolutionCard[];
}

export const solution = {
  heading: "Live contact cards, shared your way.",
  accent: "shared your way.",
  lead: "Create a contact card with only the details you want to share, for work, for recruiters or for family.",
  paragraphs: [
    "Share it as a link. When a detail changes, everyone you sent it to sees the new one.",
  ],
  /* ⚠ THIS MAY NOT BE CUT, AND IT IS THE ONE PLACE THIS PAGE ARGUES WITH ITS OWN BRIEF. The
     brief says, twice, that recipients "receive the updated information automatically". The
     product deliberately does not do that. The claim is split rather than dropped: the *card*
     is always current, because the page resolves from live data at request time; the copy
     *inside someone's address book* changes when you send an update and they accept it. Raised
     with the client as an open question — if they insist on "automatically", that is theirs to
     decide knowingly.

     2026-09-28: kept, but as two plain sentences under the exhibit rather than a headed block
     ("What that does not mean" + three sentences). Same two facts, a third of the words. */
  honesty:
    "No app can edit a contact already saved in someone else's phone. Your link is always current, and when you send an update, they save it with one tap.",
  profileLabel: "Your profile",
  cardsLabel: "Your cards",
  privateTag: "Private",
  allLabel: "Everything you have added",
  pauseLabel: "Pause",
  pausedLabel: "Paused",
  /* ⚠ THESE LABELS MIRROR `exampleCardSpecs`' REAL FIELDS, one chip per field of Maya's profile
     the three cards draw on. If a card's `fields` below changes, change that card's `fieldIds`
     in `exampleCardSpecs` with it, or the band lights chips the card beside it does not show. */
  profile: [
    { id: "mobile", label: "Mobile" },
    { id: "work-email", label: "Work email" },
    { id: "personal-email", label: "Personal email" },
    { id: "title", label: "Job title" },
    { id: "company", label: "Company" },
    { id: "office", label: "Office address" },
    { id: "home", label: "Home address" },
    { id: "social", label: "LinkedIn" },
    { id: "experience", label: "Experience" },
    { id: "birthday", label: "Birthday" },
    { id: "site", label: "Website" },
    { id: "bank", label: "Bank account", private: true },
  ],
  /* ⚠ ORDER IS THE DECK'S ROTATION: Work at the front, Family next, CV last. Not the client's
     listing order (work, CV, family) — this order puts the light clay card directly behind the
     dark sapphire one at rest, so the first thing anyone sees is a deck whose back edges read as
     two different cards rather than one dark smudge. */
  cards: [
    {
      id: "work",
      name: "Work",
      title: "Your Work Contact Card",
      note: "Your role, number and office. For clients and colleagues.",
      paletteId: "sapphire",
      fields: ["mobile", "work-email", "title", "company", "office", "social"],
    },
    {
      id: "family",
      name: "Family",
      title: "Your Family Contact Card",
      note: "Your home address, birthday and mobile. For the people closest to you.",
      paletteId: "clay",
      fields: ["mobile", "personal-email", "home", "birthday"],
    },
    {
      id: "cv",
      name: "CV",
      title: "Your CV Contact Card",
      note: "Your experience, LinkedIn and personal email. For recruiters and headhunters.",
      paletteId: "onyx",
      fields: ["mobile", "personal-email", "title", "social", "experience"],
    },
  ],
} as const satisfies SolutionCopy;

/* ════════════════════════════════════════════════════════════════════════════════════════
   SECTION 4 — HOW IT WORKS.  Brief Section 4.

   Five steps, skim-readable in fifteen seconds.

   ⚠ FIVE, NOT FOUR. The previous page had four and the missing one was **control** — expand,
   restrict or revoke what someone can see. That is the trust half of the product and it had no
   home on the page at all.

   ⚠ AND IT IS THE QUIET SECTION, DELIBERATELY. This replaces a four-cell bento that held two
   live card renders, a recolouring control and a real QR code. Sections 1, 3 and 5 all carry
   motion, colour or an interaction; if this one does too, the page is noise from top to bottom
   and nothing reads as important. Numbered rows, a hairline between them, one green ordinal.
   Resist illustrating it.
   ════════════════════════════════════════════════════════════════════════════════════════ */

export interface Step {
  readonly ordinal: string;
  readonly title: string;
  readonly body: string;
}

export interface HowItWorksCopy {
  readonly heading: string;
  readonly accent: string;
  readonly steps: readonly Step[];
  /** The world-map band under the three frames. `label` sits in the frames' own label
   *  register; `alt` is the map's accessible name. The cities come from
   *  `fixtures/marketing-identity.ts`, never from here. */
  readonly map: { readonly label: string; readonly alt: string };
}

export const howItWorks = {
  heading: "How it works.",
  accent: "works.",
  steps: [
    {
      ordinal: "01",
      title: "Create your details",
      /* 2026-09-28: the em-dash aside became a colon (the client's "strip AI filler" pass).
         Same words otherwise. */
      body: "Add your contact information once: personal, professional, digital, and anything custom you need.",
    },
    {
      ordinal: "02",
      title: "Build your cards",
      body: "Choose which fields appear on each card, and give it a colour.",
    },
    {
      ordinal: "03",
      title: "Share the right one",
      body: "Send the link, or let them scan the code. There is nothing for them to install.",
    },
    {
      ordinal: "04",
      title: "Stay current",
      body: "Change a field and everyone holding that card sees the new version. Send them a notification when it matters.",
    },
    {
      ordinal: "05",
      title: "Stay in control",
      body: "Expand, restrict or revoke what any one person can see, whenever you want.",
    },
  ],
  /* 2026-09-28, the client: *"Consider adding a global map element to reinforce international
     feel."* The map is Maya's four cities; the label says so in four words, no sentence. */
  map: {
    label: "One profile, four cities",
    alt: "World map marking London, Dubai, New York and Singapore",
  },
} as const satisfies HowItWorksCopy;
/* ════════════════════════════════════════════════════════════════════════════════════════
   EXAMPLE CARDS — brief Section 5.

   The brief: *"This section should help visitors understand that the product is flexible. The
   website should show example cards, NOT exhaustive field lists, in a visual way."* So each
   tile carries three or four field LABELS and no values — enough to recognise the card, not
   enough to become an inventory. The page already had a 21-item field grid and it was cut for
   exactly this reason.

   ## ⚠ "DIFFERENT CARDS WITH DIFFERENT DESIGNS" MEANS COLOUR, NOT LAYOUT
   The brief's phrasing invites six different compositions. It must not get them. Every card in
   this product uses ONE format, decided after the note *"each and every card should be in the
   same format — I'm not saying colour, I'm just saying format"*: someone handed one card should
   already know where to look on every other. So the six tiles below differ in ground and in
   content and in nothing else. Raised with the client as an open question rather than resolved
   silently in a component.

   ## Why a `paletteId` and not a hex
   The ground is named, and the name resolves against `src/card/template-palettes.ts` at render
   time — the same nine grounds the product ships, whose every ink pair is proven by
   `tests/contract/template-palettes.test.ts`. A hex here would be a tenth palette that nobody
   measured, drifting away from the product one release at a time. That is the defect the HUES
   block in `marketing.css` exists to prevent.

   The order alternates deep and light grounds. Six deep grounds in a grid is a wall; six light
   ones is wallpaper.
   ════════════════════════════════════════════════════════════════════════════════════════ */

export interface ExampleCard {
  readonly id: string;
  /** A key of `TEMPLATE_PALETTES`. Not validated here — the component's prop type does it. */
  readonly paletteId: string;
  readonly name: string;
  /** One line on who hands this one out. */
  readonly note: string;
  /** Field labels only. Three or four. Never values, never a full list. */
  readonly fields: readonly string[];
}

export interface ExampleCardsCopy {
  readonly heading: string;
  /** The phrase set in `--mk-green-display`. Must appear verbatim in `heading`. */
  readonly accent: string;
  readonly lead: string;
  readonly cards: readonly ExampleCard[];
  readonly more: MarketingLink;
}

export const exampleCards = {
  heading: "A card for each part of your life.",
  accent: "your life.",
  lead: "Every one of them is a filter over the same profile. Change a detail once and every card carrying it is current.",
  cards: [
    {
      id: "business",
      paletteId: "sapphire",
      name: "Business",
      note: "The one you hand out at work.",
      fields: ["Work mobile", "Work email", "Company", "Office address"],
    },
    {
      id: "personal",
      paletteId: "clay",
      name: "Personal",
      note: "For people who already know you.",
      fields: ["Personal mobile", "Personal email", "Home address", "Birthday"],
    },
    {
      id: "limited",
      paletteId: "onyx",
      name: "Limited",
      note: "For someone you just met.",
      fields: ["Name", "Mobile", "Email"],
    },
    {
      id: "side-project",
      paletteId: "pistachio",
      name: "Side project",
      note: "The thing you do on Saturdays.",
      fields: ["Project email", "Website", "Social profile", "Role"],
    },
    {
      id: "family",
      paletteId: "rust",
      name: "Family",
      note: "The details you would not print.",
      fields: ["Personal phone", "Home address", "Emergency contact"],
    },
    {
      id: "corporate",
      paletteId: "periwinkle",
      name: "Corporate",
      note: "Issued by a company, not by you.",
      fields: ["Approved profile", "Title", "Work contacts", "Office location"],
    },
  ],
  more: { href: "/templates", label: "See all nine designs" },
} as const satisfies ExampleCardsCopy;

/* ════════════════════════════════════════════════════════════════════════════════════════
   SECTIONS 7 AND 8 — THE BELIEF AND THE CLOSE.  Brief Sections 9 and 11.

   `belief` is the motivational ending the client asked for: one idea, large type, and no
   visual at all. After six worked sections, empty space is the effect.

   ⚠ THE CLOSE'S CONTROLS ARE NOT THE BRIEF'S YET, AND THAT IS DELIBERATE. The brief's pair is
   "Join the waitlist" and "Contact us". Neither page exists — a button that 404s is a defect,
   not a design decision — so the close carries the one control that works today. The labels and
   targets change in the same step that builds `/waitlist` and `/contact`, which needs one
   decision from the maintainer about where a form submission goes.
   ════════════════════════════════════════════════════════════════════════════════════════ */

export interface BeliefCopy {
  readonly heading: string;
  readonly accent: string;
  readonly body: string;
}

export const belief = {
  heading: "Relationships are too valuable to lose.",
  accent: "too valuable to lose.",
  body: "Contact information is fragmented, incomplete and always changing. Contact Book makes contact management something that maintains itself rather than a list you keep re-typing.",
} as const satisfies BeliefCopy;

export interface CloseCopy {
  readonly headline: string;
  readonly body: string;
  readonly cta: MarketingLink;
}

export const close = {
  headline: "Never lose contact.",
  body: "Make one card, hand it over, and keep it true for as long as you need it.",
  /* ⚠ 2026-09-28: was "Join the waitlist" → `/waitlist`, plus an inline waitlist form. Both
     went with the client's "join the waitlist copy … need removing"; the close now sends a
     reader to the same front door as the hero and the nav. */
  cta: { href: "/signin/phone", label: "Create your card" },
} as const satisfies CloseCopy;

export const pageMeta = {
  description:
    "Contact details expire. Contact Book keeps them current through live, permission-based contact cards \u2014 you share a link, not a file, and the page it opens always reads your details as they are now.",
} as const;


/* ════════════════════════════════════════════════════════════════════════════════════════
   SECTION 6 AND THE `/corporate` PAGE.  Brief Section 8.

   The client's voice note is explicit about the size of this: *"a small section on corporate
   contact book, but there's hardly anything in there at the moment. It's just to say we have a
   corporate contact book solution. Get in touch to hear more about it."* So the homepage band
   is four sentences and a control, and everything with substance lives on `/corporate`.

   ⚠ THE STATISTICS ARE FROM 2013-2015 AND EVERY ONE OF THEM CARRIES ITS SOURCE AND ITS YEAR.
   They are the deck's, and they are the best evidence either document contains that bad contact
   data costs companies money — but a decade-old figure printed bare reads as a current one, and
   that would be misleading rather than persuasive. The year is part of the sentence, not a
   footnote. Ask the client for anything newer; until then these are honest as dated evidence.

   ⚠ THE GARTNER LINE IS PARAPHRASED, NOT QUOTED. The deck carries a long verbatim quotation.
   Reproducing it in full on a public page is someone else's copyright; the claim itself is
   reportable, so it is stated in our own words with the attribution kept.
   ════════════════════════════════════════════════════════════════════════════════════════ */

export interface CorporateStat {
  readonly figure: string;
  readonly claim: string;
  /** Publisher, title and YEAR. Never omit the year — see the note above. */
  readonly source: string;
}

export interface CorporateBenefit {
  readonly title: string;
  readonly body: string;
}

export interface CorporateCopy {
  readonly heading: string;
  readonly accent: string;
  readonly teaser: readonly string[];
  readonly teaserTargets: string;
  readonly teaserCta: MarketingLink;
  readonly pageLead: string;
  readonly problemHeading: string;
  readonly problemLead: string;
  readonly stats: readonly CorporateStat[];
  readonly gartner: string;
  readonly benefitsHeading: string;
  readonly benefits: readonly CorporateBenefit[];
  readonly marketsHeading: string;
  readonly markets: readonly string[];
  readonly closeHeading: string;
  readonly closeBody: string;
  readonly closeCta: MarketingLink;
}

export const corporate = {
  heading: "For companies that cannot afford to lose relationships.",
  accent: "lose relationships.",
  teaser: [
    "Approved corporate cards, employees onboarded onto them, and the relationship data kept by the company rather than by whoever happens to be holding the phone.",
    "When someone leaves, you revoke their access and keep the contacts.",
  ],
  teaserTargets:
    "Built for sales teams, recruiters, alumni networks, professional services firms, and organisations whose people move between countries.",
  teaserCta: { href: "/corporate", label: "Corporate Contact Book" },

  pageLead:
    "Corporate Contact Book gives a company one approved profile format, control over what its people share, and the relationship data itself \u2014 kept centrally, not on individual phones.",

  problemHeading: "Bad contact data is not a tidiness problem.",
  problemLead:
    "It is a cost, and it has been measured. These figures are the ones our own research rests on; they are also a decade old, so read them as evidence that the problem is structural rather than as this year's number.",
  stats: [
    {
      figure: "25%",
      claim: "of the average database's records were inaccurate",
      source: "SiriusDecisions, The Impact of Bad Data on Demand Generation, 2013",
    },
    {
      figure: "40%",
      claim: "of B2B leads contained bad data",
      source: "Integrate, Data Quality Index, January 2015",
    },
    {
      figure: "54%",
      claim:
        "of marketers named a lack of data quality and completeness as their biggest obstacle",
      source: "Ascend2, Data-Driven Marketing Survey, November 2014",
    },
  ],
  gartner:
    "Gartner has put the cost of poor data quality to large enterprises above what those same companies spend on their data warehouse and CRM programmes.",

  benefitsHeading: "What a company gets.",
  benefits: [
    {
      title: "One approved profile format",
      body: "An administrator designs the corporate card and the standard employee profile. Everybody's details are laid out the same way, and it looks like the company rather than like twelve different people.",
    },
    {
      title: "Relationship data the company keeps",
      body: "Contacts an employee makes on their corporate profile belong to the company, held centrally rather than only in one person's phone.",
    },
    {
      title: "Access you can revoke",
      body: "When somebody leaves, their access ends and the contacts stay. A new joiner can be given the same relationships on day one.",
    },
    {
      title: "It feeds the systems you already run",
      body: "Updated, complete contact details can be taken into the CRM you already use, so nobody is keying customer data in by hand.",
    },
  ],

  marketsHeading: "Who it is for.",
  markets: [
    "Sales teams and business development",
    "Recruitment firms",
    "Professional services",
    "Corporate and university alumni networks",
    "International organisations and diplomatic missions",
    "Expat communities and frequent travellers",
  ],

  closeHeading: "Tell us about your organisation.",
  closeBody:
    "Corporate Contact Book is sold per user and set up with you. Tell us the shape of your team and we will come back with specifics.",
  closeCta: { href: "/contact", label: "Contact us" },
} as const satisfies CorporateCopy;


/* ════════════════════════════════════════════════════════════════════════════════════════
   THE TWO FORM PAGES — `/waitlist` and `/contact`.  Brief's extra pages.

   ⚠ WHERE A SUBMISSION GOES IS A CONFIG CHOICE, NOT A CODE CHANGE. Both forms post to
   `/api/leads`, which forwards to `LEAD_WEBHOOK_URL`. Set that to anything that accepts a JSON
   POST — a form service, a Zapier or Make hook, a Slack webhook, or a real endpoint on the API
   when one exists — and both pages start working with no edit. Unset, the route says so
   plainly and each form shows the email fallback below rather than pretending to have saved
   something. See `src/lib/leads.ts`.

   ⚠ THE CONTACT DETAILS ARE FROM THE 2018 DECK AND MUST BE CONFIRMED BEFORE LAUNCH. They are
   seven years old. They appear in exactly one place — `contactDetails` below — so confirming
   them is one edit.
   ════════════════════════════════════════════════════════════════════════════════════════ */

export interface FormPageCopy {
  readonly heading: string;
  readonly accent: string;
  readonly lead: string;
  readonly submitLabel: string;
  readonly successHeading: string;
  readonly successBody: string;
  /** Shown when `LEAD_WEBHOOK_URL` is unset or the delivery failed. Never a dead end. */
  readonly fallbackBody: string;
  readonly privacyNote: string;
}

export const waitlistPage = {
  heading: "Join the waitlist.",
  accent: "waitlist.",
  lead: "We are opening Contact Book to a first group of users. Tell us where to reach you and we will be in touch when it is your turn.",
  submitLabel: "Join the waitlist",
  successHeading: "You are on the list.",
  successBody: "We will be in touch at the address you gave us. Nothing else happens until then.",
  fallbackBody: "We could not record that just now. Email us and we will add you by hand:",
  privacyNote:
    "We use this to tell you when Contact Book opens, and for nothing else. No list is shared and there is nothing to unsubscribe from yet.",
} as const satisfies FormPageCopy;

export const contactPage = {
  heading: "Contact us.",
  accent: "us.",
  lead: "Questions about Contact Book, or about Corporate Contact Book for your organisation. A person reads everything that arrives here.",
  submitLabel: "Send message",
  successHeading: "That is with us.",
  successBody: "We will reply to the address you gave us, usually within a couple of days.",
  fallbackBody: "We could not send that just now. Email us directly:",
  privacyNote: "We use what you send here to reply to you, and for nothing else.",
} as const satisfies FormPageCopy;

/* ════════════════════════════════════════════════════════════════════════════════════════
   THE REAL CARDS THE PAGE RENDERS.

   ⚠ THESE ARE `ContactCard`s, NOT MARKETING COPY, AND THAT IS THE POINT. They are resolved
   through `resolveCard(card, FIXTURE_DB.user, FIXTURE_DB.groups, FIXTURE_DB.fields)` and handed
   to the product's own `<ShareFace>` — the same component, the same 336x500 format, the same QR
   geometry the dashboard ships. Nothing about the card design is re-drawn for the website, so
   nothing about it can drift from the product.

   ⚠ THE PERSON IS `FIXTURE_DB.user` — PRIYANKA RAGHUNATHAN — AND EVERYTHING ELSE ON THE PAGE
   HAD TO MOVE TO MATCH. A real `<ShareFace>` takes its name, role and mark from the resolved
   card, so the hero's front face shows whoever the fixture user is. The animated back face and
   the problem section's before/after were written around a different invented person, and a
   card whose front and back are two different people is not a card. One person, one thread down
   the page.

   ⚠ THE QR ENCODES `publicUrl`, WHICH IS A RESERVED DOMAIN AND DOES NOT RESOLVE. That is the
   same choice `/templates` already makes for its nine live cards, and it is the right one: the
   alternative is pointing a fictional person's card at a page we do serve, which is incoherent,
   or at a real domain, which `fixture-hygiene.test.ts` rejects for good reason. Nothing on the
   page invites a scan, and a QR inside an illustration is how every product screenshot works.
   ════════════════════════════════════════════════════════════════════════════════════════ */

const CARD_OWNER = "user_prya";

/**
 * The person every card on this page belongs to — Maya Laurent, the hero's person, since
 * 2026-09-29 (Maya Lauren from 2026-09-28).
 *
 * ⚠ IT IS `FIXTURE_DB.user`'S SHAPE WITH MAYA'S FACTS. The spread keeps the id (`CARD_OWNER`)
 * and the account flags; everything a reader can see — name, email, number — comes from
 * `marketing-identity.ts`. `fixtures/user.ts` stays Priyanka: that user is threaded through
 * the whole app's tests, and the landing page changing person is not a reason to move them.
 *
 * The number and mailbox are her own, the ones the hero card prints.
 *
 * **No avatar**, deliberately: `avatarUrl` is profile-wide, while a card page's cover is a
 * decision about one card (`ContactCard.coverUrl`). `null` leaves the badge on its logo or
 * monogram, which is the product's own two-slot design.
 */
export const marketingUser: User = {
  ...FIXTURE_DB.user,
  firstName: MAYA.firstName,
  lastName: MAYA.lastName,
  email: MAYA.personalEmail,
  phone: MAYA.mobile.replace(/[^\d+]/g, ""),
  countryCode: "+44",
  avatarUrl: null,
};

/* ════════════════════════════════════════════════════════════════════════════════════════
   THE HERO PHONE'S CARD — the client's reference, word for word.

   2026-09-29: the client rejected the hero's phone card as "just the opposite" of their
   reference render and asked for the reference's own content, fonts, icons and spacing. So the
   card is no longer the product's `<CardPage>` re-resolved per beat; it is a still drawing of
   the reference's card, and this block is its copy — every string below is read off the
   reference image, in its order.

   ⚠ TWO DELIBERATE DEPARTURES, BOTH DOMAINS. The reference prints `maya@contactbook.com` and
   `www.mayapartners.com`. Neither is ours (the client's domain is `contactbookapp.com`, in
   `lib/site.ts`), and `tests/contract/fixture-hygiene.test.ts` admits only RFC 2606 reserved
   domains in a fixture. The mailbox and site keep their shape and move to `.example`.

   ⚠ The +44 7700 900123 number is the reference's own, and it is safe as printed: 07700 900xxx
   is Ofcom's drama range and can never ring anyone.

   2026-09-29, later: the identity file moved to this card's person, so every fact below — name,
   role, company, bio, number, mailbox, home, site — is read from `marketing-identity.ts` and the
   rest of the page draws the same Maya Laurent. What stays here is the reference's layout: its
   script, its labels, its order, and where it breaks the bio.
   ════════════════════════════════════════════════════════════════════════════════════════ */

/** The row glyphs the reference draws, in the order it draws them. */
export type HeroPhoneIcon = "phone" | "mail" | "pin" | "building" | "link";

/** The four social marks under SOCIAL. */
export type HeroPhoneSocial = "linkedin" | "instagram" | "x" | "youtube";

export interface HeroPhoneRow {
  readonly icon: HeroPhoneIcon;
  readonly value: string;
}

export interface HeroPhoneSection {
  readonly label: string;
  readonly rows: readonly HeroPhoneRow[];
}

export interface HeroPhoneCopy {
  /** Read to assistive technology in place of the drawing, which is `inert`. */
  readonly caption: string;
  /** The cover photograph, at 2× and 3× the card's 330px design width. */
  readonly portrait: { readonly x2: string; readonly x3: string };
  /** The handwritten lines over the photograph, one per line. */
  readonly script: readonly string[];
  readonly brand: string;
  readonly name: string;
  readonly role: string;
  readonly company: string;
  /** Two lines, broken where the reference breaks them. */
  readonly bio: readonly [string, string];
  readonly action: string;
  readonly sections: readonly HeroPhoneSection[];
  readonly socialLabel: string;
  readonly social: readonly HeroPhoneSocial[];
}

export const heroPhone = {
  caption:
    `${MAYA.fullName}'s ContactBook card on a phone: her photo, ${MAYA.role} of ${MAYA.company}, a ` +
    "Send to Phone button, and her personal, business and social details.",
  portrait: {
    x2: "/marketing/hero-portrait-2x.webp",
    x3: "/marketing/hero-portrait-3x.webp",
  },
  script: ["Privacy", "Relationships", "Ideas"],
  brand: "ContactBook",
  name: MAYA.fullName,
  role: MAYA.role,
  company: MAYA.company,
  bio: MAYA.bio,
  action: "Send to Phone",
  sections: [
    {
      label: "Personal",
      rows: [
        { icon: "phone", value: MAYA.mobile },
        { icon: "mail", value: MAYA.personalEmail },
        { icon: "pin", value: `${MAYA.home.city}, ${MAYA.home.country}` },
      ],
    },
    {
      label: "Business",
      rows: [
        { icon: "building", value: MAYA.company },
        { icon: "link", value: MAYA.website },
      ],
    },
  ],
  socialLabel: "Social",
  social: ["linkedin", "instagram", "x", "youtube"],
} as const satisfies HeroPhoneCopy;

/* ════════════════════════════════════════════════════════════════════════════════════════
   MAYA LAURENT'S PROFILE — the records the example cards resolve through.

   2026-09-28, the client: the landing page moves from the app's fixture user (an Indian number,
   a Mumbai address) to one person with details in London, Dubai, New York and Singapore;
   2026-09-29 made her the hero's Maya Laurent. The FACTS live in `fixtures/marketing-identity.ts`
   and nothing here restates one: every number, address and email below is read from it. What
   this block adds is the SHAPE — which of those facts is a field, in which group, under which
   label — because `resolveCard` needs real `ProfileField`s and `FIXTURE_DB.fields` (read-only,
   threaded through the whole app's tests) is still Priyanka's.

   How her details are cast, so every section tells one story:
     · Lisbon is home — her mobile (+44 7700, the hero card's) and her home, city only.
     · London is the office on her work card (the address).
     · All four cities are Maya Partners' offices, one office line each.
   Only her mobile reaches a rendered card; the office lines are drawn in how-it-works' profile
   panel alone.

   ⚠ FIELD IDS MATCH `FIXTURE_DB`'S where the meaning matches (`field_mobile`, `field_work_email`,
   `field_linkedin`, …), so a card spec written against the app fixture resolves against this
   set too; the office lines and `field_experience` are new ids with no app-side twin.
   ════════════════════════════════════════════════════════════════════════════════════════ */

const MAYA_HOME = mayaFacts.MAYA.home;
const MAYA_OFFICE = mayaFacts.mayaCity("london");

/** Display form → the stored E.164 form. The identity file carries the display form only. */
function storedPhone(display: string): string {
  return display.replace(/[^\d+]/g, "");
}

export interface MayaProfile {
  readonly groups: readonly FieldGroup[];
  readonly fields: readonly DomainProfileField[];
}

/** The four office lines, one per city, in the identity file's order. */
const MAYA_OFFICE_LINES: readonly DomainProfileField[] = mayaFacts.MAYA_CITIES.map((city) => ({
  id: `field_${city.id.replace("-", "_")}_office`,
  groupId: "group_work",
  type: "LANDLINE",
  label: `${city.city} office`,
  value: storedPhone(city.phone),
  isSensitive: false,
}));

export const mayaProfile: MayaProfile = {
  groups: [
    {
      id: "group_identity",
      userId: CARD_OWNER,
      category: "IDENTITY",
      name: "Identity",
      fieldIds: ["field_experience", "field_dob"],
    },
    {
      id: "group_personal",
      userId: CARD_OWNER,
      category: "PERSONAL",
      name: "Personal",
      fieldIds: ["field_mobile", "field_personal_email", "field_home_address"],
    },
    {
      id: "group_work",
      userId: CARD_OWNER,
      category: "WORK",
      name: "Work",
      fieldIds: [
        "field_job_title",
        "field_company",
        "field_work_email",
        "field_work_address",
        ...MAYA_OFFICE_LINES.map((field) => field.id),
        "field_site_url",
      ],
    },
    {
      id: "group_social",
      userId: CARD_OWNER,
      category: "SOCIAL",
      name: "Social",
      fieldIds: ["field_linkedin"],
    },
  ],
  fields: [
    /* ── IDENTITY ── the first mapped TEXT field is a card's bio, so this is the CV card's. */
    {
      id: "field_experience",
      groupId: "group_identity",
      type: "TEXT",
      label: "Experience",
      value: "Twelve years connecting people, ideas and opportunities across Europe, the Gulf, the US and Asia.",
      isSensitive: false,
    },
    {
      id: "field_dob",
      groupId: "group_identity",
      type: "DATE",
      label: "Birthday",
      value: "1990-06-14",
      /* Shared on purpose: the family card exists to carry it. A sensitive field renders masked
         on a public page, which would turn the family card's one personal row into "••••". */
      isSensitive: false,
    },

    /* ── PERSONAL ── Lisbon is home. */
    {
      id: "field_mobile",
      groupId: "group_personal",
      type: "PHONE",
      label: "Mobile",
      value: storedPhone(mayaFacts.MAYA.mobile),
      isSensitive: false,
    },
    {
      id: "field_personal_email",
      groupId: "group_personal",
      type: "EMAIL",
      label: "Personal email",
      value: mayaFacts.MAYA.personalEmail,
      isSensitive: false,
    },
    {
      id: "field_home_address",
      groupId: "group_personal",
      type: "ADDRESS",
      label: "Home",
      value: `${MAYA_HOME.city}, ${MAYA_HOME.country}`,
      isSensitive: false,
      /* No street: the identity gives her home as a city, as the hero card does, and an empty
         `line1` drops out of `formatAddressLines`, so the row prints "Lisbon, Portugal". */
      detail: {
        kind: "ADDRESS",
        line1: "",
        line2: null,
        city: MAYA_HOME.city,
        region: null,
        postalCode: null,
        country: MAYA_HOME.country,
      },
    },

    /* ── WORK ── */
    {
      id: "field_job_title",
      groupId: "group_work",
      type: "JOB_TITLE",
      label: "Role",
      value: mayaFacts.MAYA.role,
      isSensitive: false,
    },
    {
      id: "field_company",
      groupId: "group_work",
      type: "COMPANY",
      label: "Company",
      value: mayaFacts.MAYA.company,
      isSensitive: false,
    },
    {
      id: "field_work_email",
      groupId: "group_work",
      type: "EMAIL",
      label: "Work email",
      value: mayaFacts.MAYA.workEmail,
      isSensitive: false,
    },
    {
      id: "field_work_address",
      groupId: "group_work",
      type: "ADDRESS",
      label: "Office",
      value: MAYA_OFFICE.address,
      isSensitive: false,
      detail: {
        kind: "ADDRESS",
        line1: "14 Wren Yard",
        line2: null,
        city: MAYA_OFFICE.city,
        region: null,
        postalCode: "EC2A 4NE",
        country: MAYA_OFFICE.country,
      },
    },
    ...MAYA_OFFICE_LINES,
    {
      id: "field_site_url",
      groupId: "group_work",
      type: "URL",
      label: "Website",
      value: `https://${mayaFacts.MAYA.website}`,
      isSensitive: false,
    },

    /* ── SOCIAL ── */
    {
      id: "field_linkedin",
      groupId: "group_social",
      type: "SOCIAL_LINK",
      label: "LinkedIn",
      value: `https://www.${mayaFacts.MAYA.linkedin}`,
      isSensitive: false,
    },
  ],
};

export interface ExampleCardSpec {
  readonly id: string;
  /** What this card is for. The card itself carries the fields. */
  readonly name: string;
  readonly card: ContactCard;
}

/**
 * Maya's three cards, as real cards — the deck in `solution` and the deck in `how-it-works`.
 *
 * ⚠ THREE, AND THEY ARE THE CLIENT'S THREE: work, CV (the headhunter card) and family
 * (2026-09-28). The six-card set this replaces (business, personal, limited, side-project,
 * family, corporate) fed a cards section removed on 2026-09-19; only three were still rendered,
 * and "Just met" gives way to the CV card on the client's word.
 *
 * ⚠ THEY DIFFER IN CONTENT AS WELL AS COLOUR. Each `fieldIds` list is a different subset of
 * `mayaProfile`, and `solution.cards[].fields` mirrors each one chip for chip — change both
 * together.
 *
 * ⚠ AND THEY ALL USE ONE TEMPLATE (`meridian`). Colour and content vary; the FORMAT does not.
 */
export const exampleCardSpecs: readonly ExampleCardSpec[] = [
  {
    id: "work",
    name: "Work",
    card: {
      id: "card_mk_work",
      userId: CARD_OWNER,
      name: "Work",
      type: "BUSINESS",
      isSensitive: false,
      publicUrl: "https://card.example/c/3nR8xA5oSu9Mq2YdWc4Jt0",
      templateId: "meridian",
      paletteId: "sapphire",
      fieldIds: [
        "field_job_title",
        "field_company",
        "field_mobile",
        "field_work_email",
        "field_work_address",
        "field_linkedin",
      ],
      updatedAt: "2026-09-28T09:00:00.000Z",
    },
  },
  {
    id: "family",
    name: "Family",
    card: {
      id: "card_mk_family",
      userId: CARD_OWNER,
      name: "Family",
      type: "PERSONAL",
      isSensitive: true,
      publicUrl: "https://card.example/c/4oS9yB6pTv0Nr3ZeXd5Ku1",
      templateId: "meridian",
      paletteId: "clay",
      fieldIds: ["field_mobile", "field_personal_email", "field_home_address", "field_dob"],
      updatedAt: "2026-09-28T09:00:00.000Z",
    },
  },
  {
    id: "cv",
    name: "CV",
    card: {
      id: "card_mk_cv",
      userId: CARD_OWNER,
      name: "CV",
      type: "CUSTOM",
      isSensitive: false,
      publicUrl: "https://card.example/c/5pT0zC7qUw1Os4AfYe6Lv2",
      templateId: "meridian",
      paletteId: "onyx",
      fieldIds: [
        "field_experience",
        "field_job_title",
        "field_mobile",
        "field_personal_email",
        "field_linkedin",
      ],
      updatedAt: "2026-09-28T09:00:00.000Z",
    },
  },
];


