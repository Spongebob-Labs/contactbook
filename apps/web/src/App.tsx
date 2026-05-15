import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { PageLoader } from "@/components/page-loader";
import { ProtectedRoute } from "@/components/protected-route";

const AuthPage = lazy(() => import("@/pages/auth-page"));
const AuthCallbackPage = lazy(() => import("@/pages/auth-callback-page"));
const DashboardPage = lazy(() => import("@/pages/dashboard-page"));
const ImportPage = lazy(() => import("@/pages/import-page"));
const ProfilePage = lazy(() => import("@/pages/profile-page"));
const ProfileOnboardingPage = lazy(() => import("@/pages/profile-onboarding-page"));

export default function App() {
  return (
    <AppErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route
            path="/onboarding/profile"
            element={
              <ProtectedRoute>
                <ProfileOnboardingPage />
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
