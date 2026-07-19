import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  ChevronRight,
  CreditCard,
  FolderKanban,
  Home,
  Import,
  LogOut,
  Menu,
  PanelLeftClose,
  UserCircle,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/context/auth-context";
import { fetchContactGroups } from "@/lib/contacts-api";
import { logUiError } from "@/lib/friendly-errors";
import type { ContactGroup } from "@/lib/types";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_KEY = "contactbook:sidebar-collapsed";

/** Floating inset from viewport edges */
const SIDEBAR_INSET = "0.75rem";
const SIDEBAR_W_EXPANDED = "15rem";
const SIDEBAR_W_COLLAPSED = "4.25rem";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/profile", label: "Profile", icon: UserRound },
  { to: "/dashboard/cards", label: "Cards", icon: CreditCard },
  { to: "/dashboard/contacts", label: "Contacts", icon: UsersRound },
  { to: "/dashboard/import", label: "Import", icon: Import },
];

type AppShellProps = {
  children: ReactNode;
  headerActions?: ReactNode;
};

function ProfileAvatar({
  className,
  iconClassName,
  profilePhoto,
}: {
  className: string;
  iconClassName: string;
  profilePhoto?: string | null;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-subtle text-primary",
        className,
      )}
    >
      {profilePhoto ? (
        <img
          src={profilePhoto}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <UserRound className={iconClassName} aria-hidden="true" />
      )}
    </span>
  );
}

function readCollapsedPreference() {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
}

