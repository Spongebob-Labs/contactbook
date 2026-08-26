import Link from "next/link";

import { mkcn } from "./mk-cn";
import { Eyebrow } from "./type";

/**
 * The site footer — a multi-column block closing the marketing group and the gallery alike.
 *
 * Three deliberate absences:
 *
 * · **No icons.** The footer is the one place the direction would allow a social glyph, and
 *   there is no social account to link to in this build — so an icon here would be
 *   decoration standing in for a destination. Every column is type and links.
 * · **No shape.** Flat on paper, separated from the page by a single hairline. No frames, no
 *   nested panels, no elevation: that belongs to `PillNav` alone, and only because it is fixed.
 * · **No invented destinations.** Every href resolves to a real route or to a section of `/`.
 *   A footer full of `/privacy`-shaped links to pages that do not exist is the fastest way to
 *   ship a broken link on a surface nobody is looking at.
 *
 * This is also where the three section links live for mobile: `PillNav` drops them below
 * 768px rather than hiding them behind an icon, so the footer *is* the full navigation at
 * that width and is written to carry that load.
 *
 * A server component — it renders nothing but anchors and text.
 */

const PRODUCT_LINKS = [
  { href: "/templates", label: "Templates" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#faq", label: "Questions" },
] as const;

const ACCOUNT_LINKS = [
  { href: "/signup/first-name", label: "Create an account" },
  { href: "/signin/phone", label: "Log in" },
] as const;

const COLUMN_LINK_CLASS = mkcn(
  "font-mk-sans text-mk-body-sm text-mk-stone",
  "transition-colors duration-[var(--dur-fast)] hover:text-mk-ink",
);

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-mk-hairline-strong bg-mk-paper">
      <div className="mx-auto w-full max-w-mk-page px-5 py-16 md:px-8 md:py-20">
        {/* Asymmetric on purpose: the brand block takes half the width and the two link
            columns share the rest, rather than three equal thirds. */}
        <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr] md:gap-8">
          <div>
            <Link
              href="/"
              className={mkcn(
                "font-mk-display text-mk-heading-sm text-mk-ink",
                "transition-colors duration-[var(--dur-fast)] hover:text-mk-sapphire-ink",
              )}
            >
              Contact Book
            </Link>
            <p className="mt-3 max-w-mk-measure-tight font-mk-sans text-mk-body-sm text-mk-stone">
              A contact card built from your own profile, shared as a link and a QR, and kept
              current by an update you send.
            </p>
          </div>

          <nav aria-labelledby="footer-product-heading">
            <Eyebrow id="footer-product-heading">Product</Eyebrow>
            <ul className="mt-4 flex flex-col gap-3">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={COLUMN_LINK_CLASS}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-account-heading">
            <Eyebrow id="footer-account-heading">Account</Eyebrow>
            <ul className="mt-4 flex flex-col gap-3">
              {ACCOUNT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={COLUMN_LINK_CLASS}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="mt-12 border-t border-mk-hairline pt-6 font-mk-sans text-mk-caption text-mk-stone">
          © {new Date().getFullYear()} Contact Book
        </p>
      </div>
    </footer>
  );
}
