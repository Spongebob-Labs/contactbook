"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  IdCard,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import { SignOutButton } from "@/components/layout/sign-out-button";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/primitives";
import { Tooltip, TooltipProvider } from "@/components/overlay";
import { formatPhoneDisplay } from "@/lib/format";
import { useSession } from "@/lib/session-context";

/**
 * The authenticated rail (spec §8D.3, Vansh's Q30) — 240px of `--surface-sunk` with a
 * `--hairline` right edge, collapsible to a 68px icon rail, `display: none` below 768px
 * where `<BottomBar>` takes over.
 *
 * ── Why the collapse state is a tri-state and not a boolean ──────────────────────────
 * §8D.3 asks for two different defaults: expanded ≥1024px, **collapsed at 768–1023px**.
 * A boolean cannot express "it depends on the viewport" without measuring the viewport,
 * and measuring it is banned — a JavaScript viewport-width branch renders one thing on
 * the server and another on the client (hydration mismatch) and is exactly what §11 E-45
 * fails. So the default is `null` = *auto*, whose width is chosen by a `lg:` breakpoint
 * in CSS, and the toggle only ever writes an explicit override. That override lives in
 * component state and nowhere else — §10.1 forbids browser storage and this run has no
 * persistence at all (§3.1).
 *
 * The toggle is therefore rendered twice, and CSS picks: in *auto* the "Collapse" button
 * is `hidden lg:inline-flex` and the "Expand" button is its mirror, so whichever one is
 * exposed is always the one that does something. One button with a guessed label would
 * give tablet users a dead click.
 *
 * ── What every item keeps, in every state ────────────────────────────────────────────
 * An `aria-label`. The rail collapses to icons, and §8.8 is absolute that no meaning is
 * ever carried by an icon alone (AC-25). The tooltip is for the mouse; the label is what
 * a screen reader announces. The tooltip may never be the only carrier.
 */

export interface AppNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * The four destinations of the authenticated product (§8D.3). `<BottomBar>` renders the
 * same array, which is the whole reason it lives here rather than being written twice:
 * a fifth item added to one navigation and not the other is a bug nobody notices until a
 * phone is in their hand.
 */
export const APP_NAV_ITEMS: readonly AppNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cards", label: "Cards", icon: IdCard },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/profile", label: "Profile", icon: UserRound },
];

/**
 * Active when the route *is* the destination or lives beneath it, so `/cards/card_x/edit`
 * still lights up "Cards". The trailing slash matters: without it `/cards-archive` would
 * match `/cards` on a bare `startsWith`.
 */
export function isNavItemActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** `null` = follow the viewport (the CSS default); `true`/`false` = the user's override. */
type CollapseOverride = boolean | null;

/** The three class-map keys. Narrow on purpose: a typo would otherwise be `undefined`. */
type CollapseKey = "auto" | "true" | "false";

const WIDTH: Record<CollapseKey, string> = {
  auto: "w-[var(--sidebar-collapsed)] lg:w-[var(--sidebar-width)]",
  true: "w-[var(--sidebar-collapsed)]",
  false: "w-[var(--sidebar-width)]",
};

/** Shown when the rail is wide. */
const LABEL: Record<CollapseKey, string> = {
  auto: "hidden lg:block",
  true: "hidden",
  false: "block",
};

/** Shown when the rail is narrow — the exact inverse of `LABEL`. */
const MARK: Record<CollapseKey, string> = {
  auto: "block lg:hidden",
  true: "block",
  false: "hidden",
};

/** Centre the icons while the rail is narrow, left-align them once it is wide. */
const ALIGN: Record<CollapseKey, string> = {
  auto: "justify-center lg:justify-start",
  true: "justify-center",
  false: "justify-start",
};

const ITEM_INSET: Record<CollapseKey, string> = {
  auto: "px-0 lg:px-3",
  true: "px-0",
  false: "px-3",
};

/** Referenced by both toggles' `aria-controls`. */
const SIDEBAR_ID = "app-sidebar";

function stateKey(override: CollapseOverride): CollapseKey {
  return override === null ? "auto" : override ? "true" : "false";
}

export interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useSession();
  const [override, setOverride] = useState<CollapseOverride>(null);

  const key = stateKey(override);
  const fullName = user ? `${user.firstName} ${user.lastName}` : null;
  const contactLine = user ? (user.email ?? formatPhoneDisplay(user.phone)) : null;

  return (
    <aside
      id={SIDEBAR_ID}
      data-app-sidebar=""
      data-collapsed={key}
      className={cn(
        // `hidden md:flex` is the whole of E-45: below 768px this element is not in the
        // layout, not in the accessibility tree, and cannot be an orphaned rail —
        // whatever the collapse state happens to be.
        "hidden md:flex",
        "sticky top-0 h-svh shrink-0 flex-col border-r border-line bg-surface-sunk",
        "transition-[width] duration-[var(--dur-base)] ease-out",
        WIDTH[key],
        className,
      )}
    >
      <div className={cn("flex items-center border-b border-line px-3 py-4", ALIGN[key])}>
        <Link
          href="/dashboard"
          aria-label="Contact Book"
          className="flex min-w-0 items-center gap-2 text-ink"
        >
          <span aria-hidden="true" className={cn("font-sans text-lg", MARK[key])}>
            CB
          </span>
          <span
            aria-hidden="true"
            className={cn("truncate font-sans text-lg", LABEL[key])}
          >
            Contact Book
          </span>
        </Link>
      </div>

      {/* One `TooltipProvider` for the whole rail: running a pointer down four icons
          should not re-pay the open delay at each one. */}
      <TooltipProvider>
        <nav
          aria-label="Primary"
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-4"
        >
          {APP_NAV_ITEMS.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            const Icon = item.icon;

            const link = (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-full text-sm",
                  "transition-colors duration-[var(--dur-fast)] ease-out",
                  // The active pill: `--accent-wash` ground, `--accent` text and icon.
                  active
                    ? "bg-accent-wash text-accent"
                    : "text-ink-3 hover:bg-surface hover:text-ink",
                  ALIGN[key],
                  ITEM_INSET[key],
                )}
              >
                <Icon aria-hidden="true" strokeWidth={1.5} className="size-6 shrink-0" />
                <span className={cn("truncate", LABEL[key])}>{item.label}</span>
              </Link>
            );

            // No tooltip once the rail is explicitly wide — the label is right there.
            return override === false ? (
              link
            ) : (
              <Tooltip key={item.href} content={item.label} side="right">
                {link}
              </Tooltip>
            );
          })}
        </nav>
      </TooltipProvider>

      <div className={cn("flex px-3 pb-2", ALIGN[key])}>
        <button
          type="button"
          aria-label="Collapse sidebar"
          aria-controls={SIDEBAR_ID}
          aria-expanded={true}
          onClick={() => setOverride(true)}
          className={cn(
            "size-10 items-center justify-center rounded-md text-ink-3",
            "transition-colors duration-[var(--dur-fast)] ease-out hover:bg-surface hover:text-ink",
            key === "auto" ? "hidden lg:inline-flex" : key === "false" ? "inline-flex" : "hidden",
          )}
        >
          <PanelLeftClose aria-hidden="true" strokeWidth={1.5} className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Expand sidebar"
          aria-controls={SIDEBAR_ID}
          aria-expanded={false}
          onClick={() => setOverride(false)}
          className={cn(
            "size-10 items-center justify-center rounded-md text-ink-3",
            "transition-colors duration-[var(--dur-fast)] ease-out hover:bg-surface hover:text-ink",
            key === "auto" ? "inline-flex lg:hidden" : key === "true" ? "inline-flex" : "hidden",
          )}
        >
          <PanelLeftOpen aria-hidden="true" strokeWidth={1.5} className="size-5" />
        </button>
      </div>

      {/* §11 E-14 — a 40+ character name truncates and the rail stays 240px. The chain
          that makes that true is `min-w-0` on the flex parent, `min-w-0` on the growing
          child and `truncate` on the text: drop any one of them and the name pushes the
          rail wider instead of ellipsing. */}
      <div
        data-user-chip=""
        className={cn(
          "flex min-w-0 items-center gap-3 border-t border-line px-3 py-4",
          ALIGN[key],
        )}
      >
        {user && fullName ? (
          <>
            <Avatar name={fullName} src={user.avatarUrl} size="sm" />
            <span className={cn("min-w-0 flex-1", LABEL[key])}>
              <span data-user-chip-name="" className="block truncate text-sm text-ink">
                {fullName}
              </span>
              <span className="block truncate text-xs text-ink-3">{contactLine}</span>
            </span>
            {/* The way out. It sits in the chip because that is where "who am I" already is, and
                signing out is the other half of that question. */}
            <SignOutButton
              compact={key !== "false"}
              className="shrink-0 px-0"
              labelClassName="sr-only"
            />
          </>
        ) : (
          <Link
            href="/signin/phone"
            aria-label="Sign in"
            className="flex min-w-0 items-center gap-3 text-sm text-ink-3 hover:text-ink"
          >
            <UserRound aria-hidden="true" strokeWidth={1.5} className="size-6 shrink-0" />
            <span className={cn("truncate", LABEL[key])}>Sign in</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
