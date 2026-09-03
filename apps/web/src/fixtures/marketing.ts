import type { FieldCategory, FieldType } from "@/types/domain";

/**
 * Every word on `/` — the marketing one-pager.
 *
 * ## Why the copy is a file and not JSX
 * A rule that greps one file only works if there is one file, so the headline a reader sees
 * is here and the component that sets it is not allowed a string literal of its own. That
 * also makes the page's whole voice reviewable in one sitting, which is the only way "does
 * this read as written or as generated?" can actually be answered.
 *
 * ## THE VOICE, stated so it can be checked
 *
 * **Numbers and nouns, not adjectives.** Every claim below is a mechanic — a field count, a
 * file format, a transport, a number of templates — because a mechanic is either true or
 * false and an adjective is neither. Nothing here says *fast*, *simple*, *beautiful*,
 * *powerful* or *smart*.
 *
 * **Nothing claims a capability the product does not have.** This is not a style rule, it is
 * the argument the page is making. §`broadcast` below opens by stating a hard limitation of
 * both mobile platforms — that no application can rewrite a contact inside somebody else's
 * address book — because that limitation is the reason this product is shaped the way it is.
 * A page that hid it would be selling the thing every competitor implies and none of them
 * does. Saying it first is the single most persuasive sentence available to us, and it is
 * only available while it is true. **Do not soften it, and do not add a feature to this file
 * that the product cannot do.**
 *
 * **No fabricated social proof.** There are no testimonials in this file and there must not
 * be. Invented quotes from invented customers are the fastest way to lose exactly the trust
 * this page exists to build, and a real quote cannot be written by whoever is editing the
 * copy. Where a landing page would normally put a wall of logos or five-star cards, this one
 * puts the mechanism and the limits.
 *
 * ## Fixture hygiene
 * Any domain that appears in copy must be RFC 2606 / RFC 6761 reserved, the same rule
 * `tests/contract/fixture-hygiene.test.ts` enforces over the data fixtures. Product-owned
 * hostnames (`contactbook.app`) are ours to name; nobody else's is.
 *
 * `as const` rather than a runtime `Object.freeze`: this module is read at build time by a
 * server component and never handed to anything that could mutate it.
 */

/* ── The sections, in the order `/` renders them ───────────────────────────── */

/**
 * The section ids, in the order `/` renders them.
 *
 * Two of these are a **contract with the chrome, not a naming preference**: `PillNav` and
 * `SiteFooter` both link to `/#how-it-works` and `/#pricing`, so renaming either id points
 * four links in the navigation at nothing.
 *
 * ⚠ **This list changed shape in the Micro redesign, and deliberately.** It was nine ids
 * ending `voices → fields → faq → pricing → start`. Two of the four product pillars — the
 * update broadcast and the WhatsApp assistant — had no section at all, while `voices` held
 * three invented testimonials. A landing page that omits half of what the product does in
 * order to make room for quotes nobody said is arguing for the wrong product. `voices` is
 * gone; `broadcast`, `assistant` and `trust` are new; `scan` became `card`, which now shows
 * both card objects rather than only the QR.
 */
export const MARKETING_SECTION_IDS = [
  "hero",
  "problem",
  "how-it-works",
  "broadcast",
  "trust",
  "faq",
  "start",
] as const;

export type MarketingSectionId = (typeof MARKETING_SECTION_IDS)[number];

/** A destination inside the route manifest. Nothing on this page links off-site. */
export interface MarketingLink {
  readonly href: string;
  readonly label: string;
}

/* ── Hero ──────────────────────────────────────────────────────────────────── */

export interface HeroCopy {
  readonly eyebrow: string;
  readonly headline: string;
  readonly subhead: string;
  readonly primary: MarketingLink;
  readonly secondary: MarketingLink;
  readonly aside: string;
}

/**
 * "Keep it true" is doing deliberate work: it is the promise *and* the etymology. A paper
 * contact book stayed true because its owner maintained it, and the product's whole shape
 * follows from trying to give a digital one the same property.
 */
export const hero = {
  eyebrow: "Contact Book",
  headline: "Hand over one card. Keep it true for years.",
  subhead:
    "A QR on your lock screen opens a page with your name, your numbers and every link you chose to put on it. When something changes, you send the update — and the people who asked to hear from you get it on WhatsApp, SMS or email.",
  primary: { href: "/signup/first-name", label: "Create your card" },
  secondary: { href: "/templates", label: "Look at the cards" },
  aside: "No app for the person you hand it to. The card opens in a browser.",
} as const satisfies HeroCopy;

