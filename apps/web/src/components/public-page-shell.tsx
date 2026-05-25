import { ArrowRight, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PublicNavItem = {
  label: string;
  href: string;
};

const defaultNavItems: PublicNavItem[] = [
  { label: "How it works", href: "#features" },
  { label: "Privacy", href: "#security" },
  { label: "Connect", href: "#workflow" },
];

function PublicNavLink({ item }: { item: PublicNavItem }) {
  if (item.href.startsWith("/")) {
    return (
      <Link to={item.href} className="transition-colors hover:text-public-teal">
        {item.label}
      </Link>
    );
  }

  return (
    <a href={item.href} className="transition-colors hover:text-public-teal">
      {item.label}
    </a>
  );
}

export function PublicHeader({
  navItems = defaultNavItems,
}: {
  navItems?: PublicNavItem[];
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-public-border bg-public-background/90 font-public-sans backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2" aria-label="ContactBook home">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-public-teal text-public-inverse">
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-base font-semibold tracking-normal text-public-charcoal">ContactBook</span>
        </Link>

        <nav className="hidden items-center gap-7 text-xs font-semibold uppercase tracking-[0.18em] text-public-muted md:flex">
          {navItems.map((item) => (
            <PublicNavLink key={`${item.label}-${item.href}`} item={item} />
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "hidden text-public-charcoal hover:bg-public-surface-muted sm:inline-flex",
            )}
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            className={cn(
              buttonVariants(),
              "bg-public-teal text-public-inverse hover:bg-public-teal/90",
            )}
          >
            Get started
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter({
  navItems = defaultNavItems,
}: {
  navItems?: PublicNavItem[];
}) {
  return (
    <footer className="border-t border-public-border bg-public-background font-public-sans">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <Link to="/" className="flex items-center gap-2" aria-label="ContactBook home">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-public-teal text-public-inverse">
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold text-public-charcoal">ContactBook</span>
        </Link>

        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-public-muted">
          {navItems.map((item) => (
            <PublicNavLink key={`${item.label}-${item.href}`} item={item} />
          ))}
        </nav>
      </div>
    </footer>
  );
}

export function PublicPageShell({
  children,
  navItems,
}: {
  children: ReactNode;
  navItems?: PublicNavItem[];
}) {
  return (
    <main className="public-light-theme min-h-screen overflow-hidden bg-public-background font-public-sans text-public-foreground">
      <PublicHeader navItems={navItems} />
      {children}
      <PublicFooter navItems={navItems} />
    </main>
  );
}
