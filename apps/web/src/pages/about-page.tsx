import {
  ArrowRight,
  CheckCircle2,
  Globe2,
  HeartHandshake,
  Network,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPageShell } from "@/components/public-page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { publicContactImages } from "@/lib/public-images";
import { usePublicReveal } from "@/lib/use-public-reveal";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Belief", href: "#belief" },
  { label: "Mission", href: "#mission" },
  { label: "Vision", href: "#vision" },
  { label: "Contact", href: "/contact" },
];

const relationshipContexts = [
  "Professional",
  "Social",
  "Personal",
];

const principles = [
  {
    icon: HeartHandshake,
    title: "Relationships first",
    description:
      "ContactBook is built around maintaining meaningful relationships, not collecting static records.",
  },
  {
    icon: Network,
    title: "Dynamic connectivity",
    description:
      "The product centers on contact details that can move with people as they change numbers, homes, jobs, and contexts.",
  },
  {
    icon: UsersRound,
    title: "Consumer-centric utility",
    description:
      "The experience should be simple enough for individuals and flexible enough for broader networks.",
  },
];

function AboutConnector() {
  return (
    <svg className="pointer-events-none absolute right-[-14rem] top-16 w-[54rem] text-public-teal/18" viewBox="0 0 760 360" fill="none" aria-hidden="true">
      <path
        className="public-draw-path"
        pathLength="1"
        d="M21 270C126 83 286 336 401 153C496 3 620 57 737 26"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        className="public-draw-path"
        pathLength="1"
        d="M82 330C221 223 306 279 426 212C546 146 591 245 711 139"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.5"
      />
      {["90 330", "401 153", "737 26", "426 212", "711 139"].map((point) => {
        const [cx, cy] = point.split(" ");
        return <circle key={point} cx={cx} cy={cy} r="7" fill="currentColor" opacity="0.75" />;
      })}
    </svg>
  );
}

