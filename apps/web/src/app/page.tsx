"use client";

import { useEffect, useState } from "react";
import type { HealthStatus } from "@repo/types";
import { getHealth } from "@/lib/api";

export default function Home() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to reach API"),
      );
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-zinc-50 px-6 font-sans dark:bg-black">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
          contactbook
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Next.js + NestJS monorepo
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-full border border-black/[.08] px-5 py-2.5 text-sm dark:border-white/[.145]">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${
            health
              ? "bg-green-500"
              : error
                ? "bg-red-500"
                : "bg-yellow-500 animate-pulse"
          }`}
        />
        <span className="text-zinc-700 dark:text-zinc-300">
          {health
            ? `API ${health.status} — ${new Date(health.timestamp).toLocaleTimeString()}`
            : error
              ? `API unreachable: ${error}`
              : "Checking API…"}
        </span>
      </div>
    </div>
  );
}
