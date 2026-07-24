import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  CreditCard,
  Home,
  Import,
  LogOut,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

const SIDEBAR_WIDTH = "240px";

const desktopNav = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/profile", label: "Profile", icon: UserRound },
  { to: "/dashboard/cards", label: "Cards", icon: CreditCard },
  { to: "/dashboard/contacts", label: "Contacts", icon: UsersRound },
  { to: "/dashboard/import", label: "Import", icon: Import },
] as const;

const mobileTabs = [
  { to: "/dashboard", label: "Dashboard", icon: Home, end: true },
  { to: "/dashboard/cards", label: "Cards", icon: CreditCard, end: false },
  { to: "/dashboard/contacts", label: "Contacts", icon: UsersRound, end: false },
  { to: "/profile", label: "Profile", icon: UserRound, end: false },
] as const;

type AppShellProps = {
  children: ReactNode;
  /** @deprecated Top bar removed; ignored. */
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
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-muted-foreground",
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

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const { logout, profileIdentity, userId } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/auth", { replace: true });
  };

  const displayName = profileIdentity
    ? `${profileIdentity.firstName} ${profileIdentity.lastName}`.trim()
    : "";

  return (
    <div className="min-h-screen bg-background">
      <aside
        style={{ width: SIDEBAR_WIDTH }}
        className="fixed inset-y-0 left-0 z-30 hidden border-r border-border bg-surface lg:flex lg:flex-col"
        aria-label="App navigation"
      >
        <div className="flex h-full flex-col px-4 py-6">
          <Link
            to="/dashboard"
            className="mb-6 flex items-center gap-2.5 rounded-md px-2 py-1.5 font-sans text-sm font-semibold text-foreground transition-colors duration-150 hover:bg-bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            title="ContactBook"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md">
              <img
                src="/app-logo.svg"
                alt=""
                className="h-full w-full"
                aria-hidden="true"
              />
            </span>
            <span className="truncate">ContactBook</span>
          </Link>

          <nav className="flex flex-1 flex-col gap-1" aria-label="Primary">
            {desktopNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/dashboard"}
                className={({ isActive }) =>
                  cn(
                    "group relative flex h-10 items-center gap-3 px-3 text-sm font-medium transition-colors duration-150",
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-bg-hover hover:text-foreground",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive ? (
                      <span
                        className="absolute inset-y-0 left-0 w-0.5 bg-foreground"
                        aria-hidden="true"
                      />
                    ) : null}
                    <item.icon
                      className={cn(
                        "h-5 w-5 shrink-0",
                        isActive ? "text-foreground" : "text-muted-foreground",
                      )}
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto border-t border-border pt-4">
            <div className="mb-3 flex items-center gap-3 px-2">
              <ProfileAvatar
                className="h-8 w-8"
                iconClassName="h-4 w-4"
                profilePhoto={profileIdentity?.profilePhoto}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {displayName || "Signed in"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {profileIdentity?.primaryEmail ?? userId ?? "Active session"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="flex h-10 w-full items-center gap-3 px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-bg-hover hover:text-foreground"
            >
              <LogOut className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Log out
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[240px]">
        <main className="page-content px-4 py-6 pb-24 md:px-8 md:py-8 lg:pb-8">
          {children}
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface lg:hidden"
        aria-label="Mobile"
      >
        <div className="grid grid-cols-4">
          {mobileTabs.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium transition-colors duration-150",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      "h-5 w-5",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
