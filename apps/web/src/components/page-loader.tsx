import { Skeleton } from "@/components/ui/skeleton";

export function PageLoader() {
  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Skeleton className="h-14 w-full" />
        <div className="grid gap-4 md:grid-cols-[1fr_320px]">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    </main>
  );
}
