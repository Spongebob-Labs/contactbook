# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**The card owner.** Someone who hands out contact details often enough that a paper card is friction — a partnerships lead, a founder, a freelancer. They build a card once, keep it for years, and edit it when a detail changes. They meet people in person and in chat, and they care how the card looks because it stands in for them.

**The recipient.** A stranger, seconds after meeting the owner. They either scan a QR off the owner's phone screen or tap a link in a message. They are on a phone, standing up, and they have one job: get the owner's details into their world — save the contact, start a WhatsApp thread, open the profile.

## Product Purpose

A digital contact card that is worth keeping. The owner composes a card from the fields in their profile; the recipient opens it as a web page and acts on it. Success is the recipient completing an action — saving the contact or opening a channel — not merely viewing the card.

## Positioning

**Two verticals, deliberately separate:**

1. **The wallet pass** — a fixed 336×500 card carrying a QR, added to Apple/Google Wallet. Its only job is fast in-person handover: double-tap the phone, the pass comes up, someone scans it. The QR encodes the card's own link, so the QR is an *accessibility shortcut to the link*, not a second artifact.
2. **The card page** — the shareable, customisable page the link opens. This is the product. Every field the owner adds becomes a tappable action.

**Updates are broadcast, not synced.** No mobile OS allows a saved address-book contact to update itself, and WhatsApp only reads the address book. So changed details reach people as an opt-in broadcast the owner triggers, never as silent background sync. Product copy and demos must never promise otherwise.

## Operating Context

- Handover happens in person (phone-to-phone scan) or in chat (a link).
- The recipient's first and usually only view is a phone browser, standing, one-handed.
- The owner edits on a desktop split view: live preview pinned on the left, controls on the right.
- A card is a **filter over the owner's profile**, not a copy of it. Editing a profile field once changes every card that maps it.

## Capabilities and Constraints

- 21 field types across 7 categories. Each has a renderer producing `{ icon, label, display, href, external, masked }`; the card builds on that registry rather than a second action model.
- **Masking is absolute on public surfaces.** The three financial types are masked regardless of the owner's flag; reveal exists only in `/profile`. A masked value must not reach the DOM — not as text, not in an attribute.
- **Contrast is a contract, not a convention.** Ink, buttons and borders are verified against *every* gradient stop by an automated suite. Bold is allowed; illegible is a failing build.
- **The QR must decode.** Payload ≤ 60 bytes, symbol at or below version 6, a 140px scannable floor. Five contract suites measure this and are treated as the product's ground truth.
- The wallet face is **one fixed format** — identical slot positions on every card. Colour is its only permitted variation.
- **This build has no persistence and makes zero outbound requests.** All data comes from a fixture gateway; Save is a stated outcome, not a write. Wallet delivery is not connected.
- Stack is established: Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Radix primitives for behaviour with the visual layer entirely our own.

## Brand Commitments

- Name: **Contact Book**. The wordmark appears on the shared card page.
- Typeface: **Geist** throughout. Personality comes from weight, tracking and case — not from loading a second family. No serif.
- App chrome is pure white with neutral greys and a near-black accent; per-card colour is a separate system that lives only on cards.
- **No white card ground.** A white card on a white page is an absence, not a card.
- Register, confirmed: **professional and quietly premium** — a card someone keeps for years. Impressive because it is precise, not because it is loud. Explicitly not the expressive/creator register.

## Evidence on Hand

- Fixture profile: 35 fields across 7 groups, covering all 21 field types; 9 cards including a permanent zero-field card used to guard the empty-card defect.
- **Every fixture domain must be RFC 2606/6761 reserved** (`example.com`, `.example`, `.test`, `.invalid`). Enforced by an allowlist test, not a denylist. The one exemption is social-platform hostnames, derived from the product's own `SOCIAL_PLATFORMS` table.
- No real customers, testimonials, pricing or benchmarks exist. Future work must not fabricate them.

## Product Principles

1. **The preview is the product.** What the owner sees while editing is the object the recipient receives — resolved once, from one source, so preview and payload cannot diverge.
2. **A card is a filter, never a second store of data.** The builder selects existing profile fields; it never authors one.
3. **Freedom with a floor.** The owner may choose any background; the system derives legible ink from it and clamps the result. An illegible card must be impossible to make, not merely discouraged.
4. **Say the consequence, not the count.** A card that shares nothing warns in words about what a recipient will get, and cannot be saved.
5. **Never promise what the platform cannot do.** Broadcast, not silent sync. Inert controls admit they are inert before they are pressed.

## Accessibility & Inclusion

- WCAG AA is the floor and is machine-verified: body text ≥ 4.5:1 against every gradient stop, control boundaries ≥ 3:1, plus a 7:1 headroom rule on primary ink so a softer secondary level has somewhere to sit.
- One global unlayered `:focus-visible` ring that no utility may remove.
- Status is never carried by colour alone.
- The recipient is one-handed on a phone: primary actions must be reachable and at least 44px.