/* ── Problem — the wedge ───────────────────────────────────────────────────── */

export interface ProblemCopy {
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly counts: readonly { readonly figure: string; readonly label: string }[];
}

/**
 * The counts are **product facts**, not market statistics. There is a real temptation here to
 * write "73% of saved contacts go stale" and no way to source it, so the figures below are
 * things this repository can be checked against: 21 `FieldType` members, 2 entries in
 * `TEMPLATE_ORDER`, 9 in `PALETTE_ORDER`, one URL per card. A number a reader could catch us
 * inventing costs more than it buys.
 */
export const problem = {
  heading: "Everyone saved your old number.",
  paragraphs: [
    "A paper contact book worked because somebody maintained it. You crossed out the old address and wrote the new one above it.",
    "Digital address books made storing a person free and maintaining them impossible \u2014 more contacts than anyone has ever had, and fewer people you can actually reach.",
  ],
  counts: [
    { figure: "21", label: "field types, from a mobile number to a crypto wallet" },
    { figure: "9", label: "colours, every one measured against its own text" },
    { figure: "1", label: "link per card, which is also what the QR encodes" },
  ],
} as const satisfies ProblemCopy;

/* ── How it works — four numbered steps ────────────────────────────────────── */

export interface Step {
  readonly ordinal: string;
  readonly title: string;
  readonly body: string;
}

export interface HowItWorksCopy {
  readonly heading: string;
  readonly steps: readonly Step[];
}

export const howItWorks = {
  heading: "Four steps, and you only repeat the last one.",
  steps: [
    {
      ordinal: "01",
      title: "Fill in your profile once",
      body: "Numbers, emails, links, addresses, payment handles, a photo. Twenty-one kinds of field. Mark anything private and it stays masked in the product and off every card you share.",
    },
    {
      ordinal: "02",
      title: "Make a card out of it",
      body: "A card is a filter over your profile, not a second copy of it. Tick the fields this card should carry, pick a colour, and you have a page at contactbook.app and a QR that opens it.",
    },
    {
      ordinal: "03",
      title: "Hand it over",
      body: "Keep the QR on your lock screen. Double-tap, they scan, your page opens in their browser with nothing to install. One tap on their side saves you to their phone.",
    },
    {
      ordinal: "04",
      title: "Send the update when it changes",
      body: "New number, new job, new city. Write the change once and send it to the people who opted in to hear from you. They tap once and their copy of you is current again.",
    },
  ],
} as const satisfies HowItWorksCopy;

/* ── The demonstration — the words that caption real product objects ───────── */

/**
 * ⚠ **These strings caption OBJECTS, not claims, and that is the whole reason they exist.**
 *
 * `how-it-works` renders the product itself: a live `<ShareFace>` the reader recolours, a
 * cropped `<CardPage>`, a QR that genuinely decodes, and real rows out of the fixture profile.
 * Every one of those needs a name beside it, and a component is not allowed a string literal —
 * so the names are here, with the rest of the page's voice, where "does this read as written
 * or as generated?" can be answered in one sitting.
 *
 * The rule the module header states applies with full force. Nothing below describes a
 * capability: they are labels for things a reader can see and press. The only sentence that
 * makes a claim is `scanHint`, and it is the one claim on the page a reader can falsify in two
 * seconds with their own phone — which is exactly why it is worth making.
 *
 * ⚠ `privateLabel` is a UI label rather than prose, and it is here rather than in the
 * component for a mechanical reason: `trust.panels` and `fieldCatalogue.note` both promise
 * that a private field cannot reach a card, and this word is what makes that promise VISIBLE
 * on the demonstration. A component-local literal would let the demonstration and the promise
 * drift apart with nothing to grep.
 */
export interface DemoCopy {
  readonly paletteLegend: string;
  readonly paletteHint: string;
  readonly faceLabel: string;
  readonly pageLabel: string;
  readonly scanHint: string;
  readonly linkLabel: string;
  readonly profileLabel: string;
  readonly privateLabel: string;
  readonly reachLabel: string;
}

