import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ContactRound,
  Globe2,
  HeartHandshake,
  LockKeyhole,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "How it works", href: "#features" },
  { label: "Privacy", href: "#security" },
  { label: "Connect", href: "#workflow" },
];

const metrics = [
  { value: "One", label: "profile people can save" },
  { value: "Two", label: "starter cards after setup" },
  { value: "Private", label: "sharing stays intentional" },
];

const features = [
  {
    icon: ContactRound,
    title: "Your details in one place",
    description:
      "Create a simple profile with the contact details you want family, friends, and new connections to keep.",
  },
  {
    icon: HeartHandshake,
    title: "Made for real relationships",
    description:
      "Share personal and business cards without asking people to copy numbers from scattered chats.",
  },
  {
    icon: UsersRound,
    title: "Keep connections close",
    description:
      "See the cards you have created and the people connected to you from a focused dashboard.",
  },
  {
    icon: Globe2,
    title: "Built for a global network",
    description:
      "Start with phone-first access and a profile that works naturally across countries and contexts.",
  },
];

const securityItems = [
  "WhatsApp-based account access",
  "Clear personal and business cards",
  "Control over what you share",
  "Contact records designed around people",
];

const workflowItems = [
  {
    icon: Search,
    title: "Create your profile",
    description: "Start with the essentials so your first card feels quick instead of overwhelming.",
  },
  {
    icon: BadgeCheck,
    title: "Get starter cards",
    description: "ContactBook prepares personal and business cards from your setup details.",
  },
  {
    icon: ShieldCheck,
    title: "Share intentionally",
    description: "Use the right card for the right relationship and keep improving it over time.",
  },
];

const relationshipMoments = [
  { name: "Maya", place: "Mumbai", detail: "Family card saved", initials: "MP" },
  { name: "Noah", place: "London", detail: "New number shared", initials: "NC" },
  { name: "Amina", place: "Nairobi", detail: "Business card updated", initials: "AO" },
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
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.9fr)] lg:px-8">
          <div className="max-w-3xl space-y-7">
            <Badge variant="secondary" className="h-8 gap-2 px-3">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              A personal network that stays current
            </Badge>
            <div className="space-y-5">
              <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-normal text-foreground sm:text-6xl lg:text-7xl">
                Help people keep the right way to reach you.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                ContactBook lets individuals create simple personal and business cards,
                share them with the people who matter, and keep contact details easier to maintain.
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
            <div className="relative overflow-hidden rounded-lg border border-border bg-card shadow-2xl shadow-primary/10">
              <div className="grid min-h-[520px] gap-0 md:grid-cols-[minmax(0,1fr)_210px]">
                <div className="flex flex-col justify-between gap-8 p-5 sm:p-7">
                  <div className="space-y-3">
                    <Badge variant="outline">Global contact card</Badge>
                    <h2 className="text-3xl font-semibold tracking-normal">Riya Sharma</h2>
                    <p className="max-w-md text-sm leading-6 text-muted-foreground">
                      Personal card for family, friends, and new connections.
                    </p>
                  </div>

                  <div className="relative rounded-lg border border-border bg-muted/35 p-4">
                    <div className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary text-lg font-semibold text-primary-foreground">
                      RS
                    </div>
                    <div className="space-y-2 pr-16">
                      <p className="text-sm font-medium text-muted-foreground">Shared details</p>
                      <p className="text-lg font-semibold">Phone, email, home city</p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Clean essentials first, with room to add more later.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {relationshipMoments.map((moment) => (
                      <div
                        key={moment.name}
                        className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-secondary font-semibold text-secondary-foreground">
                            {moment.initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium">{moment.name}</p>
                            <p className="truncate text-sm text-muted-foreground">{moment.place}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          {moment.detail}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <aside className="border-t border-border bg-[oklch(0.96_0.025_160)] p-5 dark:bg-muted/30 md:border-l md:border-t-0">
                  <div className="flex h-full flex-col justify-between gap-8">
                    <div className="space-y-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-background text-primary shadow-sm">
                        <Globe2 className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Across countries</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          Built for contact details that move with people.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {["Personal card", "Business card", "Connections"].map((item) => (
                        <div key={item} className="rounded-md bg-background/80 px-3 py-2 text-sm font-medium">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </aside>
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
              A cleaner way to introduce yourself and stay reachable.
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
              Keep sharing intentional from the first card.
            </h2>
            <p className="text-base leading-7 text-muted-foreground">
              ContactBook keeps setup focused on the details people actually need,
              while leaving room to add more when a relationship calls for it.
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
                Start with the essentials. Add depth when you need it.
              </h2>
            </div>
            <p className="text-base leading-7 text-muted-foreground">
              The first experience should feel light: create a profile, receive starter cards,
              and build your network without a long form getting in the way.
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
              ContactBook
            </Badge>
            <h2 className="text-3xl font-semibold tracking-normal">Ready to make your details easier to share?</h2>
            <p className="text-sm leading-6 text-background/75 dark:text-muted-foreground">
              Create an account or sign in to continue to your ContactBook.
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
