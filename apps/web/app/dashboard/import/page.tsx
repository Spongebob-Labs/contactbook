import Link from "next/link";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DashboardImportPage({ searchParams }: Props) {
  const sp = await searchParams;
  const google = typeof sp.google === "string" ? sp.google : undefined;
  const reason = typeof sp.reason === "string" ? sp.reason : undefined;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Import</h1>
      {google === "connected" && (
        <p className="rounded-md border border-border bg-card px-4 py-3 text-sm text-card-foreground">
          Google is connected. You can run sync from the API when ready.
        </p>
      )}
      {google === "error" && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground">
          Google connection failed
          {reason ? (
            <>
              {" "}
              <span className="font-mono text-muted-foreground">({reason})</span>
            </>
          ) : null}
          .
        </p>
      )}
      {!google && (
        <p className="text-[15px] text-muted-foreground">
          Connect Google from the auth page after signing in, then return here to manage imports.
        </p>
      )}
      <Link href="/auth" className="text-sm text-primary underline-offset-4 hover:underline">
        Auth
      </Link>
    </div>
  );
}