export const demo = {
  /** Names the swatch group for a screen reader. There is no visible legend. */
  paletteLegend: "Card colour",
  /** Under the swatches. The count is `PALETTE_ORDER.length`, checked by the component. */
  paletteHint: "Nine grounds, every one measured against its own text. Press one.",
  faceLabel: "The wallet pass",
  pageLabel: "The page it opens",
  /**
   * The only falsifiable claim in this block, and it is live: the symbol beside it is rendered
   * at full size by the same `<QrZone mode="full">` the product ships, encoding the same card
   * URL. If it ever stops decoding, this sentence is a lie on the homepage — which is why
   * `tests/e2e/marketing.spec.ts` measures the symbol rather than trusting it.
   */
  scanHint: "This code works. Point a phone at it and the card opens in the browser.",
  linkLabel: "Opens",
  profileLabel: "Your profile",
  privateLabel: "Private",
  reachLabel: "However they reached you",
} as const satisfies DemoCopy;

/* ── Broadcast — the trust section, and the argument of the whole page ─────── */

export interface BroadcastCopy {
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly facts: readonly { readonly term: string; readonly detail: string }[];
}

/**
 * ⚠ **The most important copy in this file. Read the module header before editing it.**
 *
 * The heading is a statement about iOS and Android, not about Contact Book, and it is
 * accurate: neither platform exposes an API that lets an application write to a third
 * party's address-book entry, and WhatsApp reads the address book rather than writing to it.
 * The product was redesigned around that fact — a silent-sync model was abandoned for an
 * opt-in broadcast because the silent one cannot be built by anybody.
 *
 * Leading with the limitation is not modesty, it is the differentiator. Every competitor's
 * marketing implies the saved contact updates itself. Ours is the only page that can explain
 * why that is not happening, and a reader who has been burned by it recognises the
 * explanation immediately.
 */
export const broadcast = {
  heading: "No app can change your number inside someone else's phone.",
  /*
    ⚠ ONE PARAGRAPH, DOWN FROM TWO, AND THE SECOND ONE IS NOT DELETED — IT IS DRAWN.

    The cut paragraph read: "So you write the change once and send it. The people who opted in
    get it on WhatsApp, SMS or email and tap once to save. You press send — never automatic,
    never silent, and those two properties are the point rather than a shortfall."

    Every clause of that is now a labelled stage of `handover`: the send is stage 05, the
    one-tap save is stage 04, and "never automatic, never silent" is what the return path's
    own geometry says — the loop is drawn as an arrow the owner fires, not as a cycle that
    turns on its own. A sentence and a diagram making the same point is the text-heaviness the
    client named; the diagram is the one a reader can check against the product.

    The FIRST paragraph stays and may not be cut. It is a statement about iOS and Android
    rather than about this product, no diagram can carry it, and it is the page's
    differentiator — see the note above.
  */
  paragraphs: [
    "Not on iPhone, not on Android. Software that could quietly rewrite an entry in your address book could quietly rewrite anyone's. When a product implies your saved contact refreshes itself, that is the specific thing it is not doing.",
  ],
  facts: [
    {
      term: "Opt-in only",
      detail: "Somebody hears from you because they chose to. No list is on by default.",
    },
    {
      term: "One tap on their side",
      detail: "It arrives as an ordinary message with the new details ready to save. No account, no app.",
    },
    {
      term: "Nothing in the background",
      detail: "No silent writes, no daemon, no permission near your contacts. A broadcast exists because you sent it.",
    },
  ],
} as const satisfies BroadcastCopy;

/* ── The hand-over flow — the diagram in the broadcast pass ─────────────────── */