export function AppShell({ children, headerActions }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const navigate = useNavigate();
  const { logout, profileIdentity, userId } = useAuth();

  useEffect(() => {
    let isMounted = true;
    const loadGroups = async () => {
      try {
        const groups = await fetchContactGroups();
        if (isMounted) {
          setContactGroups(groups);
        }
      } catch (error) {
        logUiError("Could not load sidebar groups", error);
        if (isMounted) {
          setContactGroups([]);
        }
      }
    };

    void loadGroups();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    await logout();
    navigate("/auth", { replace: true });
  };

  const closeMenus = () => {
    setOpen(false);
    setProfileMenuOpen(false);
  };

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  };

  const sidebarWidth = collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W_EXPANDED;
  const mainPaddingLeft = `calc(${SIDEBAR_INSET} + ${sidebarWidth} + ${SIDEBAR_INSET})`;
  const shellPadStyle = {
    ["--shell-pad" as string]: mainPaddingLeft,
  } as CSSProperties;

  const sidebarContent = (isMobile = false) => {
    const rail = collapsed && !isMobile;

    return (
      <div className={cn("flex h-full flex-col", rail && "items-center")}>
        <div
          className={cn(
            "relative mb-3 flex shrink-0 items-center",
            rail ? "w-full justify-center px-0 pt-1" : "justify-between gap-2 px-1",
          )}
        >
          <Link
            to="/dashboard"
            className={cn(
              "flex min-w-0 items-center gap-2.5 rounded-xl font-display text-sm font-semibold tracking-tight text-foreground transition-colors hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              rail ? "justify-center p-1.5" : "px-2 py-1.5",
            )}
            title="ContactBook"
            onClick={() => setOpen(false)}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px]">
              <img
                src="/app-logo.svg"
                alt=""
                className="h-full w-full"
                aria-hidden="true"
              />
            </span>
            <span className={cn("truncate", rail && "hidden")}>ContactBook</span>
          </Link>

          {!isMobile && !rail && (
            <button
              type="button"
              aria-label="Collapse sidebar"
              onClick={toggleCollapsed}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-bg-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            </button>
          )}

          {isMobile && (
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-bg-hover hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <nav
          className={cn(
            "flex flex-1 flex-col gap-1 overflow-y-auto",
            rail ? "w-full items-center px-1.5" : "px-1.5",
          )}
          aria-label="Primary"
        >
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              title={item.label}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 text-sm font-medium transition-all duration-150",
                  rail
                    ? "h-10 w-10 justify-center rounded-xl"
                    : "h-10 rounded-xl px-3",
                  isActive
                    ? "bg-accent-subtle text-foreground"
                    : "text-muted-foreground hover:bg-bg-hover hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className={cn(
                        "absolute right-0 w-0.5 rounded-full bg-primary",
                        rail ? "inset-y-2" : "inset-y-2.5",
                      )}
                      aria-hidden="true"
                    />
                  )}
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-primary" : "text-current",
                    )}
                    aria-hidden="true"
                  />
                  <span className={cn(rail && "hidden")}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}

          {(!rail || isMobile) && (
            <div className="mt-5 px-1">
              <div className="mb-2 flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
                <FolderKanban className="h-3 w-3" aria-hidden="true" />
                Groups
              </div>
              <div className="grid gap-0.5">
                {contactGroups.slice(0, 6).map((group) => (
                  <Link
                    key={group.id}
                    to={`/dashboard/contacts?groupIds=${encodeURIComponent(group.id)}`}
                    onClick={() => setOpen(false)}
                    className="flex h-9 min-w-0 items-center rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:bg-bg-hover hover:text-foreground"
                  >
                    <span className="truncate">{group.name}</span>
                  </Link>
                ))}
                {contactGroups.length === 0 && (
                  <p className="px-3 py-1.5 text-xs text-muted-foreground/70">No groups yet</p>
                )}
              </div>
            </div>
          )}
        </nav>
      </div>
    );
  };

  return (
    <div className="app-ambient-bg min-h-screen">
      <aside
        style={{
          top: SIDEBAR_INSET,
          bottom: SIDEBAR_INSET,
          left: SIDEBAR_INSET,
          width: sidebarWidth,
        }}
        className={cn(
          "fixed z-30 hidden overflow-visible rounded-[20px] border border-border/40 bg-sidebar/95 backdrop-blur-xl transition-[width] duration-300 ease-out lg:block",
        )}
        aria-label="App navigation"
      >
        <div className="h-full overflow-hidden rounded-[20px] px-2 py-3">
          {sidebarContent()}
        </div>
        {collapsed && (
          <button
            type="button"
            aria-label="Expand sidebar"
            onClick={toggleCollapsed}
            className="absolute -right-3 top-5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-accent-border hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute bottom-3 left-3 top-3 w-64 max-w-[86vw] overflow-hidden rounded-[20px] border border-border/40 bg-sidebar/95 p-2 backdrop-blur-xl app-fade-up">
            {sidebarContent(true)}
          </div>
        </div>
      )}

      <div
        style={shellPadStyle}
        className="transition-[padding] duration-300 ease-out lg:pl-[var(--shell-pad)]"
      >
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-background/70 px-4 backdrop-blur-xl md:px-6">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-xl lg:hidden"
              aria-label={open ? "Close navigation" : "Open navigation"}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
            <span className="hidden text-sm font-medium text-foreground sm:block">
              Workspace
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {headerActions}
            <ThemeToggle />
            <div className="relative">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-xl"
                aria-label="Open profile menu"
                aria-expanded={profileMenuOpen}
                onClick={() => setProfileMenuOpen((value) => !value)}
              >
                {profileIdentity?.profilePhoto ? (
                  <ProfileAvatar
                    className="h-7 w-7"
                    iconClassName="h-3.5 w-3.5"
                    profilePhoto={profileIdentity.profilePhoto}
                  />
                ) : (
                  <UserCircle className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>

              {profileMenuOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close profile menu"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setProfileMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-11 z-50 w-72 rounded-2xl border border-border/50 bg-card/95 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl app-fade-up">
                    <div className="mb-3 flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2.5">
                      <ProfileAvatar
                        className="h-9 w-9"
                        iconClassName="h-4 w-4"
                        profilePhoto={profileIdentity?.profilePhoto}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {profileIdentity
                            ? `${profileIdentity.firstName} ${profileIdentity.lastName}`.trim()
                            : "Signed in"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {profileIdentity?.primaryEmail ?? userId ?? "Active session"}
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-0.5">
                      <Link
                        to="/profile"
                        onClick={closeMenus}
                        className="flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-colors hover:bg-muted/60"
                      >
                        <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        Profile
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-10 w-full justify-start rounded-xl px-3.5 text-destructive hover:text-destructive"
                        onClick={() => void handleLogout()}
                      >
                        <LogOut className="h-4 w-4" aria-hidden="true" />
                        Sign out
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:gap-8 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
