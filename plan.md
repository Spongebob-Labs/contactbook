# ContactBook Website — Plan

One-scroll homepage + 3 pages. Frontend only.
Sources: client brief (the spec), 2018 deck (brand + problem only — it describes a different app), our current site.

---

## 1. Decide these three things first

| | The problem | My recommendation |
|---|---|---|
| **Animated hero card** | Client's #1 ask. But 4 hero objects have already been rejected here — the last one built and tested. | Build it, but as a **throwaway mockup shown to you first**. Don't wire it in until you've said yes. |
| **Brand green `#5ABCA9`** | Measures **2.28:1 on white**. Text needs 4.5:1, a button edge needs 3:1. So it can't be a word, a link or an edge. A near-twin (`#36BAB8`) was already here and the page came back "childish" — used as a *ground*, which is not how the brand uses it. | Use it as the deck does: **accent ink on white, never a ground.** Five levels off the same hue — table in §5. |
| **"Automatically"** | Brief promises updates arrive automatically. We deliberately built the opposite. | Split it: the **link** is always live (true). The copy **in their phone** updates when you send and they tap. Client's messaging — their call, but ask before we build it. |

---

## 2. The homepage — 8 sections

Each section answers the question the last one raises. That's what's missing today.

| # | Section | Headline | Visual | Work |
|---|---|---|---|---|
| 1 | **Hero** | Never Lose Contact / *The address book that updates itself.* | The animated card (§4) | Rewrite |
| 2 | **Problem** | Your address book is already out of date. | Deck p13 before/after — a phone contact with 3 fields struck through, our live card beside it | Rewrite |
| 3 | **Solution** | Live contact cards, shared your way. | One profile → 3 cards; tap a card and the fields it *doesn't* carry dim | Rewrite |
| 4 | **How it works** | 5 steps | Small real UI beside each row. Quiet section, no animation. | Add 5th step |
| 5 | **Example cards** | 6 card types | 6 real cards, 6 colours — all exists already | **New, cheap** |
| 6 | **Corporate** | For companies that cannot afford to lose relationships. | Deep green band | **New** |
| 7 | **Belief** | Relationships are too valuable to lose. | Nothing. Type on white. | **New** |
| 8 | **CTA** | Join the waitlist · Contact us | — | Rewrite |

**What happens to the current sections:** `broadcast` and `trust` both fold into Solution (`trust` *is* the Solution section, sitting 3 screens too low under a different name). `broadcast` currently delivers our caveat before the visitor knows what the product does. `faq` is cut from the homepage. `final-cta` retargets from signup → waitlist.

**Section 4's five steps:** create your details → build your cards → share the right one → stay current → **stay in control** (revoke/restrict/expand). The last one is new and is the trust argument.

**Section 5's six cards:** Business · Personal · Limited · Side project · Family · Corporate. Colour and content differ; **layout does not** — that's the format rule you locked in August. The brief's "different designs" phrasing threatens it; worth one sentence to the client.

---

## 3. Three new pages

| Route | Contents |
|---|---|
| `/waitlist` | One short form: name, email, phone, individual-or-company. Success state on the page. **Nowhere to send it yet** — needs a 10-minute decision, doesn't block the build. |
| `/contact` | Name, email, company, message + the deck's contact details (confirm they're current — 7 years old). Same missing endpoint. |
| `/corporate` | The real page. Deck's stats (25% of records inaccurate, 40% of leads bad data, the Gartner line) — **each needs its source printed; they're from 2013–15**. Ends in Contact us. No pricing. |

`/templates` already exists — Section 5 links to it, so the homepage section stays short.

---

## 4. The hero animation

One card, centred, on white. ~12s, loops. Uses our real card renderer, not a drawing.

1. **Settle** — card fills in, looks finished, holds 2s
2. **Go stale** — 2 fields quietly discolour and get a marker *(this is the beat that has to land — it's the reader's own phone)*
3. **Repair** — the stale fields lift off, new values slide into the same slots
4. **Grow** — a new field flies in, card grows to fit
5. **Revoke** — one field fades out, slot closes *(the "control" half — everyone forgets this beat)*

**Four rules:** one thing moves at a time · the card's outline never moves, only its contents · slots hold their height while empty (or the card jitters and looks broken) · no frame may be half-empty, since people arrive mid-loop.

Plus: still image for reduced-motion, pauses off-screen, never blocks first paint. `motion` v13 is already installed.

