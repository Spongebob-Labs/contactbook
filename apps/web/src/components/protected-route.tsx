import type { ReactNode } from "react";
// import { Navigate, useLocation } from "react-router-dom";
// import { PageLoader } from "@/components/page-loader";
// import { useAuth } from "@/context/auth-context";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  // --- Auth bypass: always render children for viewing ---
  // const { isAuthenticated, isLoading } = useAuth();
  // const location = useLocation();
  //
  // if (isLoading) {
  //   return <PageLoader />;
  // }
  //
  // if (!isAuthenticated) {
  //   return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  // }

  return children;
}
