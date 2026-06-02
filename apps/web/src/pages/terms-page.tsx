import {
  AlertTriangle,
  BadgeCheck,
  FileCheck2,
  Handshake,
  LockKeyhole,
  Scale,
  Share2,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPageShell } from "@/components/public-page-shell";
import { Badge } from "@/components/ui/badge";
import { usePublicReveal } from "@/lib/use-public-reveal";

const navItems = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Terms", href: "#terms" },
  { label: "Contact", href: "/contact" },
];

const principles = [
  {
    icon: BadgeCheck,
    title: "Use accurate details",
    description:
      "ContactBook works best when account, profile, and contact details are current and provided honestly.",
  },
  {
    icon: Share2,
    title: "Share intentionally",
    description:
      "You are responsible for choosing what information to include in your profile, cards, and contact-sharing flows.",
  },
  {
    icon: ShieldCheck,
    title: "Respect the network",
    description:
      "Do not misuse ContactBook, scrape data, interfere with the service, or use contact information unlawfully.",
  },
];

const termsSections = [
  {
    title: "Acceptance Of These Terms",
    body: [
      "These Terms and Conditions govern your access to and use of ContactBook, including our public website, app, contact management features, profiles, cards, imports, and related services.",
      "By accessing or using ContactBook, you agree to these Terms. If you do not agree, you should not use the service.",
    ],
  },
  {
    title: "ContactBook Service",
    body: [
      "ContactBook helps users create contact profiles, share selected contact details, import contacts, manage contact records, and keep contact information more current over time.",
      "We may update, improve, suspend, or discontinue parts of the service from time to time. Some features may be released gradually or may depend on connected third-party services.",
    ],
  },
  {
    title: "Accounts And Eligibility",
    body: [
      "You must provide accurate information when creating or maintaining an account. You are responsible for keeping your account access secure and for activity that occurs through your account.",
      "You may not use ContactBook if you are prohibited from using the service under applicable law or if your account has been suspended or terminated for violating these Terms.",
    ],
  },
  {
    title: "Your Content And Contact Details",
    body: [
      "You remain responsible for the information, profile details, photos, logos, contact records, files, and other content you provide or import into ContactBook.",
      "You grant ContactBook permission to host, process, transmit, display, and use your content as needed to provide, secure, maintain, and improve the service.",
      "You confirm that you have the rights and permissions needed to provide or import content and contact information into ContactBook.",
    ],
  },
  {
    title: "Sharing And Connections",
    body: [
      "ContactBook is designed for controlled contact sharing. When you share a profile, card, or selected details, those details may become visible to the recipients or connected users you choose.",
      "You should review your information before sharing it. We are not responsible for how another user uses information after you choose to share it with them, except where applicable law provides otherwise.",
    ],
  },
  {
    title: "Acceptable Use",
    body: [
      "You agree not to misuse ContactBook, interfere with the service, attempt unauthorized access, reverse engineer protected parts of the service, upload malicious code, or use the service to violate the rights of others.",
      "You agree not to scrape, harvest, sell, spam, or unlawfully use contact information obtained through ContactBook.",
      "You agree not to provide false, misleading, infringing, unlawful, or harmful content through the service.",
    ],
  },
  {
    title: "Third-Party Services",
    body: [
      "ContactBook may integrate with third-party services, such as authentication, communications, hosting, storage, or contact-import providers. Your use of third-party services may be governed by their own terms and policies.",
      "We are not responsible for third-party services that we do not control, although we may rely on them to provide parts of ContactBook.",
    ],
  },
  {
    title: "Privacy",
    body: [
      "Our Privacy Policy explains how we collect, use, share, and protect information. By using ContactBook, you acknowledge that your information will be handled as described in the Privacy Policy.",
    ],
  },
  {
    title: "Intellectual Property",
    body: [
      "ContactBook, including its name, branding, design, software, features, and content, is owned by ContactBook or its licensors and is protected by applicable intellectual property laws.",
      "These Terms do not transfer ownership of ContactBook intellectual property to you. You may use the service only as permitted by these Terms.",
    ],
  },
  {
    title: "Service Availability",
    body: [
      "We aim to provide a reliable service, but ContactBook may be unavailable from time to time due to maintenance, updates, outages, third-party issues, security events, or circumstances outside our control.",
      "We do not guarantee that the service will always be uninterrupted, error-free, secure, or available in every location.",
    ],
  },
  {
    title: "Disclaimers",
    body: [
      "ContactBook is provided on an as-is and as-available basis to the fullest extent permitted by law.",
      "We do not guarantee that contact information will always be complete, accurate, current, or suitable for every use case. You are responsible for verifying important contact information before relying on it.",
    ],
  },
  {
    title: "Limitation Of Liability",
    body: [
      "To the fullest extent permitted by law, ContactBook will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of profits, revenue, data, goodwill, or business opportunities.",
      "Nothing in these Terms limits liability that cannot be limited under applicable law.",
    ],
  },
  {
    title: "Suspension And Termination",
    body: [
      "We may suspend or terminate access to ContactBook if we believe you have violated these Terms, created risk for the service or other users, or used the service unlawfully.",
      "You may stop using ContactBook at any time. Certain provisions of these Terms will continue to apply after your use of the service ends where necessary or appropriate.",
    ],
  },
  {
    title: "Changes To These Terms",
    body: [
      "We may update these Terms from time to time. When we make changes, we will update the effective date and, where appropriate, provide additional notice.",
      "Your continued use of ContactBook after updated Terms become effective means you accept the updated Terms.",
    ],
  },
  {
    title: "Governing Law",
    body: [
      "These generic Terms are intended as an interim draft. The governing law and dispute resolution language should be confirmed by ContactBook before publication as final legal terms.",
    ],
  },
  {
    title: "Contact Us",
    body: [
      "If you have questions about these Terms, contact us at info@contactbookapp.com.",
    ],
  },
];

