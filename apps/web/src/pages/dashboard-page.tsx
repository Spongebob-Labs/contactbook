import { Link } from "react-router-dom";
import { ArrowRight, Import, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const stats = [
  { label: "Contact sources", value: "1", detail: "Google ready" },
  { label: "Profile status", value: "New", detail: "Set up next" },
  { label: "Privacy", value: "On", detail: "Cookie session" },
];

export default function DashboardPage() {
  return (
    <AppShell>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-lg border border-border bg-card p-6 md:p-8">
          <Badge variant="success">MVP workspace</Badge>
          <div className="mt-5 max-w-3xl space-y-4">
            <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
              Start with your contact profile, then bring Google contacts in.
            </h1>
            <p className="text-base text-muted-foreground">
              ContactBook keeps profile setup and contact import in one focused
              workflow, so the first useful action is always close at hand.
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/onboarding/profile"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Complete profile
              <UserRound className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/dashboard/import"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Import Google contacts
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
            <CardDescription>Recommended next steps</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { icon: UserRound, label: "Complete profile", state: "Optional" },
              { icon: Import, label: "Connect Google", state: "Ready" },
              { icon: Sparkles, label: "Sync imports", state: "After connect" },
              { icon: ShieldCheck, label: "Review privacy", state: "Enabled" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-md border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">{item.state}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-2xl">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{stat.detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </AppShell>
  );
}
