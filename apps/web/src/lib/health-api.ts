import { apiFetch } from "@/lib/api";

export type HealthResponse = {
  status: "ok" | "degraded" | string;
  timestamp: string;
  whatsapp?: {
    ready?: boolean;
    error?: string;
  };
};

/** Public health probe (`GET /health`). */
export function fetchHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/v1/health", { retry: false });
}
