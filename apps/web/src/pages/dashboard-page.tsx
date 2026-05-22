import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  IdCard,
  Import,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SampleDataNotice } from "@/components/sample-data-notice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { logUiError } from "@/lib/friendly-errors";
import { mockCards, mockContactListResponse, mockContactsBySource, mockProfile } from "@/lib/mock-data";
import type {
  ContactCard,
  ContactImportSummary,
  ContactListResponse,
  ProfileMeResponse,
} from "@/lib/types";
import { CardOnboardingModal } from "@/pages/card-onboarding-page";
import { ImportOnboardingModal } from "@/pages/import-onboarding-page";
import { ProfileOnboardingModal } from "@/pages/profile-onboarding-page";

type OnboardingStep = "profile" | "import" | "card";

function getOnboardingStep(value: string | null): OnboardingStep | null {
  if (value === "profile" || value === "import" || value === "card") {
    return value;
  }
  return null;
}

function getSafeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  return value;
}

function hasInitializedProfile(profile: ProfileMeResponse | null) {
  if (!profile) {
    return false;
  }
  return Boolean(
    profile.personal.groupId ||
      profile.work.length > 0 ||
      profile.business.length > 0 ||
      profile.socials.length > 0 ||
      profile.financial.bankAccounts.length > 0 ||
      profile.financial.digitalWallets.length > 0 ||
      profile.financial.cryptoWallets.length > 0,
  );
}

function getGoogleImportSummary(summary: ContactImportSummary | null) {
  return summary?.bySource.find((item) => item.source === "GOOGLE") ?? null;
}

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [cards, setCards] = useState<ContactCard[]>([]);
  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [importSummary, setImportSummary] = useState<ContactImportSummary | null>(null);
  const [isMockData, setIsMockData] = useState(false);
  const onboardingStep = getOnboardingStep(searchParams.get("onboarding"));
  const returnTo = getSafeReturnPath(searchParams.get("returnTo"));
  const isSetupFlow = searchParams.get("flow") === "setup";
  const hasProfileDetails = hasInitializedProfile(profile);
  const googleSummary = getGoogleImportSummary(importSummary);
  const hasGoogleImport = Boolean(
    googleSummary?.hasSyncToken ||
      googleSummary?.lastSyncAt ||
      googleSummary?.activeCount,
  );
  const hasCards = cards.length > 0;
  const isWorkspaceStarted = hasGoogleImport || hasCards;
  const stats = [
    {
      label: "Imported contacts",
      value: String(importSummary?.totalActive ?? 0),
      detail: hasGoogleImport ? "Google import active" : "No imports yet",
      to: "/dashboard/contacts",
      action: "View contacts",
    },
    {
      label: "Cards",
      value: String(cards.length),
      detail: hasCards ? "Ready to share" : "Create your first card",
      to: "/dashboard/cards",
      action: "View cards",
    },
  ];
  const todayItems = [
    {
      icon: UserRound,
      label: hasProfileDetails ? "Profile details" : "Complete profile",
      state: hasProfileDetails ? "Started" : "Optional",
    },
    {
      icon: Import,
      label: hasGoogleImport ? "Google import" : "Connect Google",
      state: hasGoogleImport ? "Active" : "Ready",
    },
    {
      icon: IdCard,
      label: hasCards ? "Cards" : "Create card",
      state: hasCards ? "Done" : "Next",
    },
    {
      icon: Sparkles,
      label: "Sync imports",
      state: hasGoogleImport ? "Available" : "After connect",
    },
    { icon: ShieldCheck, label: "Privacy", state: "Enabled" },
  ];

  const setOnboardingStep = useCallback(
    (step: OnboardingStep | null) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (step) {
          next.set("onboarding", step);
        } else {
          next.delete("onboarding");
        }
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const finishProfileStep = useCallback(() => {
    if (returnTo) {
      navigate(returnTo, { replace: true });
      return;
    }
    if (!isSetupFlow) {
      setOnboardingStep(null);
      return;
    }
    setOnboardingStep("import");
  }, [isSetupFlow, navigate, returnTo, setOnboardingStep]);

  const loadOverview = useCallback(async (shouldUpdate: () => boolean = () => true) => {
    try {
      const [profileData, contactsData, googleContactsData] = await Promise.all([
        apiFetch<ProfileMeResponse>("/v1/profile/me"),
        apiFetch<ContactListResponse>("/v1/contacts?limit=1"),
        apiFetch<ContactListResponse>(
          "/v1/contacts?source=GOOGLE&limit=1&sort=updatedAt&sortOrder=desc",
        ),
      ]);
      const summaryData: ContactImportSummary = {
        totalActive: contactsData.total,
        totalDeleted: 0,
        bySource:
          googleContactsData.total > 0
            ? [
                {
                  source: "GOOGLE",
                  activeCount: googleContactsData.total,
                  deletedCount: 0,
                  lastSyncAt: googleContactsData.items[0]?.updatedAt ?? null,
                },
              ]
            : [],
      };
      if (shouldUpdate()) {
        setProfile(profileData);
        setImportSummary(summaryData);
        setIsMockData(false);
      }
    } catch (error) {
      logUiError("Could not load dashboard overview", error);
      if (shouldUpdate()) {
        const googleContactsData = mockContactsBySource("GOOGLE");
        setProfile(mockProfile);
        setImportSummary({
          totalActive: mockContactListResponse.total,
          totalDeleted: 0,
          bySource: [
            {
              source: "GOOGLE",
              activeCount: googleContactsData.total,
              deletedCount: 0,
              lastSyncAt: googleContactsData.items[0]?.updatedAt ?? null,
            },
          ],
        });
        setIsMockData(true);
      }
    }
  }, []);

  const loadCards = useCallback(async (shouldUpdate: () => boolean = () => true) => {
    try {
      const data = await apiFetch<ContactCard[]>("/v1/cards");
      if (shouldUpdate()) {
        setCards(data);
      }
    } catch (error) {
      logUiError("Could not load dashboard cards", error);
      if (shouldUpdate()) {
        setCards(mockCards);
        setIsMockData(true);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    void Promise.all([
      loadCards(() => isMounted),
      loadOverview(() => isMounted),
    ]);
    return () => {
      isMounted = false;
    };
  }, [loadCards, loadOverview]);

  return (
    <AppShell>
      {isMockData && <SampleDataNotice />}

      <section className="grid gap-4 md:grid-cols-2">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-2xl">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">{stat.detail}</p>
              <Link
                to={stat.to}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {stat.action}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
            <CardDescription>
              {isWorkspaceStarted ? "Workspace status" : "Recommended next steps"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {todayItems.map((item) => (
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

      {onboardingStep === "profile" && (
        <ProfileOnboardingModal
          onComplete={() => {
            void loadOverview();
            finishProfileStep();
          }}
          onSkip={finishProfileStep}
        />
      )}
      {onboardingStep === "import" && (
        <ImportOnboardingModal
          mode={isSetupFlow ? "setup" : "create"}
          onSkip={() => {
            if (isSetupFlow) {
              setOnboardingStep(null);
              return;
            }
            setOnboardingStep("card");
          }}
        />
      )}
      {onboardingStep === "card" && (
        <CardOnboardingModal
          mode={isSetupFlow ? "setup" : "create"}
          onComplete={(card) => {
            setCards((current) =>
              current.some((item) => item.id === card.id) ? current : [card, ...current],
            );
            navigate("/dashboard", { replace: true });
            void Promise.all([loadCards(), loadOverview()]);
          }}
          onSkip={() => setOnboardingStep(null)}
        />
      )}
    </AppShell>
  );
}