---

## 5. Design changes

**Goes:** the ruled-paper ground · sections overlapping each other's edges · the 4 colour washes (Clay/Pistachio/Periwinkle/Amber) · amber buttons.
*The ruled paper is a real loss — it's the product's own metaphor and took several attempts to land. But the brief asks for white space three times and a texture fights an animated card on top of it.*

**Stays:** the nine card colours · Space Grotesk + Geist · the type scale · the line-length limits · radii and shadows.
The design system isn't the problem. The page built on it is.

**The colour set** — small on purpose:

| | Value | On white | Use for |
|---|---|---|---|
| Ground | `#FFFFFF` | — | most sections |
| Wash | `#F2FAF8` | — | every other section, marks a boundary without a border |
| Deep green | `#286257` | 7.0:1 | corporate band + final CTA only. White text. |
| Brand green | `#5ABCA9` | 2.3:1 | logo, shapes, the animation's "updated" markers. **Never a word.** |
| Green display | `#419F8D` | 3.0:1 | one accent phrase per headline, icon strokes, control edges |
| Green ink | `#337F70` | 4.5:1 | small labels, links |
| Ink | `#181A1F` | 17.4:1 | all body and headlines |

Same hue throughout (168°), lightness only — so it reads as one colour.

*The two green inks are measured against the **wash**, not white. Derived on white they were 3.01 and 4.52 — legal there and below the bar one section down, where the ground is slightly darker. The page's contrast test caught it.*

**Buttons stay black** with green as accent. Green can't be a readable button fill, and in the deck green is never the loudest thing on the slide.

**Grounds:** hero white → problem wash → solution white → how wash → cards white → corporate deep green → belief white → CTA deep green.

**Motion:** one automatic animation per page (the hero). Everything else fires on scroll or on tap.

**Nav:** How it works · Example cards · For companies · [Join the waitlist]. Dropping "For individuals" — it links to the page you're on. Sign-in moves somewhere quiet, not the nav.

---

## 6. Build order

Each stage ends in something you can look at.

| | What | Size | Status |
|---|---|---|---|
| 0 | Colours + grounds in `marketing.css` | S | **done** |
| 1 | Section 5, example cards | S | **done** |
| 2 | The hero animation | M | **done** |
| 3 | Hero proper + sections 7, 8 | M | **done** |
| 4 | Sections 2, 3, 4 — the argument | L | **done** |
| 5 | Section 6 + `/corporate` | M | **done** |
| 6 | `/waitlist` + `/contact` | S | **done** |
| 7 | Nav, footer, page titles, tests | M | **done** (folded into 3–4) |

**All eight sections and all three pages are built.** The one thing still open is where a form
submission goes — it is now a single env var, `LEAD_WEBHOOK_URL`, so it is a config change and
not a code change. Point it at anything that takes a JSON POST (a form service, a Zapier or
Make hook, a Slack webhook, or an API endpoint when one exists) and both forms start working.

Until it is set the forms do **not** pretend: `/api/leads` answers 503 and each form shows
"we could not record that — email us at …" with a real address. A waitlist that shows a tick
and drops the row is worse than one that admits it is not wired up.

Stage 7 isn't optional — several test files reference the current sections, so removing one isn't just deleting a file.

---

## 7. Ask the client for

**Before stage 1:** logo as vector (monogram + full lockup) · the brand green confirmed · the deck's heading typeface, or confirmation we keep Space Grotesk.

**Before stage 4:** the original design files he offered · newer corporate stats · confirm the contact details.

**Also:** is it "ContactBook" or "Contact Book"? The deck and our code disagree. Brand should win.

---

## 8. Open questions

1. **The brief skips its own Sections 6 and 7** (runs 1-5, then 8). What were they? One is probably the deck's "Why It Works" — good material, would sit between How It Works and Example Cards.
2. "Automatically" — §1. The important one.
3. "Different cards with different designs" — different colours, or different layouts?
4. Separate About page, or is the belief section enough?
5. No pricing anywhere — confirmed?
6. What does the waitlist lead to? Changes what the success message can honestly promise.

---

## Not in scope

No backend. No new card layouts. No FAQ on the homepage. No pricing, roadmap or investor material from the deck. No changes to the existing app or its signup. No animation built before you've seen a mockup.

**Next:** your call on the three in §1, then I do stage 0 and show you stage 1.
