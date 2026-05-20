import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { PageLoader } from "@/components/page-loader";
import { ProtectedRoute } from "@/components/protected-route";

const AuthPage = lazy(() => import("@/pages/auth-page"));
const AuthCallbackPage = lazy(() => import("@/pages/auth-callback-page"));
const CardDetailPage = lazy(() => import("@/pages/card-detail-page"));
const CardsPage = lazy(() => import("@/pages/cards-page"));
const ContactDetailPage = lazy(() => import("@/pages/contact-detail-page"));
const ContactsPage = lazy(() => import("@/pages/contacts-page"));
const DashboardPage = lazy(() => import("@/pages/dashboard-page"));
const ImportPage = lazy(() => import("@/pages/import-page"));
const LandingPage = lazy(() => import("@/pages/landing-page"));
const ProfilePage = lazy(() => import("@/pages/profile-page"));
const SignedInRedesignPreviewPage = lazy(
  () => import("@/pages/signed-in-redesign-preview-page"),
);
const ThemePreviewPage = lazy(() => import("@/pages/theme-preview-page"));

export default function App() {
  return (
    <AppErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
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
                <Navigate to="/dashboard?onboarding=card" replace />
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
            path="/dashboard/ui-preview/:screen?"
            element={
              <ProtectedRoute>
                <SignedInRedesignPreviewPage />
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
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </AppErrorBoundary>
  );
}
