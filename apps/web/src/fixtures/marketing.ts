import { FIXTURE_DB } from "@/fixtures";
import type { ContactCard, User } from "@/types/domain";

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
  /* The brief's own pair, now that both destinations exist. Until they did, these read
     "Create your card" / "See the cards" — a control whose page 404s is a defect rather than a
     design decision, and swapping the labels in was the last step of building the routes. */
  primary: { href: "/waitlist", label: "Join the waitlist" },
  secondary: { href: "/corporate", label: "For companies" },
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
   THE HERO'S LIVE CARD — the animation the client asked for, written as data.

   The brief: "a visual of contact cards being updated... a card in the middle, you see the
   fields updating, flying off, updating, new ones, new fields coming in, existing fields
   changing and being updated."

   ## Why this is a script and not an animation
   The card component knows how to draw a row in five states and nothing else. Everything
   about WHAT happens and WHEN lives here, as a list of beats, each one a complete picture of
   the card at that moment. That split is the whole design:
     · the timing is tunable without touching a component
     · every beat is a state the card can legally render, so there is no frame mid-flight that
       nobody chose — a visitor who arrives at beat 3 sees a card someone designed
     · the same script drives the still image under reduced motion (beat 0)

   ## Why beat 0 is a plain, finished card
   It is three things at once: what the server renders, what a reader with reduced motion sees
   forever, and what the loop returns to. So it may not carry a marker, a strike-through or an
   empty slot — the first paint has to be a card that looks correct and complete, because for
   some readers it is the only one they will ever see.

   ## The five verbs, in the client's own order
   stale (a field goes wrong) → update (it is corrected) → arrive (a new field) → revoke (a
   field is taken back). The fourth is ours: "you can take a card back" is one of the product's
   real promises and no other section demonstrates it.

   ⚠ NUMBERS AND DOMAINS. `+44 20 7946 0xxx` is Ofcom's range reserved for drama — it cannot
   be allocated to a real subscriber. Domains are RFC-2606 reserved, which
   `tests/contract/fixture-hygiene.test.ts` enforces as an allowlist. The deck this content
   came from contains the founder's real friends and their real mobile numbers; none of it
   crosses into a fixture.
   ════════════════════════════════════════════════════════════════════════════════════════ */

/**
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

export interface LiveCardBeat {
  readonly id: string;
  /** Milliseconds this beat is held before the next one begins. */
  readonly hold: number;
  /**
   * Suppresses row transitions for this beat only.
   *
   * Set on the beat the loop returns to. Without it the corrected values visibly slide
   * *backwards* into their old selves on every repeat, which reads as the animation breaking
   * rather than restarting.
   */
  readonly reset?: boolean;
  readonly rows: readonly LiveCardRow[];
}

export interface LiveCardCopy {
  readonly name: string;
  readonly role: string;
  readonly mark: string;
  /** Announced once to assistive technology in place of the loop. */
  readonly caption: string;
  readonly beats: readonly LiveCardBeat[];
}

const EMAIL_OLD = "priyanka@fernwood.example";
const EMAIL_NEW = "p.raghunathan@haldenroe.example";
const FIRM_OLD = "Fernwood Studio";
const FIRM_NEW = "Halden & Roe";
const MOBILE = "+91 98201 15577";