/**
 * **Labels for the flow diagram. Three steps and a return, and that is the whole budget.**
 *
 * ## ⚠ THIS IS THE SECOND VERSION. READ WHY THE FIRST ONE WAS REJECTED.
 * The first attempt gave each of five stages an ordinal, a title, a full sentence of body
 * copy and a mono line naming a REST route. The client's verdict was unambiguous — *"the worst
 * diagram that you can just make… so text-heavy… Why is this API endpoint also given here?"*
 * — and counting proves the charge: it removed a 45-word paragraph and put roughly 100 words
 * back. It made the pass MORE text-heavy while claiming to fix text-heaviness.
 *
 * Three rules follow, and none of them is a matter of taste:
 *
 *   · **No routes, ever.** `GET /v1/public/links/:token` is implementation detail on a page
 *     whose reader is deciding whether to hand out their phone number. "A little bit
 *     technical" meant *precise and well-engineered*, not *exposes the backend*. There is no
 *     `route` field on a step any more and one may not be added.
 *   · **A label, not a sentence.** Two to four words. If a step needs explaining, the
 *     drawing is wrong — fix the drawing. `broadcast.paragraphs` and `broadcast.facts` are
 *     where prose belongs, and they already carry it.
 *   · **Three steps, because the story has three.** The client described it as: bring the pass
 *     up, they scan, the card opens. The fourth item is the return, which is the argument the
 *     section exists to make.
 *
 * Total budget below: **11 words of visible copy**, against the 45-word paragraph the diagram
 * replaced. That ratio is the point of the whole exercise and a future edit should check it.
 *
 * ## ⚠ STAGE 1 DEPICTS WALLET DELIVERY, WHICH IS NOT SIGNED SERVER-SIDE YET
 * `components/share/wallet-pass-block.tsx` states the truth on the surface that offers the
 * control — *"Neither button installs anything yet"* — because a `.pkpass` needs a signing
 * server this build does not have. The owner's decision on 2026-09-03 was to draw the wallet
 * step regardless: the pass work is queued, and a drawing of where the object lives is not a
 * button that fails in somebody's hand.
 *
 * What that does not licence is a claim. "Your pass" names an object and stops — no install,
 * no download, no control. And no disclosure language may appear here: this page has nowhere
 * to put one, and `marketing.spec.ts` fails the build on six roadmap phrases.
 */
export interface HandoverStep {
  /** Stable id — the test hook and the React key. Never rendered. */
  readonly id: string;
  /** ⚠ Two to four words. See the module note; a sentence here is the rejected version. */
  readonly label: string;
}

export interface HandoverCopy {
  /** Names the diagram for a screen reader. The only long string, and it is never painted. */
  readonly caption: string;
  readonly steps: readonly HandoverStep[];
  /** The return path's label. The section's argument, in six words. */
  readonly loop: string;
}

export const handover = {
  caption:
    "You hand over a pass, they scan it, and your card opens in their browser. " +
    "When you edit it later, the link they already have shows the change.",
  steps: [
    { id: "pass", label: "Your pass" },
    { id: "scan", label: "They scan it" },
    { id: "card", label: "Your card opens" },
  ],
  loop: "You edit it \u2014 their link never changes",
} as const satisfies HandoverCopy;

/* ── Assistant — the WhatsApp query pillar ─────────────────────────────────── */



/* ── Fields ────────────────────────────────────────────────────────────────── */





/**
 * Which group each type is listed under, mirroring `SNAPSHOT_CATEGORY` in `field-list.tsx`
 * so the marketing list and the product's own grouping agree. Total by annotation, so a new
 * `FieldType` cannot be quietly left out of the catalogue.
 */
export const FIELD_GROUP_OF: Record<FieldType, FieldCategory> = {
  PHOTO: "IDENTITY",
  TEXT: "IDENTITY",
  DATE: "IDENTITY",
  PHONE: "PERSONAL",
  LANDLINE: "PERSONAL",
  FAX: "PERSONAL",
  EMAIL: "PERSONAL",
  ADDRESS: "PERSONAL",
  RELATION: "PERSONAL",
  STATUS: "PERSONAL",
  LOCATION_TRACKING: "PERSONAL",
  JOB_TITLE: "WORK",
  COMPANY: "WORK",
  DEPARTMENT: "WORK",
  URL: "WORK",
  REG_NUMBER: "BUSINESS",
  SOCIAL_LINK: "SOCIAL",
  BANK_ACCOUNT: "FINANCIAL",
  DIGITAL_WALLET: "FINANCIAL",
  CRYPTO_WALLET: "FINANCIAL",
  CUSTOM: "CUSTOM",
};


/* ── Trust — what leaves your phone ───────────────────────────────────────── */