const legalSignals = [
  { icon: FileCheck2, label: "Terms for public site and app" },
  { icon: Handshake, label: "User responsibilities" },
  { icon: LockKeyhole, label: "Account and service rules" },
  { icon: AlertTriangle, label: "Interim generic draft" },
];

export default function TermsPage() {
  usePublicReveal();

  return (
    <PublicPageShell navItems={navItems}>
      <section className="relative isolate overflow-hidden bg-public-charcoal py-24 text-public-inverse sm:py-28">
        <p className="public-drift pointer-events-none absolute -right-8 top-10 font-public-display text-[7rem] leading-none text-public-inverse/[0.06] sm:text-[13rem]">
          TERMS
        </p>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="public-reveal max-w-4xl space-y-7">
            <Badge className="border border-public-inverse/25 bg-public-inverse/12 text-public-inverse">
              <Scale className="h-3.5 w-3.5" aria-hidden="true" />
              Terms and Conditions
            </Badge>
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.38em] text-public-mint">
                Effective June 1, 2026
              </p>
              <h1 className="font-public-display text-6xl font-normal leading-[0.92] tracking-normal text-public-inverse sm:text-7xl lg:text-8xl">
                Rules for using ContactBook.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-public-inverse/78 sm:text-xl">
                These Terms explain the basic rules for using ContactBook, including
                your account, profile details, contact sharing, imported contacts, and
                connected services.
              </p>
            </div>
          </div>

          <div className="public-reveal mt-12 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {legalSignals.map((item) => (
              <div key={item.label} className="border-l border-public-mint/60 pl-4">
                <item.icon className="mb-3 h-5 w-5 text-public-mint" aria-hidden="true" />
                <p className="text-sm font-semibold text-public-inverse">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-public-background py-24">
        <div className="absolute inset-x-0 top-0 h-20 rounded-b-[55%] bg-public-charcoal" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pt-12 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:px-8">
          <div className="space-y-5">
            <Badge className="bg-public-hero text-public-charcoal">Plain-language summary</Badge>
            <h2 className="font-public-display text-5xl font-normal leading-tight tracking-normal text-public-charcoal sm:text-6xl">
              Keep your account honest and your sharing intentional.
            </h2>
            <p className="text-base leading-8 text-public-muted">
              ContactBook is built for relationships. These terms protect the service,
              the network, and the people whose contact details move through it.
            </p>
          </div>

          <div className="grid gap-5">
            {principles.map((item) => (
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

      <section id="terms" className="bg-public-surface-muted py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-10">
            {termsSections.map((section, index) => (
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
              For details about how ContactBook handles personal information, please
              read our{" "}
              <Link to="/privacy" className="font-semibold text-public-teal hover:text-public-charcoal">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}