export const liveCard = {
  /* ⚠ THE IDENTITY IS `FIXTURE_DB.user`'s, AND IT HAS TO BE. This card is the BACK of the
     hero's flip; the front is a real `<ShareFace>` resolved from `heroCard`, which takes its
     name and role from the fixture user. A card whose two faces show two different people is
     not a card. Change one of these and you must change the fixture user. */
  name: "Priyanka Rao",
  role: "Head of Partnerships",
  mark: "CB",
  caption:
    "A contact card updating itself: two details go out of date and are corrected, one is " +
    "revoked by its owner, and a new one takes its place.",
  beats: [
    {
      id: "settle",
      hold: 2400,
      reset: true,
      rows: [
        { id: "mobile", label: "Mobile", value: MOBILE, state: "stable" },
        { id: "email", label: "Work email", value: EMAIL_OLD, state: "stable" },
        { id: "company", label: "Company", value: FIRM_OLD, state: "stable" },
        { id: "role", label: "Role", value: "Head of Partnerships", state: "stable" },
        { id: "home", label: "Home", value: "Bandra West, Mumbai", state: "stable" },
      ],
    },
    {
      /* She changed firm. Three rows are now wrong and nothing in the world has told you. This
         is the beat that has to land — it is the reader's own address book. */
      id: "stale",
      hold: 1600,
      rows: [
        { id: "mobile", label: "Mobile", value: MOBILE, state: "stable" },
        { id: "email", label: "Work email", value: EMAIL_OLD, state: "stale" },
        { id: "company", label: "Company", value: FIRM_OLD, state: "stale" },
        { id: "role", label: "Role", value: "Head of Partnerships", state: "stable" },
        { id: "home", label: "Home", value: "Bandra West, Mumbai", state: "stable" },
      ],
    },
    {
      id: "update",
      hold: 2000,
      rows: [
        { id: "mobile", label: "Mobile", value: MOBILE, state: "stable" },
        { id: "email", label: "Work email", value: EMAIL_NEW, state: "updated", was: EMAIL_OLD },
        { id: "company", label: "Company", value: FIRM_NEW, state: "updated", was: FIRM_OLD },
        { id: "role", label: "Role", value: "Head of Partnerships", state: "stable" },
        { id: "home", label: "Home", value: "Bandra West, Mumbai", state: "stable" },
      ],
    },
    {
      /* Revoked, not deleted from the world: she took her home address off this card and the
         page it points at stopped showing it.

         ⚠ THE LEAVING ROW KEEPS ITS OWN SLOT. A row's slot is its index in this list, so
         promoting the row below it here would have the two trade places mid-fade — one sliding
         up through the other sliding down, which reads as a shuffle rather than a removal. */
      id: "revoke",
      hold: 1500,
      rows: [
        { id: "mobile", label: "Mobile", value: MOBILE, state: "stable" },
        { id: "email", label: "Work email", value: EMAIL_NEW, state: "stable" },
        { id: "company", label: "Company", value: FIRM_NEW, state: "stable" },
        { id: "role", label: "Role", value: "Head of Partnerships", state: "stable" },
        { id: "home", label: "Home", value: "Bandra West, Mumbai", state: "leaving" },
      ],
    },
    {
      /* A field the card did not have, arriving into the slot the revoked one vacated. */
      id: "arrive",
      hold: 1700,
      rows: [
        { id: "mobile", label: "Mobile", value: MOBILE, state: "stable" },
        { id: "email", label: "Work email", value: EMAIL_NEW, state: "stable" },
        { id: "company", label: "Company", value: FIRM_NEW, state: "stable" },
        { id: "role", label: "Role", value: "Head of Partnerships", state: "stable" },
        { id: "site", label: "Website", value: "haldenroe.example", state: "arriving" },
      ],
    },
    {
      id: "settled",
      hold: 2200,
      rows: [
        { id: "mobile", label: "Mobile", value: MOBILE, state: "stable" },
        { id: "email", label: "Work email", value: EMAIL_NEW, state: "stable" },
        { id: "company", label: "Company", value: FIRM_NEW, state: "stable" },
        { id: "role", label: "Role", value: "Head of Partnerships", state: "stable" },
        { id: "site", label: "Website", value: "haldenroe.example", state: "stable" },
      ],
    },
  ],
} as const satisfies LiveCardCopy;

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
  /* Priyanka's entry as it sits in your phone two years after you saved it. The SAME person as
     the hero's card — which is the fixture user, because the hero's front face is a real
     `<ShareFace>` and takes its identity from the resolved card. One person, one thread down the
     page, rather than three unrelated examples. */
  beforeRows: [
    /* `stale: false` is written out rather than omitted. With `as const satisfies`, an absent
       optional field is absent from that member's literal type, so a consumer reading
       `row.stale` gets a type error on this row alone — the narrowing is the point of
       `as const` and this is the cost of it. */
    { id: "mobile", label: "Mobile", value: "+91 98201 15577", stale: false },
    { id: "email", label: "Work email", value: "priyanka@fernwood.example", stale: true },
    { id: "company", label: "Company", value: "Fernwood Studio", stale: true },
    { id: "role", label: "Role", value: "Head of Partnerships", stale: true },
  ],
  caption:
    "Three of these four were true when you saved them. Nothing told you when they stopped being true.",
} as const satisfies ProblemCopy;

