/** Shared types across apps. Replace with your domain models. */
export interface HealthStatus {
  status: "ok" | "degraded";
  timestamp: string;
}
