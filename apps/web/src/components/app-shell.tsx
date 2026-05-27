import { useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  CreditCard,
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
import { cn } from "@/lib/utils";

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
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground",
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

export function AppShell({ children, headerActions }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { logout, profileIdentity, userId } = useAuth();

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    await logout();
    navigate("/auth", { replace: true });
  };

  const closeMenus = () => {
    setOpen(false);
    setProfileMenuOpen(false);
  };

  const sidebar = (
    <aside className="flex h-full flex-col bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border bg-background/90 px-5 backdrop-blur">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 rounded-full pr-3 font-semibold tracking-normal transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary/10">
            <img
              src="/app-logo.svg"
              alt=""
              className="h-8 w-8 rounded-full"
              aria-hidden="true"
            />
          </span>
          ContactBook
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-2 p-3">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/dashboard"}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex h-11 items-center gap-3 rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isActive && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="hidden fixed inset-y-0 left-0 w-64 lg:block">{sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[86vw]">{sidebar}</div>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-full lg:hidden"
              aria-label={open ? "Close navigation" : "Open navigation"}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
            <ThemeToggle />
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-full"
                aria-label="Open profile menu"
                aria-expanded={profileMenuOpen}
                onClick={() => setProfileMenuOpen((value) => !value)}
              >
                {profileIdentity?.profilePhoto ? (
                  <ProfileAvatar
                    className="h-8 w-8"
                    iconClassName="h-4 w-4"
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
                  <div className="absolute right-0 top-12 z-50 w-72 rounded-[28px] border border-border bg-popover p-3 text-popover-foreground shadow-lg">
                    <div className="mb-3 flex items-center gap-3 rounded-full bg-muted px-3 py-2">
                      <ProfileAvatar
                        className="h-9 w-9"
                        iconClassName="h-4 w-4"
                        profilePhoto={profileIdentity?.profilePhoto}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {profileIdentity
                            ? `${profileIdentity.firstName} ${profileIdentity.lastName}`.trim()
                            : "Signed in"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {profileIdentity?.primaryEmail ?? userId ?? "Active session"}
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-1">
                      <Link
                        to="/profile"
                        onClick={closeMenus}
                        className="flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                      >
                          <UserRound className="h-4 w-4" aria-hidden="true" />
                          Profile
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-11 w-full justify-start rounded-full px-4 text-destructive hover:text-destructive"
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
        <main className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