/* ════════════════════════════════════════════════════════════════════════════════════════
   SECTION 3 — THE SOLUTION.  Brief Section 3, and the section that carries the product idea.

   `heading` and the first line are the client's. The last paragraph is ours and it is the most
   important sentence on the page — see the note on `honesty` below.

   ## The exhibit is the argument, not an illustration of it
   One profile on the left, three cards on the right. Choose a card and the profile dims to the
   fields that card actually carries. "A card is a filter over your profile, not a second copy
   of it" is a sentence a visitor has to take on trust; the same claim as something they can
   press is a claim they can check. That is why the deleted `trust` section's four panels are
   not four panels any more.

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
  readonly name: string;
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
  readonly honesty: { readonly term: string; readonly detail: string };
  readonly profileLabel: string;
  readonly cardsLabel: string;
  readonly privateTag: string;
  readonly allLabel: string;
  readonly profile: readonly ProfileField[];
  readonly cards: readonly SolutionCard[];
}

export const solution = {
  heading: "Live contact cards, shared your way.",
  accent: "shared your way.",
  lead: "A card is a filter over your profile, not a second copy of it.",
  paragraphs: [
    "Make a work card, a family card, a side-project card, or one that carries nothing but a name and a number for someone you have just met. Each one shows only the fields you put on it.",
    "Sharing a card is not sending your details. It is giving someone access to the fields you chose \u2014 and when those change, what they are looking at changes with them.",
  ],
  /* ⚠ THIS PARAGRAPH MAY NOT BE CUT, AND IT IS THE ONE PLACE THIS PAGE ARGUES WITH ITS OWN
     BRIEF. The brief says, twice, that recipients "receive the updated information
     automatically". The product deliberately does not do that, and the previous page had a
     whole section explaining why. The claim is split rather than dropped: the *card* is always
     current, because the page resolves from live data at request time; the copy *inside
     someone's address book* changes when you send an update and they accept it. Raised with the
     client as an open question — if they insist on "automatically", that is theirs to decide
     knowingly. It is also the only thing on this page a competitor cannot say. */
  honesty: {
    term: "What that does not mean",
    detail:
      "No app can reach into someone else's phone and rewrite your entry \u2014 not on iPhone, not on Android, and be suspicious of any product implying it can. The card at your link is always current. To update the copy in their address book, you send the change and they tap once to save it.",
  },
  profileLabel: "Your profile",
  cardsLabel: "Your cards",
  privateTag: "Private",
  allLabel: "Everything you have added",
  profile: [
    { id: "mobile", label: "Mobile" },
    { id: "work-email", label: "Work email" },
    { id: "personal-email", label: "Personal email" },
    { id: "company", label: "Company" },
    { id: "title", label: "Job title" },
    { id: "office", label: "Office address" },
    { id: "home", label: "Home address" },
    { id: "site", label: "Website" },
    { id: "social", label: "LinkedIn" },
    { id: "whatsapp", label: "WhatsApp" },
    { id: "birthday", label: "Birthday" },
    { id: "bank", label: "Bank account", private: true },
  ],
  cards: [
    {
      id: "work",
      name: "Work",
      note: "The one you hand out at a conference.",
      paletteId: "sapphire",
      fields: ["mobile", "work-email", "company", "title", "office", "social"],
    },
    {
      id: "family",
      name: "Family",
      note: "People who already know where you live.",
      paletteId: "clay",
      fields: ["mobile", "personal-email", "home", "birthday", "whatsapp"],
    },
    {
      id: "just-met",
      name: "Just met",
      note: "Enough to be reachable, and nothing else.",
      paletteId: "onyx",
      fields: ["mobile", "work-email"],
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
}

export const howItWorks = {
  heading: "How it works.",
  accent: "works.",
  steps: [
    {
      ordinal: "01",
      title: "Create your details",
      body: "Add your contact information once \u2014 personal, professional, digital, and anything custom you need.",
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
  cta: { href: "/waitlist", label: "Join the waitlist" },
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
 * The person every card on this page belongs to.
 *
 * ⚠ IT IS `FIXTURE_DB.user` WITH TWO CHANGES:
 *
 *   · **A surname that fits.** Shortened here rather than in `fixtures/user.ts`, because that
 *     user is threaded through the whole app's tests and a rename there is a change to surfaces
 *     this work is not touching. This no longer guards a hard one-line clamp — `<CardPage>`'s
 *     name wraps to two lines by design (`textWrap: "balance"`), unlike the old `<ShareFace>`
 *     this comment used to describe — but there is no reason to prefer the longer form either,
 *     so it stays.
 *   · **No avatar.** See {@link HERO_COVER_URL} below for where a real photograph plugs in, and
 *     why `avatarUrl` is deliberately not it: `avatarUrl` is profile-wide (every card this user
 *     owns), while a card page's cover is a decision made about *one* card — `ContactCard
 *     .coverUrl`, which `resolveCover` (`@/card/resolve-card`) already ranks ahead of it for
 *     exactly that reason. `null` here leaves the badge on its monogram fallback, which is
 *     shipped behaviour and reads as designed rather than as a missing image — see
 *     `resolveBadge`, which never falls back to a photograph at all: the badge is the brand
 *     mark, not the face, by the product's own two-slot design (`ResolvedCover` vs.
 *     `ResolvedBadge` in `@/types/domain`).
 */
export const marketingUser: User = {
  ...FIXTURE_DB.user,
  lastName: "Rao",
  avatarUrl: null,
};

/**
 * ⚠ NO PHOTOGRAPH ASSET EXISTS FOR THIS CARD, AND AN AUTHORED SVG NOW EXISTS AS ITS
 * UNDERSTUDY — BENCHED, NOT DELETED. Read this whole comment before flipping the constant below.
 *
 * `public/portraits/*.png` (what `fixtures/user.ts` points real fixture users at) are
 * procedurally generated silhouettes — green, and the wrong hue for Atelier's warm ground even
 * setting that aside. `public/templates/*.png` are blurred dark abstracts, wrong for the same
 * reason. There is no image-generation credential configured to make a better one, and this
 * file must not fake a face by guessing or fetching one from somewhere else.
 *
 * `public/marketing/hero-cover.svg` was authored to answer that (the client's own words: "why is
 * there no logo or cover images there?") — a small, hand-drawn abstract in the atelier skin's own
 * gold tokens, viewBox'd to `COVER_RATIO.photo`'s exact aspect so nothing crops. It is genuinely
 * ready: `resolveCover` already ranks `ContactCard.coverUrl` ahead of every other source, so
 * turning it on is truly the one-line change the comment below describes.
 *
 * ⚠ MEASURED 2026-09-20, AND IT IS OFF FOR A REASON A LOOK CANNOT SEE. Turning a cover on moves
 * `cardPageSurface`'s `coverRatio` from `COVER_RATIO.none` (0.3) to `COVER_RATIO.photo` (0.7) —
 * `@/card/card-page-rows` — which is `+134px` at this card's fixed 336px hero width
 * (`0.4 * 336 = 134.4`), before a single row changes. Measured with the cover ON and every other
 * trim on this page already applied (three PERSONAL rows, two WORK rows, the one-line `bio`
 * below, the logo badge): the SOCIAL strip's own bottom sat **~112px past** the 728px screen —
 * almost exactly what the earlier, unshortened two-line bio and the un-swapped `field_status`
 * row had cost between them, because the cover alone re-spent nearly everything those two trims
 * had bought back. Closing the rest, with the cover still ON, has no more free rows left to give:
 * by arithmetic (not separately re-measured), it needs the company wordmark gone AND the bio
 * gone entirely AND WORK down to one row, to land within single-digit pixels of clearing the
 * screen — three cuts nothing in this task asked for, to recover roughly 112px. That is a worse
 * card than a shorter one with no cover: it trades a real, requested complaint ("no social
 * visible") for an unrequested one ("no company, no bio"), to buy a decorative image.
 *
 * So the call made here is priority order, taken from this task's own wording: fitting the
 * social strip inside the screen was named "the single most important outcome"; the cover was
 * asked for afterwards, as its own numbered step. With the cover OFF and every other trim below
 * applied, the strip clears the screen with **23px to spare** (measured, `deviceScaleFactor: 2`,
 * 1440px and 375px viewports, both skins — see the report this pass shipped with for the exact
 * numbers). That is the shape shipped by default.
 *
 * ⚠ THIS IS A ONE-LINE, FULLY REVERSIBLE CALL, NOT A DELETED FEATURE. If the cover is wanted
 * live regardless of the height cost — a defensible, different call, since the client did ask
 * for it by name — changing the line below from `null` to `"/marketing/hero-cover.svg"` is the
 * entire change; nothing else in this file or in `src/card/**` needs to move with it. Re-measure
 * after: `tests/e2e/marketing.spec.ts` currently asserts the hero makes zero image requests
 * ("the fixture card carries no cover photo"), which turning this on makes stale and which its
 * owner would need to widen to allow exactly one request, for exactly this path.
 *
 * Whenever the client's own photograph arrives, it replaces the SVG at the same switch:
 *
 *   1. Drop the file at `apps/web/public/marketing/hero-cover.jpg` (served at
 *      `/marketing/hero-cover.jpg` — a new path, not a reuse of either unusable set above).
 *   2. Change the constant below to `"/marketing/hero-cover.jpg"`.
 *
 * `<CardCover>` reads `resolved.cover` straight through however it got there, already crops to
 * `objectPosition: "50% 28%"` (a portrait's upper third, not a centred crop that takes the chin
 * off), and already scrims its own lower edge for the curve underneath it — none of that is new
 * with this pass. What is new is that a real photograph reopens the same +134px question this
 * comment measures for the SVG, on whatever this card's row count is by then.
 */
const HERO_COVER_URL: string | null = "/marketing/hero-cover.jpg";

/**
 * The hero's card — the same fixture triad every other real card on this page resolves through
 * (`marketingUser`, `FIXTURE_DB.groups`, `FIXTURE_DB.fields`), rendered by the product's own
 * `<CardPage>` with no hand-built stand-in for any of it (`hero-card.tsx`'s own header explains
 * why that file resolves this card itself rather than taking one as a prop).
 *
 * ⚠ ENRICHED 2026-09-20, THE SAME DAY THE CLIENT CALLED THE RESULT "VAGUE AND AI-MADE". The
 * card this fixture described before that day mapped five fields, every one of them `WORK` — so
 * the complaint was an accurate diagnosis of this exact object: one unlabelled section, no
 * social strip, and a bio that could never appear because nothing here supplied one distinct
 * from the role/company line already under the name. `<CardPage>` renders exactly what it is
 * handed; it was handed almost nothing. Nothing added by that pass invented a value — every id
 * already existed in `fixtures/profile.ts`, mapped to rows other real cards in this app already
 * render — and the shape it settled on was two labelled `FieldCategory` sections
 * (`resolveCard`'s `compareResolvedFields` sorts category first) plus a social strip, which is
 * the split the client's own reference shows and a single-category card cannot.
 *
 * ⚠ TRIMMED, LATER THE SAME DAY, AGAINST A MEASUREMENT RATHER THAN A LOOK. The enrichment above
 * was correct about *shape* and wrong about *size*: at this card's fixed 336px hero width
 * (`hero-card.tsx`'s `SCREEN_WIDTH`), fourteen mapped fields rendered the card at 1019px against
 * the hero's own 728px phone screen (`marketing-hero.css`'s `.mk-phone-frame__screen` — 336px
 * wide at a 9/19.5 device ratio) — 291px clipped, the social strip entirely inside that clip.
 * The client's reference fits a cover, a logo, a name, a role, a two-line bio, the action
 * button, three PERSONAL rows, two WORK rows and the full SOCIAL strip on one screen, so that is
 * the shape this card was cut back to:
 *
 *   · `field_job_title` and `field_company` are still consumed whole by `<CardPage>`'s own hero
 *     (`splitHeroFields`) into the wordmark and the name's role line, and still never become a
 *     stack row. `field_bio` is gone from this list entirely — see {@link heroCard.bio} below
 *     for what replaced it and why removing the id, not just shortening the field, was the
 *     correct fix.
 *   · PERSONAL keeps all three of its rows — it was already the reference's shape — though the
 *     third one changed identity; see the comment on `field_location` below `fieldIds`.
 *   · WORK drops from four rows to two. Gone: `field_work_phone` (a second phone number, and
 *     `field_mobile` above already puts one PHONE row on the card) and `field_work_address` (an
 *     `ADDRESS` row, which prints 1–2 lines and was the single tallest row in the old stack).
 *     Kept: `field_work_email` and `field_site_url` — one internal action (`mailto:`) and one
 *     external one (a website), which is more variety per row than a second phone would have
 *     been.
 *   · SOCIAL drops `field_github`. The remaining three owner-mapped platforms (`LinkedIn`, `X`,
 *     `Instagram`) each still have a real drawn mark in `social-glyphs.tsx` rather than falling
 *     back to the generic glyph, and — plus whichever `PHONE` row `whatsappActionFor` finds,
 *     which the strip appends as an undeclared fourth disc (`card-page.tsx`'s own note on why
 *     WhatsApp is derived from the card rather than mapped as a field) — that is four, matching
 *     the reference's own count and keeping the strip to one line at this card's width.
 *
 * ⚠ `logoUrl` TURNS ON IN THIS SAME PASS; `coverUrl` DOES NOT, AND THAT ASYMMETRY IS
 * DELIBERATE, NOT AN OMISSION. Both are the other half of the client's complaint ("why is there
 * no logo or cover images there?"), and both are backed by a real asset this pass authored
 * (`public/marketing/logo-mark.svg`, `public/marketing/hero-cover.svg`). The logo costs nothing —
 * it fills a badge that already reserves 64px whether it holds a mark or a monogram. The cover
 * costs `+134px` on its own (`COVER_RATIO.photo` vs `.none`, `@/card/card-page-rows` —
 * `0.4 * 336 = 134.4`) and, measured with it on, re-clips the SOCIAL strip almost back to where
 * this pass started. See `HERO_COVER_URL`'s own comment, above, for the full measurement and
 * exactly how to turn it on anyway.
 */
export const heroCard = {
  id: "card_marketing_hero",
  userId: CARD_OWNER,
  name: "Work",
  type: "BUSINESS",
  isSensitive: false,
  publicUrl: "https://card.example/c/2mQ7wZ4nRt8Lp1XcVb3Hs9",
  templateId: "meridian",
  /* ⚠ WAS `emerald` UNTIL 2026-09-20, AND THE REASON IT MOVED IS NOT "gold is nicer".
     The page around this card became Atelier — a warm off-white ground with a gold ladder — and
     a deep green cover is then the single most saturated thing in the first viewport, pulling
     the eye to the one element that is NOT the brand. `ivory` (#E7D6BA) is the warm ground in
     the same nine-palette set, so the hero reads as one composition.

     THIS IS A FIXTURE CHOICE, NOT A SYSTEM CHANGE. All eleven palettes still exist and a real
     owner still picks their own — `template-palettes.ts` is deliberately untouched, because a
     card's colour belongs to the person who made it. What changed is which card this page holds
     up as its example, which is exactly the kind of decision a fixture is for. */
  paletteId: "ivory",
  /**
   * ⚠ ADDED 2026-09-20 — THE OTHER HALF OF "WHY IS THERE NO LOGO … THERE?". `resolveBadge`
   * (`@/card/resolve-card`) puts a card's own `logoUrl` ahead of the owner's initials for the
   * circular badge that straddles the curve, so this is what now shows in place of the "PR"
   * monogram. `public/marketing/logo-mark.svg` is authored for this fixture — two interlocking
   * rings in `--mk-accent-tint` (#C1A88A, the atelier skin's own decorative gold) rather than a
   * literal letterform — see that file's own header for the shape and why it survives being
   * clipped to a circle.
   */
  logoUrl: "/marketing/logo-mark.svg",
  /**
   * `HERO_COVER_URL` — see its own comment, above, for the full account. Short version: an
   * authored SVG cover exists and is genuinely wired (`resolveCover` reads this straight
   * through), but the constant it reads from is `null` by measurement, not by omission — turning
   * it on costs `+134px` and re-clips the SOCIAL strip this pass exists to un-clip. One-line
   * change if that trade is ever wanted the other way.
   */
  coverUrl: HERO_COVER_URL,
  /**
   * ⚠ ADDED 2026-09-20, AND THE REASON IS SUBTRACTION, NOT ADDITION. `field_bio`'s own text —
   * "Builds the studio's telecom and fintech alliances across South Asia. Ex-product, still
   * writes the deck." — wraps to three lines at this card's `32ch` bio width (the bio's own
   * `maxWidth` in `card-page.tsx`), which was the single largest piece of the 291px this card
   * had to lose. `ContactCard.bio` outranks `resolveBio`'s derivation entirely (`resolve-card
   * .ts`'s own comment on the precedence), so writing a shorter one HERE — rather than trying to
   * shorten `fixtures/profile.ts`'s `field_bio`, which other real cards in this app also read —
   * is what let this card get a tagline without touching a shared fixture. `field_bio` is
   * deliberately no longer in `fieldIds` below: this string replaces what it would have shown,
   * so leaving the id mapped as well would have re-added the same sentence as a stray, unlabelled
   * row the moment its wording stopped matching this one verbatim (`heroBio`'s suppression is
   * exact-text, not "already covered").
   *
   * ⚠ ONE LINE, NOT THE TWO THE REFERENCE SHOWS — MEASURED, NOT ROUNDED DOWN FROM TASTE. A
   * genuinely two-line version ("Partnerships across South Asia's telecom and fintech scene.",
   * 61 characters) still measured 48px here; this 33-character line measures 24px, one line at
   * this card's `text-lg`/1.42 metrics. The 24px was needed: see `HERO_COVER_URL`'s comment for
   * the budget it closes. If the cover is ever turned back on, revisiting this line first is
   * cheaper than cutting a row.
   */
  bio: "South Asia telecom partnerships.",
  fieldIds: [
    /* Consumed whole by the identity block — see the module note above. Never rendered as a
       row. `field_bio` is NOT here — see the comment on `bio`, just above. */
    "field_job_title",
    "field_company",
    /* PERSONAL — a phone, an inbox, and a third, unmasked note row. Section kept at three rows
       throughout, per the reference's shape; which THIRD field fills it changed on 2026-09-20
       (below).
       ⚠ NOT `field_home_address`: it is `isSensitive: true` in `fixtures/profile.ts`, and
       `isMaskedField` (`@/card/field-renderers`) masks on THAT flag as much as on field type —
       "encrypted at rest" (CLAUDE.md's non-negotiable #6) names three financial types, but
       masked-on-the-public-surface (§7.3) is broader and correctly catches anything an owner
       marked sensitive. Rendered, it is a label plus `••••ndia` — a generic tail-reveal applied
       to a full street address, which reads as a cut-off string to someone meeting this card
       for the first time, not as a privacy feature. `field_home_landline` and `field_relation`
       are `isSensitive: true` for the same reason and are excluded for the same one. */
    "field_mobile",
    "field_personal_email",
    /* ⚠ WAS `field_status` ("Taking partnership intros this quarter") UNTIL 2026-09-20's height
       pass. Both are unmasked `note` rows and neither is an ambiguous fourth button, which was
       the whole case for this slot — but `field_status`'s 39-character value wraps to two lines
       at this card's width (measured: a 56px row instead of the 44px floor), and that spare
       12px was worth having once a photo-ratio cover made every pixel above the social strip
       contested. `field_location`'s `LOCATION_TRACKING` value is a §7.3 status chip, never a
       coordinate, and at 27 characters it clears one line. */
    "field_location",
    /* WORK — trimmed from four rows to two on 2026-09-20. Dropped: `field_work_phone` (a
       second PHONE row when `field_mobile` above already carries one) and `field_work_address`
       (an `ADDRESS` row, 1–2 lines, the tallest row in the section it left). Kept: one internal
       action and one external one, which is more variety per row than the two dropped were
       buying. */
    "field_work_email",
    "field_site_url",
    /* SOCIAL — real per-platform marks only (see the module note above). `field_github` came
       out on 2026-09-20: three owner-mapped platforms plus the strip's own derived WhatsApp
       disc (`whatsappActionFor`, off `field_mobile` above) is four, matching the reference's
       own count and keeping the strip to one line at this card's width. */
    "field_linkedin",
    "field_x",
    "field_instagram",
  ],
  updatedAt: "2026-09-09T09:00:00.000Z",
} as const satisfies ContactCard;

export interface ExampleCardSpec {
  readonly id: string;
  /** What this card is for, shown under it. The card itself carries the fields. */
  readonly name: string;
  readonly card: ContactCard;
}

/**
 * The six example cards, as real cards.
 *
 * ⚠ THEY DIFFER IN CONTENT AS WELL AS COLOUR, and that is the whole argument of the section:
 * six tiles wearing six palettes over one identical field list would say the product is a
 * colour picker. Each `fieldIds` list is a genuinely different subset of the same profile —
 * "Limited" carries two fields, "Business" carries six — which is what "a card is a filter over
 * your profile" looks like when you can see it.
 *
 * ⚠ AND THEY ALL USE ONE TEMPLATE (`meridian`). Colour and content vary; the FORMAT does not.
 * Someone handed one card should already know where to look on every other. The brief's phrase
 * "different cards with different designs" invites six compositions and must not get them.
 */
export const exampleCardSpecs: readonly ExampleCardSpec[] = [
  {
    id: "business",
    name: "Business",
    card: {
      id: "card_mk_business",
      userId: CARD_OWNER,
      name: "Business",
      type: "BUSINESS",
      isSensitive: false,
      publicUrl: "https://card.example/c/3nR8xA5oSu9Mq2YdWc4Jt0",
      templateId: "meridian",
      paletteId: "sapphire",
      fieldIds: [
        "field_job_title",
        "field_company",
        "field_work_phone",
        "field_work_email",
        "field_work_address",
        "field_linkedin",
      ],
      updatedAt: "2026-09-09T09:00:00.000Z",
    },
  },
  {
    id: "personal",
    name: "Personal",
    card: {
      id: "card_mk_personal",
      userId: CARD_OWNER,
      name: "Personal",
      type: "PERSONAL",
      isSensitive: true,
      publicUrl: "https://card.example/c/4oS9yB6pTv0Nr3ZeXd5Ku1",
      templateId: "meridian",
      paletteId: "clay",
      fieldIds: [
        "field_mobile",
        "field_personal_email",
        "field_home_address",
        "field_dob",
      ],
      updatedAt: "2026-09-09T09:00:00.000Z",
    },
  },
  {
    id: "limited",
    name: "Limited",
    card: {
      id: "card_mk_limited",
      userId: CARD_OWNER,
      name: "Limited",
      type: "CUSTOM",
      isSensitive: false,
      publicUrl: "https://card.example/c/5pT0zC7qUw1Os4AfYe6Lv2",
      templateId: "meridian",
      paletteId: "onyx",
      /* Two fields. The card for somebody you have just met, and the clearest thing on the page
         that a card is a subset rather than a copy. */
      fieldIds: ["field_mobile", "field_work_email"],
      updatedAt: "2026-09-09T09:00:00.000Z",
    },
  },
  {
    id: "side-project",
    name: "Side project",
    card: {
      id: "card_mk_side",
      userId: CARD_OWNER,
      name: "Side project",
      type: "CUSTOM",
      isSensitive: false,
      publicUrl: "https://card.example/c/6qU1aD8rVx2Pt5BgZf7Mw3",
      templateId: "meridian",
      paletteId: "pistachio",
      fieldIds: [
        "field_studio_handle",
        "field_site_url",
        "field_instagram",
        "field_personal_email",
      ],
      updatedAt: "2026-09-09T09:00:00.000Z",
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
      publicUrl: "https://card.example/c/7rV2bE9sWy3Qu6ChAg8Nx4",
      templateId: "meridian",
      paletteId: "rust",
      fieldIds: [
        "field_mobile",
        "field_home_address",
        "field_home_landline",
        "field_relation",
        "field_dob",
      ],
      updatedAt: "2026-09-09T09:00:00.000Z",
    },
  },
  {
    id: "corporate",
    name: "Corporate",
    card: {
      id: "card_mk_corporate",
      userId: CARD_OWNER,
      name: "Corporate",
      type: "BUSINESS",
      isSensitive: false,
      publicUrl: "https://card.example/c/8sW3cF0tXz4Rv7DiBh9Oy5",
      templateId: "meridian",
      paletteId: "periwinkle",
      fieldIds: [
        "field_job_title",
        "field_company",
        "field_department",
        "field_work_email",
        "field_work_address",
      ],
      updatedAt: "2026-09-09T09:00:00.000Z",
    },
  },
];

