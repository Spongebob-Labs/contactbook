import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  ChevronRight,
  Cloud,
  ContactRound,
  CreditCard,
  FileUp,
  Home,
  Import,
  Lock,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserCircle,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, Navigate, NavLink, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type PreviewScreen = "setup" | "import" | "profile";

const previewNav = [
  { to: "/dashboard/ui-preview/setup", label: "Setup", icon: Home },
  { to: "/dashboard/ui-preview/import", label: "Import", icon: Import },
  { to: "/dashboard/ui-preview/profile", label: "Profile", icon: UserRound },
  { to: "/dashboard/contacts", label: "Contacts", icon: UsersRound },
  { to: "/dashboard/cards", label: "Cards", icon: CreditCard },
];

const setupSteps = [
  { label: "Verify WhatsApp", state: "Done", complete: true },
  { label: "Profile details", state: "Ready", complete: false },
  { label: "Import contacts", state: "Next", complete: false },
  { label: "Create card", state: "Later", complete: false },
  { label: "Use on WhatsApp", state: "After setup", complete: false },
];

const recentContacts = [
  { name: "Maya Patel", detail: "Acme Growth", meta: "Google Contacts" },
  { name: "Arjun Mehta", detail: "Finance advisor", meta: "Updated today" },
  { name: "Nina Kapoor", detail: "Customer success", meta: "Needs card" },
];

const importSources = [
  {
    title: "Google Contacts",
    description: "Connect once, sync safely, and make your contacts searchable through WhatsApp.",
    icon: UploadCloud,
    badge: "Connected",
    active: true,
  },
  {
    title: "iCloud Contacts",
    description: "Apple contacts import will appear here when the secure connector is ready.",
    icon: Cloud,
    badge: "Coming soon",
    active: false,
  },
  {
    title: "VCF upload",
    description: "Upload exported vCard files after file import support is available.",
    icon: FileUp,
    badge: "Coming soon",
    active: false,
  },
];

export default function SignedInRedesignPreviewPage() {
  const { screen } = useParams();

  if (screen !== "setup" && screen !== "import" && screen !== "profile") {
    return <Navigate to="/dashboard/ui-preview/setup" replace />;
  }

  return (
    <PreviewShell screen={screen}>
      {screen === "setup" && <SetupCockpit />}
      {screen === "import" && <ImportPreview />}
      {screen === "profile" && <ProfileModalPreview />}
    </PreviewShell>
  );
}

