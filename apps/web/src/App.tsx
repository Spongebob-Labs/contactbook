import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { PageLoader } from "@/components/page-loader";
import { ProtectedRoute } from "@/components/protected-route";

const AuthPage = lazy(() => import("@/pages/auth-page"));
const AuthCallbackPage = lazy(() => import("@/pages/auth-callback-page"));
const AboutPage = lazy(() => import("@/pages/about-page"));
const CardDetailPage = lazy(() => import("@/pages/card-detail-page"));
const CardsPage = lazy(() => import("@/pages/cards-page"));
const ContactDetailPage = lazy(() => import("@/pages/contact-detail-page"));
const ContactPage = lazy(() => import("@/pages/contact-page"));
const ContactsPage = lazy(() => import("@/pages/contacts-page"));
const DashboardPage = lazy(() => import("@/pages/dashboard-page"));
const ImportPage = lazy(() => import("@/pages/import-page"));
const LandingPage = lazy(() => import("@/pages/landing-page"));
const PrivacyPage = lazy(() => import("@/pages/privacy-page"));
const ProfilePage = lazy(() => import("@/pages/profile-page"));
const TermsPage = lazy(() => import("@/pages/terms-page"));
const ThemePreviewPage = lazy(() => import("@/pages/theme-preview-page"));
const WhatsappTemplatesPage = lazy(
  () => import("@/pages/whatsapp-templates-page"),
);
const ConnectionsPage = lazy(() => import("@/pages/connections-page"));

function pageTitleForPath(pathname: string) {
  if (pathname === "/") {
    return "ContactBook | Living Contact Cards";
  }
  if (pathname === "/about") {
    return "About ContactBook | ContactBook";
  }
  if (pathname === "/contact") {
    return "Contact ContactBook | ContactBook";
  }
  if (pathname === "/privacy") {
    return "Privacy Policy | ContactBook";
  }
  if (pathname === "/terms") {
    return "Terms and Conditions | ContactBook";
  }
  if (pathname === "/auth") {
    return "Sign In | ContactBook";
  }
  if (pathname === "/auth/callback") {
    return "Connecting Account | ContactBook";
  }
  if (pathname === "/profile") {
    return "Profile | ContactBook";
  }
  if (pathname === "/dashboard") {
    return "Dashboard | ContactBook";
  }
  if (pathname === "/dashboard/theme-preview") {
    return "Theme Preview | ContactBook";
  }
  if (pathname === "/dashboard/cards") {
    return "My Cards | ContactBook";
  }
  if (pathname.startsWith("/dashboard/cards/")) {
    return "Card Details | ContactBook";
  }
  if (pathname === "/dashboard/contacts") {
    return "Contacts | ContactBook";
  }
  if (pathname.startsWith("/dashboard/contacts/")) {
    return "Contact Details | ContactBook";
  }
  if (pathname === "/dashboard/import") {
    return "Import Contacts | ContactBook";
  }
  if (pathname === "/dashboard/whatsapp-templates") {
    return "WhatsApp Templates | ContactBook";
  }
  if (pathname === "/dashboard/connections") {
    return "Connections | ContactBook";
  }
  if (pathname === "/onboarding/profile") {
    return "Profile Setup | ContactBook";
  }
  if (pathname === "/onboarding/import") {
    return "Import Setup | ContactBook";
  }
  if (pathname === "/onboarding/card") {
    return "Create Card | ContactBook";
  }
  return "ContactBook";
}

function DocumentTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = pageTitleForPath(pathname);
  }, [pathname]);

  return null;
}

function RouteScrollReset() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}

function Protected({ children }: { children: ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <AppErrorBoundary>
      <DocumentTitle />
      <RouteScrollReset />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          <Route
            path="/onboarding/profile"
            element={
              <Protected>
                <Navigate to="/dashboard?onboarding=profile&flow=setup" replace />
              </Protected>
            }
          />
          <Route
            path="/onboarding/import"
            element={
              <Protected>
                <Navigate to="/dashboard?onboarding=import&flow=setup" replace />
              </Protected>
            }
          />
          <Route
            path="/onboarding/card"
            element={
              <Protected>
                <Navigate to="/dashboard" replace />
              </Protected>
            }
          />
          <Route
            path="/profile"
            element={
              <Protected>
                <ProfilePage />
              </Protected>
            }
          />
          <Route
            path="/dashboard"
            element={
              <Protected>
                <DashboardPage />
              </Protected>
            }
          />
          <Route
            path="/dashboard/theme-preview"
            element={
              <Protected>
                <ThemePreviewPage />
              </Protected>
            }
          />
          <Route
            path="/dashboard/cards"
            element={
              <Protected>
                <CardsPage />
              </Protected>
            }
          />
          <Route
            path="/dashboard/cards/:cardId"
            element={
              <Protected>
                <CardDetailPage />
              </Protected>
            }
          />
          <Route
            path="/dashboard/contacts/:contactId"
            element={
              <Protected>
                <ContactDetailPage />
              </Protected>
            }
          />
          <Route
            path="/dashboard/contacts"
            element={
              <Protected>
                <ContactsPage />
              </Protected>
            }
          />
          <Route
            path="/dashboard/import"
            element={
              <Protected>
                <ImportPage />
              </Protected>
            }
          />
          <Route
            path="/dashboard/whatsapp-templates"
            element={
              <Protected>
                <WhatsappTemplatesPage />
              </Protected>
            }
          />
          <Route
            path="/dashboard/connections"
            element={
              <Protected>
                <ConnectionsPage />
              </Protected>
            }
          />
          <Route path="/dashboard/*" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppErrorBoundary>
  );
}
