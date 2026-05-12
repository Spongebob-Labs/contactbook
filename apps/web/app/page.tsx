import type { HealthStatus } from "@repo/types";

const sample: HealthStatus = {
  status: "ok",
  timestamp: new Date().toISOString(),
};

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Monorepo template
      </h1>
      <p className="max-w-md text-center text-[15px] text-muted-foreground">
        Next.js App Router, Tailwind v4, shadcn base-nova, and shared{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
          @repo/types
        </code>{" "}
        are wired. Run the API and open{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
          /api/docs
        </code>{" "}
        for Swagger.
      </p>
      <pre className="mt-2 rounded-lg border border-border bg-card p-4 text-left text-sm text-card-foreground">
        {JSON.stringify(sample, null, 2)}
      </pre>
    </div>
  );
}