function PreviewShell({
  children,
  screen,
}: {
  children: ReactNode;
  screen: PreviewScreen;
}) {
  return (
    <div className="min-h-screen bg-[oklch(0.985_0.012_172)] text-foreground dark:bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border/70 bg-card/92 backdrop-blur lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-border/70 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ContactRound className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <Link to="/dashboard/ui-preview/setup" className="font-semibold tracking-normal">
              ContactBook
            </Link>
            <p className="text-xs text-muted-foreground">Setup console</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {previewNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  isActive && "bg-secondary text-secondary-foreground",
                )
              }
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border/70 p-3">
          <div className="rounded-md bg-secondary/60 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" />
              WhatsApp ready
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Contacts become useful after setup through the WhatsApp bot.
            </p>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/86 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard/ui-preview/setup"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "lg:hidden")}
            >
              <ContactRound className="h-4 w-4" aria-hidden="true" />
              ContactBook
            </Link>
            <div className="hidden lg:block">
              <p className="text-sm font-medium">
                {screen === "setup" && "Setup cockpit"}
                {screen === "import" && "Import contacts"}
                {screen === "profile" && "Profile setup"}
              </p>
              <p className="text-xs text-muted-foreground">One-time web setup for WhatsApp-first contact management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button type="button" variant="outline" size="icon" aria-label="Open profile menu">
              <UserCircle className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </header>
        <main className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

function SetupCockpit() {
  return (
    <>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <Badge variant="secondary" className="mb-4 gap-1.5">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Setup in progress
              </Badge>
              <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
                Get your contacts ready for WhatsApp.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
                Complete the web setup once, then ask ContactBook for people, context, and cards
                from WhatsApp whenever you need them.
              </p>
            </div>
            <Link
              to="/dashboard/ui-preview/import"
              className={cn(buttonVariants(), "w-full sm:w-auto")}
            >
              Continue setup
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-5">
            {setupSteps.map((step, index) => (
              <div
                key={step.label}
                className={cn(
                  "min-h-28 rounded-lg border border-border bg-background p-3",
                  index === 2 && "border-primary/45 bg-primary/5",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-md border text-xs font-semibold",
                      step.complete
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {step.complete ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
                  </span>
                  <span className="text-xs text-muted-foreground">{step.state}</span>
                </div>
                <p className="mt-4 text-sm font-medium leading-5">{step.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-[oklch(0.18_0.035_170)] p-5 text-white shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white/72">WhatsApp handoff</p>
              <h2 className="mt-1 text-xl font-semibold">Daily use starts in chat</h2>
            </div>
            <MessageCircle className="h-5 w-5 text-[oklch(0.78_0.18_150)]" aria-hidden="true" />
          </div>
          <div className="mt-5 space-y-3">
            {["Find Maya's number", "Who do I know at Acme?", "Share my investor card"].map(
              (message) => (
                <div key={message} className="rounded-lg bg-white/10 p-3 text-sm text-white/92">
                  {message}
                </div>
              ),
            )}
          </div>
          <div className="mt-5 rounded-lg bg-[oklch(0.78_0.18_150)]/15 p-3 text-sm leading-6 text-white/78">
            Import contacts and create a card to make these WhatsApp actions useful.
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">Next action</h2>
              <p className="mt-1 text-sm text-muted-foreground">Connect contacts before creating cards.</p>
            </div>
            <Badge variant="warning">Recommended</Badge>
          </div>
          <div className="mt-5 rounded-lg border border-border bg-background p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <UploadCloud className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium">Connect Google Contacts</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Sync the contacts you already have, then manage them from ContactBook.
                </p>
              </div>
              <ChevronRight className="mt-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">Workspace snapshot</h2>
              <p className="mt-1 text-sm text-muted-foreground">Mock data for layout review.</p>
            </div>
            <Badge variant="success">Healthy</Badge>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["248", "Contacts"],
              ["1", "Card"],
              ["Today", "Last sync"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-lg border border-border bg-background p-4">
                <p className="text-2xl font-semibold">{value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function ImportPreview() {
  return (
    <>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm md:p-6">
          <Badge variant="secondary">Contact sources</Badge>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
                Import contacts for WhatsApp search.
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground md:text-base">
                Google is connected. Sync contacts here, then inspect and organize them from the
                contacts directory.
              </p>
            </div>
            <Button type="button">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Sync contacts
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Import status</h2>
              <p className="mt-1 text-sm text-muted-foreground">Google Contacts</p>
            </div>
            <Badge variant="success">Connected</Badge>
          </div>
          <div className="mt-5 space-y-3">
            {[
              ["Imported contacts", "248"],
              ["Google contacts", "248"],
              ["Last sync", "Today, 11:42 AM"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-semibold">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {importSources.map((source) => (
          <div
            key={source.title}
            className={cn(
              "flex min-h-64 flex-col rounded-lg border border-border bg-card p-5 shadow-sm",
              source.active && "border-primary/35 bg-primary/5",
              !source.active && "bg-card/78",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-secondary text-primary">
                <source.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <Badge variant={source.active ? "success" : "outline"}>{source.badge}</Badge>
            </div>
            <div className="mt-5 flex-1">
              <h2 className="text-lg font-semibold tracking-normal">{source.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{source.description}</p>
            </div>
            {source.active ? (
              <Button type="button" className="mt-5 w-full">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Sync contacts
              </Button>
            ) : (
              <Button type="button" className="mt-5 w-full" variant="outline" disabled>
                <Lock className="h-4 w-4" aria-hidden="true" />
                {source.title === "VCF upload" ? "Upload" : "Connect now"}
              </Button>
            )}
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="font-semibold">What import enables</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Imported contacts become searchable records that ContactBook can use when you ask the
            WhatsApp bot for people, context, or shareable cards.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Recent contacts</h2>
              <p className="mt-1 text-sm text-muted-foreground">A compact directory preview.</p>
            </div>
            <Link to="/dashboard/contacts" className={buttonVariants({ variant: "outline", size: "sm" })}>
              View contacts
            </Link>
          </div>
          <div className="space-y-2">
            {recentContacts.map((contact) => (
              <div key={contact.name} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-sm font-semibold text-secondary-foreground">
                    {contact.name.split(" ").map((part) => part[0]).join("")}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{contact.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{contact.detail}</p>
                  </div>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:block">{contact.meta}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function ProfileModalPreview() {
  return (
    <div className="relative min-h-[calc(100vh-7rem)] overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="grid gap-4 p-5 opacity-35 lg:grid-cols-2">
        <div className="h-52 rounded-lg border border-border bg-background" />
        <div className="h-52 rounded-lg border border-border bg-background" />
        <div className="h-52 rounded-lg border border-border bg-background lg:col-span-2" />
      </div>
      <div className="absolute inset-0 bg-background/52 backdrop-blur-[2px]" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="max-h-[calc(100vh-8rem)] w-full max-w-5xl overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-border p-5">
            <div>
              <Badge variant="secondary">Step 1 of 5</Badge>
              <h1 className="mt-3 text-2xl font-semibold tracking-normal">Personal profile</h1>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Add the details ContactBook should use when creating cards and resolving your contacts.
              </p>
            </div>
            <Button type="button" variant="outline" size="icon" aria-label="Close profile setup">
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="grid border-b border-border bg-muted/30 px-5 py-3 sm:grid-cols-5">
            {["Personal", "Work", "Business", "Socials", "Financial"].map((step, index) => (
              <button
                key={step}
                type="button"
                className={cn(
                  "h-9 rounded-md px-3 text-sm font-medium text-muted-foreground",
                  index === 0 && "bg-background text-foreground shadow-sm",
                )}
              >
                {step}
              </button>
            ))}
          </div>

          <div className="max-h-[calc(100vh-22rem)] overflow-y-auto p-5">
            <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="rounded-lg border border-dashed border-border bg-background p-4">
                <div className="flex aspect-square items-center justify-center rounded-md bg-secondary text-primary">
                  <UserRound className="h-8 w-8" aria-hidden="true" />
                </div>
                <Button type="button" variant="outline" className="mt-4 w-full">
                  Upload photo
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" value="Rishabh" />
                <Field label="Last name" value="Goyal" />
                <Field label="Primary email" value="rishabh@example.com" />
                <Field label="Phone" value="+91 98765 43210" />
                <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
                  <span>Short bio</span>
                  <textarea
                    className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    defaultValue="ContactBook helps me keep the right relationship context available from WhatsApp."
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {[
                { icon: Building2, title: "Work identity", text: "Company, title, and role context." },
                { icon: BadgeCheck, title: "Card readiness", text: "Used for shareable ContactBook cards." },
                { icon: Search, title: "WhatsApp lookup", text: "Helps the bot resolve you and your records." },
              ].map((item) => (
                <div key={item.title} className="rounded-lg border border-border bg-background p-4">
                  <item.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="ghost">
              Skip for now
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline">
                Back
              </Button>
              <Button type="button">
                Save and continue
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      <span>{label}</span>
      <Input defaultValue={value} />
    </label>
  );
}
