import type { HealthStatus } from "@repo/types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export async function getHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API responded ${res.status}`);
  }
  return res.json() as Promise<HealthStatus>;
}
