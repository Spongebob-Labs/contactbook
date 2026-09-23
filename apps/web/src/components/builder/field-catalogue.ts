import type { ApiFieldCategory } from "@/lib/api/schema";
import type { FieldType } from "@/types/domain";

/**
 * THE CATALOGUE — what an owner can add to a card, arranged the way they think about it.
 *
 * ## ⚠ The defect this replaces
 *
 * The composer offered one flat `<select>` of eight `FieldType`s — Phone, Email, Job title,
 * Company, Website, Social link, Address, Anything else — and inferred a category from the type
 * afterwards (`CATEGORY_FOR_QUICK_TYPE`, now deleted). Three things were wrong with that, and
 * the client's report was *"right now it is very headache for the person to add"*:
 *
 *   1. **It asked the wrong question.** Nobody adding their LinkedIn thinks "I need a field of
 *      type SOCIAL_LINK". They think "I want to add my LinkedIn". A list of *data types* is the
 *      schema showing through the screen.
 *   2. **The category was guessed, and the guess was often wrong.** Every `PHONE` became
 *      `PERSONAL`, so a work mobile landed in the wrong section of the card and the owner had to
 *      go to `/profile` to move it. `URL` became `WORK`, so a personal site did too.
 *   3. **Eight options for twenty-one types.** The thirteen left out were unreachable here, and
 *      the escape hatch was a `TEXT` field called "Anything else" — which produces a note the
 *      card cannot make tappable.
 *
 * ## What it is instead
 *
 * The owner picks a **category** and then a **thing** — "Personal → Mobile", "Social → LinkedIn",
 * "Payment → UPI". The category is now CHOSEN rather than inferred, so it is right by
 * construction and the field lands in the section of the card the owner expected.
 *
 * ## ⚠ One offer is not one `FieldType`, and that is the whole point
 *
 * Six of the entries below are `SOCIAL_LINK`. They differ only in their label and their
 * placeholder — and that difference is the entire value: "LinkedIn", with `linkedin.com/in/…`
 * in the box, is a question an owner can answer without thinking. "Social link", with
 * `https://…`, is a question about the schema. The same holds for Mobile vs Work mobile, both
 * `PHONE`, which differ only by the category they are filed under.
 *
 * So the catalogue is a **vocabulary**, not a type registry. Adding a way to say something costs
 * one entry here and nothing anywhere else.
 *
 * ## What is deliberately absent
 *
 * `PHOTO` (the card's image slots own it), `LOCATION_TRACKING` and `STATUS` (set by the product,
 * not typed by an owner), and `IDENTITY` as a category — a card's name comes from the account,
 * and offering to "add a name" invites a second one that nothing would render.
 *
 * The three `FINANCIAL` kinds ARE offered, and that is a change: they were excluded because
 * their structured editors live in `/profile`. A plain value is a fine thing to author here —
 * the card masks all three on every public surface regardless (§7.3, AC-33), so the worst case
 * is an owner typing an account number they then refine in the profile.
 */
export interface FieldOffer {
  /** Stable id, used as the React key and in `[data-field-offer]`. */
  id: string;
  /** What the owner reads, and the label the field is created with. */
  label: string;
  type: FieldType;
  /** The value box's placeholder. A real-shaped example, never "Enter a value". */
  placeholder: string;
  /**
   * The soft keyboard a phone should raise. Omitted means the default text keyboard.
   *
   * ⚠ `url` rather than `text` for the social offers: they are URLs, and a keyboard with `/` and
   * `.` on the first layer is the difference between typing a profile link in three taps and in
   * nine.
   */
  inputMode?: "tel" | "email" | "url" | "numeric";
}

export interface CatalogueSection {
  category: ApiFieldCategory;
  /** The chip's text. Sentence case — these are things, not headings. */
  label: string;
  offers: readonly FieldOffer[];
}

/**
 * ⚠ **Order is the reading order and it is not alphabetical.** Personal first because it is what
 * most cards are; Other last because it is the escape hatch. Within a section the commonest
 * thing leads — Mobile before Landline, LinkedIn before Behance — so the first tap is usually
 * the right one and the rest is scanning rather than hunting.
 */
