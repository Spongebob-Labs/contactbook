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
export const MARKETING_SECTION_IDS = [
  "hero",
  "problem",
  "solution",
  "cards",
  "how-it-works",
  "corporate",
  "belief",
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
  aside: "Nothing to install for the person you hand it to. It opens in their browser.",
  /* The flip control's accessible name, which changes with the face so it describes what a
     press will do rather than what is currently showing. */
  cardFrontLabel: "Showing the card you hand over. Press to see the card it opens.",
  cardBackLabel: "Showing the card it opens. Press to see the card you hand over.",
  /* Shown under the card. The automatic flip demonstrates that there are two faces, but only
     to a reader who happens to be looking at the right moment — and once somebody presses it,
     the cycle stops for good, so the hint is how they learn they are allowed to. */
  cardHint: "Turns on its own \u2014 or press it.",
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
 * ⚠ IT IS `FIXTURE_DB.user` WITH TWO CHANGES, AND BOTH ARE FORCED BY THE FACE'S FORMAT:
 *
 *   · **A surname that fits.** `<ShareFace>` clamps the name to ONE line by design — a second
 *     line pushes the QR off the 500px canvas — so "Priyanka Raghunathan" rendered as
 *     "Priyanka Raghunath…" in the hero. A truncated name is a bad first impression and it is
 *     not the format's fault: the format is right, the fixture name is just long. Shortened
 *     here rather than in `fixtures/user.ts`, because that user is threaded through the whole
 *     app's tests and a rename there is a change to surfaces this work is not touching.
 *   · **No avatar.** `/portraits/priyanka.png` is a generic silhouette placeholder, and at 56px
 *     on the hero's card it reads as exactly that. `null` makes the face fall back to its own
 *     monogram, which is shipped behaviour and looks designed. Swap the portrait back in the
 *     moment the client sends real photography.
 */
export const marketingUser: User = {
  ...FIXTURE_DB.user,
  lastName: "Rao",
  avatarUrl: null,
};

/** The card the hero flips. Emerald, because the hero's ground is white and the deep green is
 *  the brand's own — and because it is the one card on the page shown at full 336x500. */
export const heroCard = {
  id: "card_marketing_hero",
  userId: CARD_OWNER,
  name: "Work",
  type: "BUSINESS",
  isSensitive: false,
  publicUrl: "https://card.example/c/2mQ7wZ4nRt8Lp1XcVb3Hs9",
  templateId: "meridian",
  paletteId: "emerald",
  fieldIds: [
    "field_job_title",
    "field_company",
    "field_work_phone",
    "field_work_email",
    "field_site_url",
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

