import {
  Cookie,
  Database,
  Eye,
  FileText,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPageShell } from "@/components/public-page-shell";
import { Badge } from "@/components/ui/badge";
import { usePublicReveal } from "@/lib/use-public-reveal";

const navItems = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Summary", href: "#summary" },
  { label: "Contact", href: "/contact" },
];

const summaryItems = [
  {
    icon: UserCheck,
    title: "You choose what to share",
    description:
      "ContactBook is designed around intentional contact sharing, so your profile details should only be shared in the ways you choose.",
  },
  {
    icon: RefreshCw,
    title: "Your details can stay current",
    description:
      "We use your account and contact information to help keep contact records useful, current, and easier to maintain.",
  },
  {
    icon: LockKeyhole,
    title: "Session cookies are essential",
    description:
      "The app currently uses essential authentication cookies and local browser storage for core app functions, not advertising tracking.",
  },
];

const sections = [
  {
    title: "Information We Collect",
    body: [
      "We may collect information you provide directly, such as your name, phone number, email address, profile photo, company details, business details, addresses, social links, and other contact details you choose to add to your ContactBook profile.",
      "We may collect contact information you import or connect to the app, including contacts from files or connected services such as Google, where you authorize that access.",
      "We may collect account and authentication information, including verification details, session information, device or browser information, and basic technical logs needed to operate and protect the service.",
    ],
  },
  {
    title: "How We Use Information",
    body: [
      "We use information to provide, maintain, secure, and improve ContactBook, including account access, profile management, contact importing, contact deduplication, contact sharing, and contact updates.",
      "We use information to communicate with you about your account, service updates, security, support requests, and changes to our policies.",
      "We may use aggregated or de-identified information to understand product performance and improve the service, provided it does not identify you personally.",
    ],
  },
  {
    title: "How Sharing Works",
    body: [
      "ContactBook is built to help people exchange and maintain current contact details. When you share a card, connect with another user, or authorize a contact flow, selected profile details may be made available to the people or organizations you choose.",
      "You are responsible for reviewing the information on your profile and deciding what details are appropriate to share in each context.",
    ],
  },
  {
    title: "Cookies And Browser Storage",
    body: [
      "We use essential cookies and browser storage to keep you signed in, protect your session, remember app preferences, support authentication flows, and keep the app working correctly.",
      "Based on the current app implementation, we do not use advertising cookies or non-essential marketing tracking cookies. If we add analytics or marketing technologies later, we will update this policy and request consent where required.",
    ],
  },
  {
    title: "Third-Party Services",
    body: [
      "We may use trusted third-party providers to support hosting, authentication, communications, storage, contact importing, infrastructure, security, and related service operations.",
      "If you connect a third-party service, such as Google, that service may process your information according to its own terms and privacy policy. You can manage third-party permissions through that provider where available.",
    ],
  },
  {
    title: "Data Retention",
    body: [
      "We keep personal information for as long as needed to provide ContactBook, comply with legal obligations, resolve disputes, enforce agreements, and maintain security.",
      "You may request deletion of your account or certain personal information, subject to legal, security, backup, and operational requirements.",
    ],
  },
  {
    title: "Security",
    body: [
      "We use reasonable administrative, technical, and organizational safeguards designed to protect personal information. No online service can guarantee absolute security.",
      "You should keep your account access secure and tell us promptly if you believe your account or contact details have been accessed without authorization.",
    ],
  },
  {
    title: "Your Choices And Rights",
    body: [
      "Depending on where you live, you may have rights to access, correct, delete, restrict, object to, or receive a copy of certain personal information.",
      "You can contact us to make a privacy request. We may need to verify your identity before completing the request.",
    ],
  },
  {
    title: "Children",
    body: [
      "ContactBook is not intended for children. We do not knowingly collect personal information from children where parental consent is required by applicable law.",
      "If you believe a child has provided personal information to ContactBook, please contact us so we can review and take appropriate action.",
    ],
  },
  {
    title: "Changes To This Policy",
    body: [
      "We may update this Privacy Policy from time to time. When we make changes, we will update the effective date and, where appropriate, provide additional notice.",
    ],
  },
  {
    title: "Contact Us",
    body: [
      "If you have questions about this Privacy Policy or your personal information, contact us at info@contactbookapp.com.",
    ],
  },
];

const highlights = [
  { icon: Database, label: "Profile and contact data" },
  { icon: Cookie, label: "Essential cookies only" },
  { icon: Eye, label: "No current ad tracking" },
  { icon: FileText, label: "Generic policy draft" },
];

export default function PrivacyPage() {
  usePublicReveal();

  return (
    <PublicPageShell navItems={navItems}>
      <section className="relative isolate overflow-hidden bg-public-charcoal py-24 text-public-inverse sm:py-28">
        <p className="public-drift pointer-events-none absolute -right-8 top-10 font-public-display text-[7rem] leading-none text-public-inverse/[0.06] sm:text-[13rem]">
          PRIVACY
        </p>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="public-reveal max-w-4xl space-y-7">
            <Badge className="border border-public-inverse/25 bg-public-inverse/12 text-public-inverse">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Privacy Policy
            </Badge>
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.38em] text-public-mint">
                Effective June 1, 2026
              </p>
              <h1 className="font-public-display text-6xl font-normal leading-[0.92] tracking-normal text-public-inverse sm:text-7xl lg:text-8xl">
                Your contact details should stay yours.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-public-inverse/78 sm:text-xl">
                This Privacy Policy explains how ContactBook collects, uses, shares,
                and protects information when you use our public site and contact
                management app.
              </p>
            </div>
          </div>

          <div className="public-reveal mt-12 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {highlights.map((item) => (
              <div key={item.label} className="border-l border-public-mint/60 pl-4">
                <item.icon className="mb-3 h-5 w-5 text-public-mint" aria-hidden="true" />
                <p className="text-sm font-semibold text-public-inverse">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="summary" className="relative overflow-hidden bg-public-background py-24">
        <div className="absolute inset-x-0 top-0 h-20 rounded-b-[55%] bg-public-charcoal" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pt-12 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:px-8">
          <div className="space-y-5">
            <Badge className="bg-public-hero text-public-charcoal">Summary</Badge>
            <h2 className="font-public-display text-5xl font-normal leading-tight tracking-normal text-public-charcoal sm:text-6xl">
              Built around controlled sharing.
            </h2>
            <p className="text-base leading-8 text-public-muted">
              ContactBook helps people maintain current contact details while keeping
              control over what they share and with whom.
            </p>
          </div>

          <div className="grid gap-5">
            {summaryItems.map((item) => (
              <div key={item.title} className="grid gap-4 border-b border-public-border pb-6 sm:grid-cols-[52px_1fr]">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-public-hero text-public-teal">
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold tracking-normal text-public-charcoal">{item.title}</h3>
                  <p className="text-sm leading-7 text-public-muted">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-public-surface-muted py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-10">
            {sections.map((section, index) => (
              <section key={section.title} className="border-b border-public-border pb-10 last:border-b-0 last:pb-0">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-public-grey">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h2 className="font-public-display text-4xl font-normal tracking-normal text-public-charcoal">
                  {section.title}
                </h2>
                <div className="mt-5 space-y-4">
                  {section.body.map((paragraph) => (
                    <p key={paragraph} className="text-base leading-8 text-public-muted">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-public-background py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="border-l-2 border-public-teal/60 pl-6">
            <p className="text-base leading-8 text-public-muted">
              For related service rules, please read our{" "}
              <Link to="/terms" className="font-semibold text-public-teal hover:text-public-charcoal">
                Terms and Conditions
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}
