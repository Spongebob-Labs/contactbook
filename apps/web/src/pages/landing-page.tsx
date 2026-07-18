import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ContactRound,
  Globe2,
  HeartHandshake,
  IdCard,
  Layers3,
  LockKeyhole,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import heroCityImage from "@/assets/contactbook-hero-city.webp";
import { PublicImageCarousel } from "@/components/public-image-carousel";
import { PublicPageShell } from "@/components/public-page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { publicContactImages } from "@/lib/public-images";
import { usePublicReveal } from "@/lib/use-public-reveal";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Problems", href: "#problems" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Why it works", href: "#why-it-works" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

const proofPoints = [
  { value: "Current", label: "details that can keep pace with life" },
  { value: "Controlled", label: "share how much, how little, and with whom" },
  { value: "Complete", label: "fewer gaps, duplicates, and outdated records" },
];

const problems = [
  {
    icon: RefreshCw,
    title: "Outdated details",
    description:
      "People move home, switch jobs, open new email accounts, and change mobile numbers. Your address book can become outdated the moment it is updated.",
  },
  {
    icon: IdCard,
    title: "Incomplete records",
    description:
      "Business cards, old chats, and partial profiles leave important information scattered across different places.",
  },
  {
    icon: Layers3,
    title: "Duplicated contacts",
    description:
      "Multiple versions of the same person make it harder to know which number, email, or company detail is the right one.",
  },
];

const workflow = [
  {
    title: "Create your ContactBook",
    description: "Start with the details people need so your address book can update itself.",
  },
  {
    title: "Choose what to share",
    description: "Control how much or how little you share with each relationship.",
  },
  {
    title: "Stay connected",
    description: "Keep each other’s latest contact details as numbers, homes, jobs, and email addresses change.",
  },
];

const strengths = [
  {
    icon: ContactRound,
    title: "Connect",
    description: "Rapidly add people you meet and make a stronger introduction with your contact card.",
  },
  {
    icon: ShieldCheck,
    title: "Control",
    description: "Choose which contact details you share, with whom, and keep sharing intentional.",
  },
  {
    icon: RefreshCw,
    title: "Current",
    description: "Automatic updates help people keep each other’s latest contact details.",
  },
  {
    icon: BadgeCheck,
    title: "Concise",
    description: "A single ContactBook profile brings the details people need into one clear place.",
  },
  {
    icon: CheckCircle2,
    title: "Complete",
    description: "Reduce duplicates, gaps, and outdated information in the way people stay connected.",
  },
  {
    icon: LockKeyhole,
    title: "Secure",
    description: "A privacy-first contact experience keeps personal sharing deliberate and trusted.",
  },
];

const audiences = [
  "Individuals",
  "Networkers",
  "Frequent flyers",
  "Friends and family",
  "New connections",
  "Alumni networks",
];

function CurvedConnector({
  className,
  loop = false,
}: {
  className?: string;
  loop?: boolean;
}) {
  const primaryPathClassName = loop ? "public-hero-path-loop" : "public-draw-path";
  const secondaryPathClassName = loop
    ? "public-hero-path-loop public-hero-path-loop-slow"
    : "public-draw-path";
  const nodeClassName = loop ? "public-hero-node" : "";

  return (
    <svg className={cn("pointer-events-none absolute", className)} viewBox="0 0 760 360" fill="none" aria-hidden="true">
      <path
        className={primaryPathClassName}
        pathLength="1"
        d="M20 285C140 95 287 340 398 158C493 1 623 55 738 23"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        className={secondaryPathClassName}
        pathLength="1"
        d="M91 330C230 225 302 275 426 214C545 155 593 241 710 136"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.45"
      />
      {[["20", "285"], ["398", "158"], ["738", "23"], ["91", "330"], ["426", "214"], ["710", "136"]].map(
        ([cx, cy], index) => (
          <circle
            key={`${cx}-${cy}`}
            className={nodeClassName}
            cx={cx}
            cy={cy}
            r="7"
            fill="currentColor"
            opacity="0.88"
            style={loop ? { animationDelay: `${index * 0.42}s` } : undefined}
          />
        ),
      )}
    </svg>
  );
}