export default function AboutPage() {
  usePublicReveal();

  return (
    <PublicPageShell navItems={navItems}>
      <section className="relative isolate overflow-hidden bg-public-background py-24 sm:py-28">
        <AboutConnector />
        <p className="public-drift pointer-events-none absolute -right-8 top-12 font-public-display text-[8rem] leading-none text-public-teal/[0.06] sm:text-[13rem]">
          ABOUT
        </p>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="public-reveal max-w-4xl space-y-7">
            <Badge className="bg-public-hero text-public-charcoal">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              The power of connectivity
            </Badge>
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.38em] text-public-teal">
                About ContactBook
              </p>
              <h1 className="font-public-display text-6xl font-normal leading-[0.92] tracking-normal text-public-charcoal sm:text-7xl lg:text-8xl">
                We are in the business of connecting people.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-public-muted sm:text-xl">
                We believe connectivity is immeasurably valuable professionally,
                socially, and personally.
              </p>
            </div>
          </div>

          <div className="public-reveal mt-14 grid max-w-4xl gap-5 border-l border-public-teal/50 pl-5 sm:grid-cols-3">
            {relationshipContexts.map((context) => (
              <div key={context} className="space-y-1">
                <p className="font-public-display text-4xl text-public-teal">{context}</p>
                <p className="text-sm leading-5 text-public-muted">connectivity with purpose</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-public-surface-muted py-24">
        <div className="absolute inset-x-0 top-0 h-20 rounded-b-[55%] bg-public-background" />
        <p className="pointer-events-none absolute left-2 top-20 font-public-display text-[7rem] leading-none text-public-grey/[0.07] sm:text-[12rem]">
          VALUE
        </p>
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pt-10 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:px-8">
          <div className="public-reveal space-y-4">
            <Badge variant="outline" className="border-public-teal/40 text-public-teal">
              Staying connected
            </Badge>
            <h2 className="font-public-display text-5xl font-normal leading-tight tracking-normal text-public-charcoal sm:text-6xl">
              Connectivity should build relationships.
            </h2>
          </div>
          <div className="public-reveal space-y-7">
            <p className="text-base leading-8 text-public-muted">
              Over time, the market recognized value in individual social functions.
              Companies were built around professional networking, sharing photos,
              status updates, and staying connected.
            </p>
            <p className="border-l-2 border-public-teal/60 pl-5 text-xl leading-8 text-public-charcoal">
              The market uses connectivity to push content. ContactBook uses it to
              build relationships.
            </p>
          </div>
        </div>
      </section>

      <section id="belief" className="relative overflow-hidden bg-public-background py-24">
        <div className="pointer-events-none absolute right-[-14rem] top-16 h-[34rem] w-[34rem] rounded-[50%] border border-public-mint/25" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8">
          <div className="public-reveal space-y-5">
            <Badge className="bg-public-teal text-public-inverse">
              <HeartHandshake className="h-3.5 w-3.5" aria-hidden="true" />
              What we believe
            </Badge>
            <h2 className="font-public-display text-5xl font-normal leading-tight tracking-normal text-public-charcoal sm:text-6xl">
              Meaningful relationships deserve an address book that updates itself.
            </h2>
          </div>
          <div className="public-reveal space-y-6 text-base leading-8 text-public-muted">
            <p>
              ContactBook believes in maintaining meaningful relationships, so we
              created the address book that updates itself.
            </p>
            <p>
              The goal is simple: help people keep the right way to reach each other
              without relying on scattered chats, outdated business cards, or duplicate
              contact records.
            </p>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-public-charcoal py-24 text-public-inverse">
        <p className="pointer-events-none absolute right-4 top-8 font-public-display text-[7rem] leading-none text-public-inverse/[0.05] sm:text-[12rem]">
          PEOPLE
        </p>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="public-reveal max-w-3xl space-y-4">
            <Badge className="bg-public-inverse text-public-charcoal">
              Relationship moments
            </Badge>
            <h2 className="font-public-display text-5xl font-normal leading-tight tracking-normal sm:text-6xl">
              ContactBook is designed for the moment after people meet.
            </h2>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {publicContactImages.slice(0, 3).map((image, index) => (
              <figure
                key={image.id}
                className="public-reveal overflow-hidden rounded-[1.5rem] bg-public-inverse/8"
                style={{ transitionDelay: `${index * 90}ms` }}
              >
                <img src={image.src} alt={image.alt} className="h-72 w-full object-cover" loading="lazy" />
                <figcaption className="space-y-2 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-public-mint">
                    {image.eyebrow}
                  </p>
                  <p className="text-sm leading-6 text-public-inverse/76">{image.caption}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section id="mission" className="relative overflow-hidden border-y border-public-border bg-public-surface-muted py-24">
        <p className="pointer-events-none absolute right-4 top-10 font-public-display text-[7rem] leading-none text-public-teal/[0.06] sm:text-[13rem]">
          MISSION
        </p>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="public-reveal max-w-4xl space-y-5">
            <Badge variant="outline" className="border-public-teal/40 text-public-teal">
              Our mission
            </Badge>
            <h2 className="font-public-display text-5xl font-normal leading-tight tracking-normal text-public-charcoal sm:text-6xl">
              Create a contact management ecosystem where dynamic connectivity enhances relationships.
            </h2>
            <p className="max-w-3xl text-base leading-8 text-public-muted">
              ContactBook is focused on innovative, consumer-centric solutions for
              individuals and organizations globally, helping contact management become
              more current, useful, and relationship-led.
            </p>
          </div>

          <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-3">
            {principles.map((principle, index) => (
              <div
                key={principle.title}
                className="public-reveal border-t border-public-border pt-5"
                style={{ transitionDelay: `${index * 90}ms` }}
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-public-background text-public-teal shadow-sm shadow-public-teal/10">
                  <principle.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-public-charcoal">{principle.title}</h3>
                <p className="mt-2 text-sm leading-6 text-public-muted">{principle.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="vision" className="relative overflow-hidden bg-public-background py-24">
        <div className="absolute inset-x-0 bottom-0 h-24 rounded-t-[55%] bg-public-charcoal" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:px-8">
          <div className="public-reveal space-y-4">
            <Badge className="bg-public-hero text-public-charcoal">
              <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
              Our vision
            </Badge>
            <h2 className="font-public-display text-5xl font-normal leading-tight tracking-normal text-public-charcoal sm:text-6xl">
              A trusted global solution for dynamic contact management.
            </h2>
          </div>
          <div className="public-reveal space-y-6">
            <p className="text-base leading-8 text-public-muted">
              ContactBook aims to become a superior solution to business cards and
              outdated contact management systems, helping individuals and organizations
              stay connected in an increasingly globalized and fast-paced world.
            </p>
            <div className="divide-y divide-public-border">
              {["Never lose contact", "Share with control", "Keep relationships current"].map((line) => (
                <div key={line} className="flex items-center gap-3 py-4">
                  <CheckCircle2 className="h-5 w-5 text-public-teal" aria-hidden="true" />
                  <span className="font-medium text-public-charcoal">{line}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-public-charcoal py-20 text-public-inverse">
        <p className="pointer-events-none absolute right-4 top-10 font-public-display text-[7rem] leading-none text-public-inverse/[0.05] sm:text-[12rem]">
          CONTACT
        </p>
        <div className="public-reveal relative mx-auto flex max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="max-w-2xl space-y-4">
            <Badge className="bg-public-inverse text-public-charcoal">ContactBook</Badge>
            <h2 className="font-public-display text-5xl font-normal leading-tight tracking-normal">
              Start with the address book that updates itself.
            </h2>
            <p className="text-sm leading-6 text-public-inverse/76">
              Create your profile or return to your ContactBook.
            </p>
          </div>
          <Link
            to="/auth"
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
