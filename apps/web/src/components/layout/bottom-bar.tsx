"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { APP_NAV_ITEMS, isNavItemActive } from "./sidebar";

/**
 * The ≤767px navigation (spec §8D.3): 64px tall off `--bottombar-height`, fixed to the
 * bottom, `--surface` ground, top edge `--hairline`, four items, icon **plus** a
 * `--text-xs` label.
 *
 * It renders the same `APP_NAV_ITEMS` as the rail rather than a second list — see the
 * note there. `md:hidden` is the mirror of the rail's `hidden md:flex`, so the two are
 * mutually exclusive at every width and §11 E-45 ("no double navigation", "no orphaned
 * collapsed rail") holds structurally rather than by a JS branch that has to be right.
 * Both carry `aria-label="Primary"`; because exactly one is ever `display: block`, only
 * one is ever in the accessibility tree.
 *
 * The label under the icon is not decoration. §8.8: no meaning is carried by an icon
 * alone (AC-25), and a four-icon bar with no words is the least legible surface in a
 * product where "Cards" and "Contacts" are different things.
 */
export interface BottomBarProps {
  className?: string;
}

export function BottomBar({ className }: BottomBarProps) {
  const pathname = usePathname();

  return (
    <nav
      data-app-bottom-bar=""
      aria-label="Primary"
      className={cn(
        "md:hidden",
        "fixed inset-x-0 bottom-0 z-40",
        "border-t border-line bg-surface",
        // 64px of *content* sitting above the home indicator, with the ground extended
        // through the inset beneath it. Height must be `64px + inset` rather than plain
        // `64px`: with `border-box`, a bare 64px height plus this padding would squeeze
        // the four items into `64px - inset` and leave their labels under the indicator,
        // while the shell reserves the full `64px + inset` below the content (§8D.3).
        "h-[calc(var(--bottombar-height)+env(safe-area-inset-bottom,0px))]",
        "pb-[env(safe-area-inset-bottom,0px)]",
        className,
      )}
    >
      <ul className="flex h-full items-stretch">
        {APP_NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          const Icon = item.icon;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-xs",
                  "transition-colors duration-[var(--dur-fast)] ease-out",
                  active ? "text-accent" : "text-ink-3",
                )}
              >
                <Icon aria-hidden="true" strokeWidth={1.5} className="size-6 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