export default function LandingPage() {
  usePublicReveal();

  return (
    <PublicPageShell navItems={navItems}>
      <section className="relative isolate min-h-[calc(100vh-4rem)] overflow-hidden bg-public-charcoal text-public-inverse">
        <img
          src={heroCityImage}
          alt=""
          className="public-hero-image-motion absolute inset-0 -z-30 h-full w-full object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 -z-20 bg-public-charcoal/72" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-28 rounded-t-[55%] bg-public-background" />
        <CurvedConnector loop className="right-[-180px] top-16 z-0 w-[760px] text-public-mint/55" />
        <p className="public-drift pointer-events-none absolute -right-10 top-20 z-0 font-public-display text-[9rem] leading-none text-public-inverse/[0.05] sm:text-[13rem]">
          CONTACT
        </p>
        <p className="pointer-events-none absolute bottom-28 left-4 z-0 font-public-display text-[6rem] leading-none text-public-mint/[0.08] sm:left-12 sm:text-[10rem]">
          CB
        </p>

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col justify-center gap-10 px-4 pb-32 pt-20 sm:px-6 lg:px-8">
          <div className="public-reveal max-w-4xl space-y-7">
            <Badge className="border border-public-inverse/25 bg-public-inverse/12 text-public-inverse">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              The address book that updates itself
            </Badge>
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.38em] text-public-mint">
                Introducing ContactBook
              </p>
              <h1 className="max-w-5xl font-public-display text-6xl font-normal leading-[0.9] tracking-normal text-public-inverse sm:text-7xl lg:text-8xl">
                Never lose contact.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-public-inverse/82 sm:text-xl">
                The address book that updates itself helps people keep current,
                complete contact details without losing the relationships behind them.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                to="/dashboard"
                className={cn(buttonVariants({ size: "lg" }), "h-12 bg-public-teal text-public-inverse hover:bg-public-teal/90")}
              >
                Get started
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href="#problems"
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                  "h-12 border-public-inverse/35 bg-public-inverse/8 text-public-inverse hover:bg-public-inverse/15",
                )}
              >
                See the problem
              </a>
            </div>
          </div>

          <div className="public-reveal grid max-w-4xl gap-5 border-l border-public-mint/70 pl-5 sm:grid-cols-3">
            {proofPoints.map((point, index) => (
              <div
                key={point.label}
                className="public-hero-proof space-y-1"
                style={{ animationDelay: `${index * 0.9}s` }}
              >
                <p className="font-public-display text-3xl text-public-inverse">{point.value}</p>
                <p className="max-w-52 text-sm leading-5 text-public-inverse/72">{point.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-public-background py-20">
        <div className="pointer-events-none absolute -left-28 top-16 h-64 w-64 rounded-[48%] border border-public-teal/20" />
        <p className="pointer-events-none absolute right-4 top-6 font-public-display text-[7rem] leading-none text-public-teal/[0.06] sm:text-[12rem]">
          CON
        </p>
        <div className="public-reveal mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
          <div className="space-y-3">
            <Badge className="bg-public-hero text-public-charcoal">The power of connectivity</Badge>
            <h2 className="font-public-display text-5xl font-normal leading-tight tracking-normal text-public-charcoal sm:text-6xl">
              Focused on the value of staying connected.
            </h2>
          </div>
          <p className="text-base leading-8 text-public-muted">
            The market often uses connectivity to push content. ContactBook uses it to
            build relationships, helping people maintain the personal and professional
            links that matter over time.
          </p>
        </div>
      </section>

      <section id="problems" className="relative overflow-hidden bg-public-surface-muted py-24">
        <div className="absolute inset-x-0 top-0 h-20 rounded-b-[55%] bg-public-background" />
        <CurvedConnector className="left-[-220px] top-32 w-[760px] text-public-teal/18" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="public-reveal max-w-3xl space-y-4">
            <Badge variant="outline" className="border-public-teal/40 text-public-teal">
              The problems we solve
            </Badge>
            <h2 className="font-public-display text-5xl font-normal leading-tight tracking-normal text-public-charcoal sm:text-6xl">
              Your address book is almost certainly out of date.
            </h2>
            <p className="text-base leading-7 text-public-muted">
              In fact, an address book can be outdated the minute it is updated.
              ContactBook is built around a simple truth: contact details change,
              but relationships should not disappear because a phone number,
              address, or job title moved on.
            </p>
          </div>

          <div className="mt-12 divide-y divide-public-border/80">
            {problems.map((problem, index) => (
              <div
                key={problem.title}
                className="public-reveal grid gap-5 py-7 sm:grid-cols-[96px_180px_1fr] sm:items-start"
                style={{ transitionDelay: `${index * 90}ms` }}
              >
                <span className="font-public-display text-5xl text-public-teal/70">{String(index + 1).padStart(2, "0")}</span>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-public-teal/30 text-public-teal">
                    <problem.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-lg font-semibold text-public-charcoal">{problem.title}</h3>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-public-muted">{problem.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="relative overflow-hidden border-y border-public-border bg-public-background py-24">
        <p className="pointer-events-none absolute -left-8 top-14 font-public-display text-[8rem] leading-none text-public-grey/[0.08] sm:text-[14rem]">
          TACT
        </p>
        <div className="pointer-events-none absolute right-[-12rem] top-20 h-[34rem] w-[34rem] rounded-[50%] border border-public-mint/25" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
            <div className="public-reveal space-y-4">
              <Badge className="bg-public-teal text-public-inverse">How it works</Badge>
              <h2 className="font-public-display text-5xl font-normal leading-tight tracking-normal text-public-charcoal sm:text-6xl">
                The address book that updates itself starts with your card.
              </h2>
              <p className="text-base leading-7 text-public-muted">
                Start with the essentials, share intentionally, and give people a
                cleaner way to keep your latest details.
              </p>
            </div>

            <div className="relative">
              <svg className="absolute left-7 top-8 hidden h-[calc(100%-4rem)] w-16 text-public-teal/35 sm:block" viewBox="0 0 80 500" fill="none" aria-hidden="true">
                <path className="public-draw-path" pathLength="1" d="M39 2C74 118 7 205 42 312C66 385 32 428 41 498" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div className="space-y-8">
                {workflow.map((step, index) => (
                  <div
                    key={step.title}
                    className="public-reveal relative grid gap-4 pl-0 sm:grid-cols-[88px_1fr] sm:pl-0"
                    style={{ transitionDelay: `${index * 120}ms` }}
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-public-hero text-public-teal ring-8 ring-public-background">
                      <span className="font-public-display text-3xl">{index + 1}</span>
                    </div>
                    <div className="border-b border-public-border pb-8">
                      <h3 className="text-2xl font-semibold text-public-charcoal">{step.title}</h3>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-public-muted">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="why-it-works" className="relative overflow-hidden bg-public-surface-muted py-24">
        <div className="absolute inset-x-0 bottom-0 h-24 rounded-t-[55%] bg-public-background" />
        <CurvedConnector className="right-[-260px] top-10 w-[820px] text-public-teal/18" />
        <div className="relative mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
          <div className="public-reveal grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
            <div className="space-y-4">
              <Badge variant="outline" className="border-public-teal/40 text-public-teal">
                Why it works
              </Badge>
              <h2 className="font-public-display text-5xl font-normal leading-tight tracking-normal text-public-charcoal sm:text-6xl">
                Built for relationships, not just records.
              </h2>
            </div>
            <p className="text-base leading-7 text-public-muted">
              ContactBook turns contact management into a living connection layer:
              concise enough to use, complete enough to trust, current enough to
              matter, and controlled by the people sharing their details.
            </p>
          </div>

          <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {strengths.map((strength, index) => (
              <div
                key={strength.title}
                className="public-reveal group relative border-t border-public-border pt-5"
                style={{ transitionDelay: `${index * 70}ms` }}
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-public-background text-public-teal shadow-sm shadow-public-teal/10">
                  <strength.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-public-charcoal">{strength.title}</h3>
                <p className="mt-2 text-sm leading-6 text-public-muted">{strength.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-public-background py-24">
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.7fr_1.3fr] lg:items-center lg:px-8">
          <div className="public-reveal space-y-4">
            <Badge className="bg-public-hero text-public-charcoal">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Real connection moments
            </Badge>
            <h2 className="font-public-display text-5xl font-normal leading-tight tracking-normal text-public-charcoal sm:text-6xl">
              From first exchange to lasting contact.
            </h2>
            <p className="text-base leading-7 text-public-muted">
              ContactBook belongs in the everyday moments where people meet, exchange
              details, and need those details to stay useful.
            </p>
          </div>
          <div className="public-reveal">
            <PublicImageCarousel images={publicContactImages} className="rounded-[2rem]" />
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-public-surface-muted py-24">
        <p className="public-drift pointer-events-none absolute right-[-2rem] top-0 font-public-display text-[8rem] leading-none text-public-teal/[0.06] sm:text-[13rem]">
          PEOPLE
        </p>
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
          <div className="public-reveal space-y-4">
            <Badge className="bg-public-hero text-public-charcoal">
              <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
              Use cases
            </Badge>
            <h2 className="font-public-display text-5xl font-normal leading-tight tracking-normal text-public-charcoal sm:text-6xl">
              Designed for people and groups who rely on real networks.
            </h2>
            <p className="text-base leading-7 text-public-muted">
              From family and friends to frequent flyers, alumni networks, and new
              introductions, ContactBook helps contact details keep pace with the
              people behind them.
            </p>
          </div>

          <div className="public-reveal flex flex-wrap gap-3">
            {audiences.map((audience) => (
              <span
                key={audience}
                className="inline-flex items-center gap-2 rounded-full border border-public-border bg-public-surface px-4 py-2 text-sm font-medium text-public-charcoal"
              >
                <UsersRound className="h-4 w-4 text-public-teal" aria-hidden="true" />
                {audience}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="relative overflow-hidden bg-public-charcoal py-20 text-public-inverse">
        <div className="absolute inset-x-0 top-0 h-20 rounded-b-[55%] bg-public-background" />
        <CurvedConnector className="bottom-[-7rem] left-[-8rem] w-[760px] text-public-mint/22" />
        <p className="pointer-events-none absolute right-4 top-16 font-public-display text-[7rem] leading-none text-public-inverse/[0.05] sm:text-[12rem]">
          CONNECT
        </p>
        <div className="public-reveal relative mx-auto flex max-w-7xl flex-col gap-8 px-4 pt-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="max-w-2xl space-y-4">
            <Badge className="bg-public-inverse text-public-charcoal">
              <HeartHandshake className="h-3.5 w-3.5" aria-hidden="true" />
              ContactBook
            </Badge>
            <h2 className="font-public-display text-5xl font-normal leading-tight tracking-normal">
              Ready to make your details easier to share?
            </h2>
            <div className="flex flex-col gap-2 text-sm text-public-inverse/76 sm:flex-row sm:flex-wrap sm:gap-x-5">
              <span className="inline-flex items-center gap-2">
                <Phone className="h-4 w-4" aria-hidden="true" />
                +65 98204588
              </span>
              <span className="inline-flex items-center gap-2">
                <Mail className="h-4 w-4" aria-hidden="true" />
                info@contactbookapp.com
              </span>
            </div>
          </div>
          <Link
            to="/dashboard"
            className={cn(buttonVariants({ size: "lg" }), "h-12 bg-public-inverse text-public-charcoal hover:bg-public-inverse/90")}
          >
            Get started
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </PublicPageShell>
  );
}
