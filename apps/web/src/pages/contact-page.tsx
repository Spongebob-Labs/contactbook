import {
  ArrowRight,
  AtSign,
  BadgeCheck,
  Globe2,
  HeartHandshake,
  Mail,
  Phone,
  Sparkles,
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
  { label: "About", href: "/about" },
  { label: "Details", href: "#details" },
  { label: "Start", href: "/auth" },
];

const contactMethods = [
  {
    icon: Phone,
    label: "Phone",
    value: "+65 98204588",
    href: "tel:+6598204588",
  },
  {
    icon: Mail,
    label: "Email",
    value: "info@contactbookapp.com",
    href: "mailto:info@contactbookapp.com",
  },
  {
    icon: Globe2,
    label: "Website",
    value: "www.contactbookapp.com",
    href: "https://www.contactbookapp.com",
  },
  {
    icon: AtSign,
    label: "ContactID",
    value: "CP7007",
    href: undefined,
  },
];

function ContactPathGraphic() {
  return (
    <svg
      className="pointer-events-none absolute -right-48 top-20 w-[56rem] text-public-mint/32"
      viewBox="0 0 820 420"
      fill="none"
      aria-hidden="true"
    >
      <path
        className="public-draw-path"
        pathLength="1"
        d="M25 335C146 108 308 391 423 171C515 -5 665 58 795 38"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        className="public-draw-path"
        pathLength="1"
        d="M92 386C238 253 340 301 469 241C612 174 641 285 780 158"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.5"
      />
      {["25 335", "423 171", "795 38", "92 386", "469 241", "780 158"].map((point) => {
        const [cx, cy] = point.split(" ");
        return <circle key={point} cx={cx} cy={cy} r="7" fill="currentColor" opacity="0.8" />;
      })}
    </svg>
  );
}

export default function ContactPage() {
  usePublicReveal();

  return (
    <PublicPageShell navItems={navItems}>
      <section className="relative isolate overflow-hidden bg-public-charcoal py-24 text-public-inverse sm:py-28">
        <ContactPathGraphic />
        <p className="public-drift pointer-events-none absolute -right-8 top-10 font-public-display text-[7rem] leading-none text-public-inverse/[0.06] sm:text-[13rem]">
          CONTACT
        </p>
        <p className="pointer-events-none absolute bottom-8 left-4 font-public-display text-[6rem] leading-none text-public-mint/[0.08] sm:left-12 sm:text-[10rem]">
          CP7007
        </p>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="public-reveal max-w-4xl space-y-7">
            <Badge className="border border-public-inverse/25 bg-public-inverse/12 text-public-inverse">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              ContactBook
            </Badge>
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.38em] text-public-mint">
                Contact Us
              </p>
              <h1 className="font-public-display text-6xl font-normal leading-[0.92] tracking-normal text-public-inverse sm:text-7xl lg:text-8xl">
                Start a conversation.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-public-inverse/78 sm:text-xl">
                Reach ContactBook through the official details below, or create your
                profile to begin using the address book that updates itself.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                to="/auth"
                className={cn(buttonVariants({ size: "lg" }), "h-12 bg-public-teal text-public-inverse hover:bg-public-teal/90")}
              >
                Get started
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href="mailto:info@contactbookapp.com"
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                  "h-12 border-public-inverse/35 bg-public-inverse/8 text-public-inverse hover:bg-public-inverse/15",
                )}
              >
                Email us
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="details" className="relative overflow-hidden bg-public-background py-24">
        <div className="absolute inset-x-0 top-0 h-20 rounded-b-[55%] bg-public-charcoal" />
        <p className="pointer-events-none absolute right-4 top-24 font-public-display text-[7rem] leading-none text-public-teal/[0.06] sm:text-[12rem]">
          REACH
        </p>
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pt-12 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:px-8">
          <div className="public-reveal space-y-5">
            <Badge className="bg-public-hero text-public-charcoal">
              <HeartHandshake className="h-3.5 w-3.5" aria-hidden="true" />
              Official details
            </Badge>
            <h2 className="font-public-display text-5xl font-normal leading-tight tracking-normal text-public-charcoal sm:text-6xl">
              The right way to reach ContactBook.
            </h2>
            <p className="text-base leading-8 text-public-muted">
              These details are taken from the official ContactBook deck and kept as
              direct actions wherever possible.
            </p>
          </div>

          <div className="public-reveal divide-y divide-public-border">
            {contactMethods.map((method, index) => (
              <div
                key={method.label}
                className="grid gap-4 py-6 sm:grid-cols-[56px_140px_1fr]"
                style={{ transitionDelay: `${index * 90}ms` }}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-public-hero text-public-teal">
                  <method.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-public-grey">
                  {method.label}
                </p>
                {method.href ? (
                  <a
                    href={method.href}
                    className="w-fit text-xl font-semibold text-public-charcoal transition-colors hover:text-public-teal"
                    target={method.href.startsWith("http") ? "_blank" : undefined}
                    rel={method.href.startsWith("http") ? "noreferrer" : undefined}
                  >
                    {method.value}
                  </a>
                ) : (
                  <p className="text-xl font-semibold text-public-charcoal">{method.value}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-public-surface-muted py-24">
        <div className="pointer-events-none absolute -left-32 top-16 h-72 w-72 rounded-[48%] border border-public-teal/20" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_0.95fr] lg:items-center lg:px-8">
          <div className="public-reveal space-y-5">
            <Badge variant="outline" className="border-public-teal/40 text-public-teal">
              Never lose contact
            </Badge>
            <h2 className="font-public-display text-5xl font-normal leading-tight tracking-normal text-public-charcoal sm:text-6xl">
              Contact details should be clear, current, and easy to act on.
            </h2>
          </div>
          <div className="public-reveal border-l-2 border-public-teal/50 pl-6">
            <p className="text-base leading-8 text-public-muted">
              ContactBook is focused on helping people stay connected across personal,
              social, and professional relationships. The public site keeps that same
              idea simple: clear details, intentional sharing, and fewer lost contacts.
            </p>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-public-background py-24">
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8">
          <figure className="public-reveal overflow-hidden rounded-[2rem] bg-public-charcoal text-public-inverse">
            <img
              src={publicContactImages[4].src}
              alt={publicContactImages[4].alt}
              className="h-[28rem] w-full object-cover"
              loading="lazy"
            />
            <figcaption className="space-y-2 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-public-mint">
                {publicContactImages[4].eyebrow}
              </p>
              <p className="text-sm leading-6 text-public-inverse/76">{publicContactImages[4].caption}</p>
            </figcaption>
          </figure>

          <div className="public-reveal space-y-5">
            <Badge className="bg-public-hero text-public-charcoal">From contact to connection</Badge>
            <h2 className="font-public-display text-5xl font-normal leading-tight tracking-normal text-public-charcoal sm:text-6xl">
              Every message starts with having the right details.
            </h2>
            <p className="text-base leading-8 text-public-muted">
              Whether someone reaches you by phone, email, or ContactID, the goal is the
              same: make the next connection simple.
            </p>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-public-charcoal py-20 text-public-inverse">
        <p className="pointer-events-none absolute right-4 top-8 font-public-display text-[7rem] leading-none text-public-inverse/[0.05] sm:text-[12rem]">
          START
        </p>
        <div className="public-reveal relative mx-auto flex max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="max-w-2xl space-y-4">
            <Badge className="bg-public-inverse text-public-charcoal">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
              ContactBook
            </Badge>
            <h2 className="font-public-display text-5xl font-normal leading-tight tracking-normal">
              Ready to create your ContactBook?
            </h2>
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
