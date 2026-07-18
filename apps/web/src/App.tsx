import { lazy, Suspense, useEffect } from "react";
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
    return "Cards | ContactBook";
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
              <ProtectedRoute>
                <Navigate to="/dashboard?onboarding=profile&flow=setup" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding/import"
            element={
              <ProtectedRoute>
                <Navigate to="/dashboard?onboarding=import&flow=setup" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding/card"
            element={
              <ProtectedRoute>
                <Navigate to="/dashboard" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/theme-preview"
            element={
              <ProtectedRoute>
                <ThemePreviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/cards"
            element={
              <ProtectedRoute>
                <CardsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/cards/:cardId"
            element={
              <ProtectedRoute>
                <CardDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/contacts/:contactId"
            element={
              <ProtectedRoute>
                <ContactDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/contacts"
            element={
              <ProtectedRoute>
                <ContactsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/import"
            element={
              <ProtectedRoute>
                <ImportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute>
                <Navigate to="/dashboard" replace />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppErrorBoundary>
  );
}
