/**
 * The real company's own details — the ones the website is *about*.
 *
 * ## ⚠ WHY THIS IS NOT IN `fixtures/marketing.ts`
 * `tests/contract/fixture-hygiene.test.ts` sweeps everything that file exports and rejects any
 * domain a real person could register. That rule is right and load-bearing: it stops invented
 * demo content — a fake profile, an example card — from pointing at somebody's actual business,
 * and it is an allowlist of RFC-reserved names precisely so it needs no maintenance.
 *
 * These values are the opposite kind of thing. They are not demo data with a real domain in it
 * by accident; they are the company the site belongs to. Keeping them here draws that line
 * where it belongs, rather than adding an exemption to a sweep that should not have one.
 *
 * ## ⚠ THEY COME FROM THE 2018 DECK AND MUST BE CONFIRMED BEFORE LAUNCH
 * Seven years old. Referenced by `/contact` and by both forms' failure fallbacks, so confirming
 * them is one edit here.
 */
export const contactDetails = {
  email: "info@contactbookapp.com",
  site: "contactbookapp.com",
} as const;
