"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState, type ReactElement } from "react";

import { Avatar } from "@/components/primitives";
import { Sheet } from "@/components/overlay";
import { useSession } from "@/lib/session-context";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { cn } from "@/lib/cn";
import { formatPhoneDisplay } from "@/lib/format";

import { APP_NAV_ITEMS, isNavItemActive } from "./sidebar";

/**
 * The way back out of focus mode — a hamburger that opens the app's own navigation as a drawer.
 *
 * ## ⚠ It renders the SAME `APP_NAV_ITEMS` as the rail and the bottom bar
 *
 * Third consumer of that array, and the reason it is an array rather than three lists of JSX: a
 * fifth destination added to two of the three navigations is a bug nobody notices until they are
 * on the surface that lost it. The active rule is shared too — `isNavItemActive`, so
 * `/cards/{id}/edit` lights up "Cards" here exactly as it does on the rail.
 *
 * ## Why a modal drawer and not "put the rail back"
 *
 * Expanding the real rail would reflow the editor underneath it: the panel narrows, the swatch
 * grids reflow from five columns to four, and the live phone jumps left — every time somebody
 * checks where they are. A drawer is drawn *over* the editor, so looking at the navigation costs
 * nothing behind it and closing it restores nothing, because nothing moved.
 *
 * It is `Sheet side="left"` rather than a drawer written here, and that is not laziness: the
 * scrim, the focus trap, the scroll lock, Escape, and the modal-layer guard that makes a second
 * modal refuse to open are all things a hand-rolled drawer would have had to re-implement and
 * would have been exempt from. See the note at the head of `overlay/sheet.tsx`.
 *
 * ## The drawer closes itself on navigation
 *
 * Radix has no idea a `<Link>` inside it changed the route, so without the `onClick` below the
 * app would navigate under an open drawer and land on the new screen with a scrim over it and
 * focus trapped in a menu. Closing on click is the whole fix, and it is on the link rather than
 * on a router event because the click is the moment the intent is known.
 */
export function NavDrawer(): ReactElement {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useSession();

  const fullName = user ? `${user.firstName} ${user.lastName}` : null;
  const contactLine = user ? (user.email ?? formatPhoneDisplay(user.phone)) : null;

  return (
    <Sheet
      side="left"
      open={open}
      onOpenChange={setOpen}
      /* The drawer's accessible name. Visible too — it is the product's own name and the
         drawer is the only place in focus mode that carries it. */
      title="Contact Book"
      description="Go to another part of the app. Your card stays as you left it."
      /* ⚠ The close button stays. Escape and a scrim click both dismiss this, and both are
         invisible — a drawer whose only exits are two things you have to already know is a
         drawer some people cannot get out of. `Sheet` puts the control on the title's baseline,
         which on a left drawer is its top-right corner: where a mouse goes looking. */
      closeLabel="Close navigation"
      trigger={
        <button
          type="button"
          data-nav-drawer-open=""
          aria-label="Open navigation"
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-lg",
            "text-ink-3 transition-colors duration-[var(--dur-fast)]",
            "hover:bg-surface-sunk hover:text-ink",
          )}
        >
          <Menu aria-hidden="true" className="size-5" strokeWidth={1.75} />
        </button>
      }
    >
      <nav data-nav-drawer="" aria-label="Primary" className="flex flex-col gap-1">
        {APP_NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              data-nav-drawer-item={item.href}
              aria-current={active ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={cn(
                "flex h-11 items-center gap-3 rounded-full px-3 text-sm",
                "transition-colors duration-[var(--dur-fast)] ease-out",
                active
                  ? "bg-accent-wash font-medium text-accent"
                  : "text-ink-3 hover:bg-surface-sunk hover:text-ink",
              )}
            >
              <Icon aria-hidden="true" strokeWidth={1.5} className="size-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* The signed-in chip, last, the way the rail carries it. It is not a control here —
          `/profile` is already in the list above, and a second route to it inside one menu is a
          decision the reader has to make for no reason. */}
      {fullName === null ? null : (
        <div className="mt-6 flex items-center gap-3 border-t border-line pt-4">
          <Avatar name={fullName} size="sm" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm text-ink">{fullName}</span>
            {contactLine === null ? null : (
              <span className="truncate text-xs text-ink-3">{contactLine}</span>
            )}
          </div>
          {/* On a phone the drawer is the only chrome there is, so it has to carry the way out. */}
          <SignOutButton className="shrink-0 px-0" labelClassName="sr-only" />
        </div>
      )}
    </Sheet>
  );
}