export const FIELD_CATALOGUE: readonly CatalogueSection[] = [
  {
    category: "PERSONAL",
    label: "Personal",
    offers: [
      { id: "mobile", label: "Mobile", type: "PHONE", placeholder: "+91 98201 15577", inputMode: "tel" },
      { id: "personal-email", label: "Email", type: "EMAIL", placeholder: "you@example.com", inputMode: "email" },
      { id: "home-address", label: "Home address", type: "ADDRESS", placeholder: "Flat 4, Anand Complex, Mumbai" },
      { id: "landline", label: "Landline", type: "LANDLINE", placeholder: "+91 22430 05500", inputMode: "tel" },
      { id: "personal-site", label: "Personal site", type: "URL", placeholder: "yourname.com", inputMode: "url" },
      { id: "birthday", label: "Birthday", type: "DATE", placeholder: "1991-04-17" },
      { id: "relation", label: "Emergency contact", type: "RELATION", placeholder: "Asha — sister" },
    ],
  },
  {
    category: "WORK",
    label: "Work",
    offers: [
      { id: "job-title", label: "Job title", type: "JOB_TITLE", placeholder: "Head of Partnerships" },
      { id: "work-company", label: "Company", type: "COMPANY", placeholder: "Fernwood Studio" },
      { id: "work-email", label: "Work email", type: "EMAIL", placeholder: "you@company.com", inputMode: "email" },
      { id: "work-mobile", label: "Work mobile", type: "PHONE", placeholder: "+91 98201 15577", inputMode: "tel" },
      { id: "work-landline", label: "Office line", type: "LANDLINE", placeholder: "+91 22430 05500", inputMode: "tel" },
      { id: "department", label: "Department", type: "DEPARTMENT", placeholder: "Revenue & Alliances" },
      { id: "work-address", label: "Office address", type: "ADDRESS", placeholder: "4th Floor, Raheja Titanium, Mumbai" },
    ],
  },
  {
    category: "BUSINESS",
    label: "Business",
    offers: [
      { id: "biz-site", label: "Website", type: "URL", placeholder: "company.com", inputMode: "url" },
      { id: "biz-company", label: "Business name", type: "COMPANY", placeholder: "Fernwood Studio Pvt Ltd" },
      { id: "biz-address", label: "Business address", type: "ADDRESS", placeholder: "Unit 7, Kamala Mills, Mumbai" },
      { id: "reg-number", label: "Registration no.", type: "REG_NUMBER", placeholder: "U72900MH2021PTC367412" },
      { id: "fax", label: "Fax", type: "FAX", placeholder: "+91 22430 05599", inputMode: "tel" },
    ],
  },
  {
    /**
     * ⚠ Six offers, one `FieldType`. The label and the placeholder are the whole difference, and
     * they are why this section is worth having: the card's social strip already draws a real
     * LinkedIn mark for a `linkedin.com` host (`social-glyphs.tsx`), so an owner who picks
     * "LinkedIn" here and pastes their profile gets the right glyph without ever meeting the
     * word "SOCIAL_LINK".
     */
    category: "SOCIAL",
    label: "Social",
    offers: [
      { id: "linkedin", label: "LinkedIn", type: "SOCIAL_LINK", placeholder: "linkedin.com/in/yourname", inputMode: "url" },
      { id: "instagram", label: "Instagram", type: "SOCIAL_LINK", placeholder: "instagram.com/yourname", inputMode: "url" },
      { id: "x", label: "X", type: "SOCIAL_LINK", placeholder: "x.com/yourname", inputMode: "url" },
      { id: "youtube", label: "YouTube", type: "SOCIAL_LINK", placeholder: "youtube.com/@yourname", inputMode: "url" },
      { id: "github", label: "GitHub", type: "SOCIAL_LINK", placeholder: "github.com/yourname", inputMode: "url" },
      { id: "social-other", label: "Other profile", type: "SOCIAL_LINK", placeholder: "example.com/yourname", inputMode: "url" },
    ],
  },
  {
    /** Reads as PAYMENT on the card (`SECTION_LABELS`); the API's enum spells it `FINANCIAL`. */
    category: "FINANCIAL",
    label: "Payment",
    offers: [
      { id: "bank", label: "Bank account", type: "BANK_ACCOUNT", placeholder: "50100412345678", inputMode: "numeric" },
      { id: "upi", label: "UPI / wallet", type: "DIGITAL_WALLET", placeholder: "yourname@okbank" },
      { id: "crypto", label: "Crypto wallet", type: "CRYPTO_WALLET", placeholder: "0x9f2c…d612" },
    ],
  },
  {
    category: "CUSTOM",
    label: "Other",
    offers: [
      { id: "note", label: "Note", type: "TEXT", placeholder: "Taking partnership intros this quarter" },
      { id: "custom", label: "Anything else", type: "CUSTOM", placeholder: "Podcast — The Long Game" },
    ],
  },
];

/** The section a category names, or `undefined`. Used to resolve a remembered choice. */
export function catalogueSection(category: string): CatalogueSection | undefined {
  return FIELD_CATALOGUE.find((section) => section.category === category);
}

/** Every offer, flattened — for the contract test that proves the ids are unique. */
export const ALL_OFFERS: readonly FieldOffer[] = FIELD_CATALOGUE.flatMap((s) => s.offers);
