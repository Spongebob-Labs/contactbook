import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FolderKanban,
  Home,
  Import,
  LogOut,
  Menu,
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

const SIDEBAR_W_EXPANDED = "15rem";   // 240px
const SIDEBAR_W_COLLAPSED = "4.5rem"; // 72px

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

  const sidebarContent = (isMobile = false) => (
    <nav
      className={cn(
        "flex h-full flex-col bg-sidebar px-2 py-4",
        collapsed && !isMobile && "items-center",
      )}
    >
      {/* Logo */}
      <Link
        to="/dashboard"
        className={cn(
          "mb-4 flex h-11 items-center gap-3 rounded-xl px-3 font-display text-sm font-semibold tracking-tight text-foreground transition-colors hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          collapsed && !isMobile && "justify-center px-0",
        )}
        title="ContactBook"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-accent-subtle text-primary">
          <img src="/app-logo.svg" alt="" className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className={cn("truncate", collapsed && !isMobile && "hidden")}>
          ContactBook
        </span>
      </Link>

      {/* Primary nav */}
      <div className="flex flex-1 flex-col gap-0.5">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/dashboard"}
            title={item.label}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                "group relative flex h-10 items-center gap-3 rounded-none px-3 text-sm font-medium transition-all duration-150",
                collapsed && !isMobile && "justify-center px-0",
                isActive
                  ? "bg-[rgba(200,184,154,0.08)] text-foreground"
                  : "text-text-muted hover:bg-bg-hover hover:text-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    className="absolute inset-y-0 right-0 w-0.5 bg-primary"
                    aria-hidden="true"
                  />
                )}
                <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className={cn(collapsed && !isMobile && "hidden")}>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* Groups section */}
        {(!collapsed || isMobile) && (
          <div className="mt-4 border-t border-border pt-4">
            <div className="label-section mb-1.5 flex items-center gap-2 px-3">
              <FolderKanban className="h-3 w-3" aria-hidden="true" />
              Groups
            </div>
            <div className="grid gap-0.5">
              {contactGroups.slice(0, 6).map((group) => (
                <Link
                  key={group.id}
                  to={`/dashboard/contacts?groupIds=${encodeURIComponent(group.id)}`}
                  onClick={() => setOpen(false)}
                  className="flex h-9 min-w-0 items-center rounded-none px-3 text-sm text-text-muted transition-colors hover:bg-bg-hover hover:text-foreground"
                >
                  <span className="truncate">{group.name}</span>
                </Link>
              ))}
              {contactGroups.length === 0 && (
                <p className="px-3 py-1.5 text-xs text-text-muted">No groups yet</p>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );

  return (
    <div className="app-ambient-bg min-h-screen">
      {/* Desktop floating sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-border bg-sidebar transition-[width] duration-300 ease-out lg:block",
          collapsed ? "w-[4.5rem]" : "w-60",
        )}
      >
        {sidebarContent()}
      </div>

      {/* Floating collapse toggle — hovers at the right edge of sidebar */}
      <button
        type="button"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        style={{
          left: `calc(${collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W_EXPANDED} - 0.75rem)`,
        }}
        className="fixed top-[1.375rem] z-40 hidden h-6 w-6 items-center justify-center rounded-full border border-border-strong bg-card transition-[left] duration-300 ease-out lg:flex"
        onClick={toggleCollapsed}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronLeft className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      {/* Mobile sidebar overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 max-w-[86vw] border-r border-border bg-sidebar app-fade-up">
            {sidebarContent(true)}
          </div>
        </div>
      )}

      {/* Main content */}
      <div
        className={cn(
          "transition-[padding] duration-300 ease-out",
          collapsed ? "lg:pl-[4.5rem]" : "lg:pl-60",
        )}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/40 bg-background/80 px-4 backdrop-blur-xl md:px-6">
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
            <span className="hidden text-sm font-medium text-foreground sm:block">Workspace</span>
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
                  <div className="absolute right-0 top-11 z-50 w-72 rounded-2xl border border-border/50 bg-card/95 p-3 shadow-float backdrop-blur-xl app-fade-up">
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
