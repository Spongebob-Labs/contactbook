import {
  ArrowRight,
  BadgeCheck,
  Bell,
  CheckCircle2,
  ContactRound,
  FolderSync,
  Layers3,
  LockKeyhole,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Features", href: "#features" },
  { label: "Security", href: "#security" },
  { label: "Workflow", href: "#workflow" },
];

const metrics = [
  { value: "One", label: "shared contact workspace" },
  { value: "Real-time", label: "team visibility" },
  { value: "Secure", label: "permission-aware access" },
];

const features = [
  {
    icon: ContactRound,
    title: "Unified contact profiles",
    description:
      "Bring identity, phone, email, notes, and relationship context into one profile your team can trust.",
  },
  {
    icon: UsersRound,
    title: "Team contact sharing",
    description:
      "Give the right people access to shared contacts without passing spreadsheets back and forth.",
  },
  {
    icon: Tag,
    title: "Groups and custom tags",
    description:
      "Organize relationships by client, region, expertise, priority, or any workflow your team already uses.",
  },
  {
    icon: Bell,
    title: "Notes and follow-ups",
    description:
      "Keep useful context next to the contact, so every conversation starts with the latest information.",
  },
];

const securityItems = [
  "Protected account access",
  "Permission-aware sharing",
  "Organized import workflows",
  "Privacy-first contact records",
];

const workflowItems = [
  {
    icon: Search,
    title: "Find the right contact",
    description: "Search across clean, structured contact data instead of hunting through scattered lists.",
  },
  {
    icon: FolderSync,
    title: "Import and organize",
    description: "Start from existing sources, then shape contacts into groups, tags, and profiles.",
  },
  {
    icon: ShieldCheck,
    title: "Share with confidence",
    description: "Keep collaboration focused by giving teams access to the contacts they need.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[oklch(0.985_0.012_190)] text-foreground dark:bg-background">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/88 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2" aria-label="ContactBook home">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-base font-semibold">ContactBook</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="transition-colors hover:text-foreground">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/auth" className={cn(buttonVariants({ variant: "ghost" }), "hidden sm:inline-flex")}>
              Sign in
            </Link>
            <Link to="/auth" className={buttonVariants()}>
              Get started
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-border/70 bg-background">
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.86fr)] lg:px-8">
          <div className="max-w-3xl space-y-7">
            <Badge variant="secondary" className="h-8 gap-2 px-3">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Contact management built for modern teams
            </Badge>
            <div className="space-y-5">
              <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-normal text-foreground sm:text-6xl lg:text-7xl">
                One reliable place for every contact your team depends on.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                ContactBook helps teams organize, share, and maintain contact records with the
                context needed to build stronger relationships.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to="/auth" className={cn(buttonVariants({ size: "lg" }), "h-12")}>
                Get started
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                to="/auth"
                className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-12")}
              >
                Sign in
              </Link>
            </div>
            <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.label} className="border-l border-border pl-4">
                  <p className="text-lg font-semibold">{metric.value}</p>
                  <p className="text-sm leading-5 text-muted-foreground">{metric.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-6 top-10 hidden h-28 w-28 rounded-lg bg-accent/45 blur-3xl lg:block" />
            <div className="relative overflow-hidden rounded-lg border border-border bg-card shadow-2xl shadow-primary/10">
              <div className="border-b border-border bg-muted/35 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
                    <span className="h-2.5 w-2.5 rounded-full bg-warning" />
                    <span className="h-2.5 w-2.5 rounded-full bg-success" />
                  </div>
                  <Badge variant="outline">Live workspace</Badge>
                </div>
              </div>
              <div className="grid gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
                <aside className="hidden border-r border-border bg-muted/25 p-4 md:block">
                  <div className="mb-5 h-9 rounded-md bg-primary/10" />
                  {["All contacts", "Shared groups", "Tags", "Imports"].map((item, index) => (
                    <div
                      key={item}
                      className={`mb-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                        index === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-current" />
                      {item}
                    </div>
                  ))}
                </aside>
                <div className="space-y-4 p-4 sm:p-6">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Team directory</p>
                      <h2 className="text-2xl font-semibold tracking-normal">Priority contacts</h2>
                    </div>
                    <Button size="sm" variant="secondary">
                      <UsersRound className="h-4 w-4" aria-hidden="true" />
                      Share group
                    </Button>
                  </div>

                  <div className="grid gap-3">
                    {[
                      ["Avery Johnson", "Partner lead", "Enterprise", "Updated today"],
                      ["Maya Patel", "Customer success", "Healthcare", "Shared with Sales"],
                      ["Noah Chen", "Finance advisor", "Investor", "Follow-up set"],
                    ].map(([name, role, tag, status]) => (
                      <div
                        key={name}
                        className="grid gap-3 rounded-lg border border-border bg-background p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-secondary font-semibold text-secondary-foreground">
                            {name
                              .split(" ")
                              .map((part) => part[0])
                              .join("")}
                          </div>
                          <div>
                            <p className="font-medium">{name}</p>
                            <p className="text-sm text-muted-foreground">{role}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{tag}</Badge>
                          <Badge variant="outline">{status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="bg-[oklch(0.985_0.012_190)] py-20 dark:bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl space-y-3">
            <Badge variant="outline">Core features</Badge>
            <h2 className="text-3xl font-semibold tracking-normal sm:text-4xl">
              Replace scattered contact lists with a shared operating system for relationships.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <Card key={feature.title} className="rounded-lg shadow-none">
                <CardContent className="space-y-5 p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <feature.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold">{feature.title}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">{feature.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="security" className="border-y border-border bg-background py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr_1fr] lg:px-8">
          <div className="space-y-4">
            <Badge variant="success" className="gap-2">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
              Secure by design
            </Badge>
            <h2 className="text-3xl font-semibold tracking-normal sm:text-4xl">
              Give teams access to contacts without losing control of the data.
            </h2>
            <p className="text-base leading-7 text-muted-foreground">
              ContactBook keeps the workspace centered on privacy, account protection, and
              organized sharing so your relationship data stays useful and intentional.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {securityItems.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
                <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
                <span className="font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="bg-[oklch(0.985_0.012_190)] py-20 dark:bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1fr] lg:items-end">
            <div className="space-y-3">
              <Badge variant="warning">Simple workflow</Badge>
              <h2 className="text-3xl font-semibold tracking-normal sm:text-4xl">
                Start with the contacts you have. Build the workspace your team needs.
              </h2>
            </div>
            <p className="text-base leading-7 text-muted-foreground">
              The first landing page pass focuses on the product promise: centralize contacts,
              organize them clearly, and share them with confidence.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {workflowItems.map((item, index) => (
              <div key={item.title} className="rounded-lg border border-border bg-card p-5">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-semibold text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-foreground py-16 text-background dark:bg-card dark:text-foreground">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="max-w-2xl space-y-2">
            <Badge className="bg-background text-foreground dark:bg-primary dark:text-primary-foreground">
              <BadgeCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Public landing page
            </Badge>
            <h2 className="text-3xl font-semibold tracking-normal">Ready to organize your team contacts?</h2>
            <p className="text-sm leading-6 text-background/75 dark:text-muted-foreground">
              Create an account or sign in to continue into the ContactBook workspace.
            </p>
          </div>
          <Link
            to="/auth"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-12 bg-background text-foreground hover:bg-background/90 dark:bg-primary dark:text-primary-foreground",
            )}
          >
            Get started
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