export interface TrustPanel {
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

export interface TrustCopy {
  readonly heading: string;
  readonly body: string;
  readonly panels: readonly TrustPanel[];
}

/**
 * Four claims, each one a mechanism a reader could verify rather than a posture. "We take
 * your privacy seriously" is not on this page and must not be added: it is the sentence every
 * product says regardless of what it does, so it carries no information.
 */
export const trust = {
  heading: "A card is a filter, not a copy.",
  body:
    "A contact card is the one object you deliberately hand to strangers, so what it can carry is decided in the product rather than in the moment you share it.",
  panels: [
    {
      id: "per-card",
      title: "You choose, per card",
      body: "Your profile can hold your home address while the card you hand out at a conference carries a work email and nothing else.",
    },
    {
      id: "private",
      title: "Private fields cannot be shared",
      body: "Mark a field private and it is masked everywhere and cannot be added to a shared card at all. Not a warning you can click past.",
    },
    {
      id: "qr",
      title: "The QR encodes a link, and only a link",
      body: "The same short URL you would send in a message. No tracking pixel, no scan analytics, nothing else written into the symbol.",
    },
    {
      id: "revoke",
      title: "You can take a card back",
      body: "Delete a card and its page stops resolving. A QR printed on a badge stops working at the same moment, because it only ever pointed there.",
    },
  ],
} as const satisfies TrustCopy;

/* ── FAQ ───────────────────────────────────────────────────────────────────── */

export interface FaqEntry {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

export interface FaqCopy {
  readonly heading: string;
  readonly aside: string;
  readonly entries: readonly FaqEntry[];
}

/**
 * The FAQ answers the objections rather than the softballs. `changed-number` repeats the
 * limitation from `broadcast` on purpose — it is the question a sceptical reader arrives with,
 * and the answer needs to be findable without having read the whole page.
 */
export const faq = {
  heading: "The things worth asking first.",
  aside:
    "If the answer to one of these had to be evasive, it would be a design problem rather than a copy problem.",
  entries: [
    {
      id: "no-app",
      question: "Does the person I hand my card to need the app?",
      answer:
        "No. They scan a QR or open a link and your card loads in their browser. Saving you to their phone is one tap from that page and still needs nothing installed.",
    },
    {
      id: "changed-number",
      question: "If I change my number, does it update in their phone by itself?",
      answer:
        "No, and no product can do that. You send the change; the people who opted in get it on WhatsApp, SMS or email and tap once to save it. Nothing moves on its own.",
    },
    {
      id: "two-objects",
      question: "Why a wallet pass and a web page rather than one card?",
      answer:
        "Different jobs. The pass is a fixed size, holds a scannable QR and reads at arm\u2019s length on a lock screen. The page grows to fit however many fields you put on it.",
    },
    {
      id: "whatsapp",
      question: "What if the people I share with do not use WhatsApp?",
      answer:
        "An update can go out over SMS or email instead. The transport follows whatever that person gave you, and a card page works in any browser regardless.",
    },
    {
      id: "take-it-back",
      question: "What happens to a card I delete?",
      answer:
        "Its page stops resolving and the QR that pointed at it stops working. Details somebody already saved to their own phone stay theirs \u2014 deleting a card cannot reach into their address book any more than updating one can.",
    },
  ],
} as const satisfies FaqCopy;

/* ── Pricing: deliberately absent ─────────────────────────────────────────────
 *
 * There is no pricing section and no `pricing` export, and that is a decision rather than an
 * omission. The previous version shipped two plans at £0 and £4 with a feature list under each.
 * Those figures were invented — pricing is not settled — and an invented price is the one claim
 * on a marketing page a visitor will hold you to. Removing it also took `/#pricing` out of the
 * nav and the footer.
 *
 * When pricing is decided it returns as its own section with real numbers, not as a placeholder
 * that reads as real.
 */

/* ── Close ─────────────────────────────────────────────────────────────────── */

export interface CloseCopy {
  readonly headline: string;
  readonly body: string;
  readonly cta: MarketingLink;
}

export const close = {
  headline: "Make the card once.",
  body: "Signing up asks one question per screen. You can have a card that works before you have finished filling in your profile.",
  cta: { href: "/signup/first-name", label: "Create your card" },
} as const satisfies CloseCopy;

/* ── Page metadata ─────────────────────────────────────────────────────────── */

export const pageMeta = {
  description:
    "One card to hand over, one page it opens, and one update you send when something changes. Contact Book keeps your details current in other people's phones because you tell them — not because an app pretended it could.",
} as const;
