import Link from "next/link";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AuthCodeErrorPage({ searchParams }: Props) {
  const sp = await searchParams;
  const reason = typeof sp.reason === "string" ? sp.reason : undefined;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-8">
      <h1 className="text-xl font-semibold tracking-tight">Sign-in error</h1>
      <p className="text-sm text-muted-foreground">
        Something went wrong during authentication.
        {reason ? (
          <>
            {" "}
            <span className="font-mono text-foreground">reason={reason}</span>
          </>
        ) : null}
      </p>
      <Link href="/auth" className="text-sm text-primary underline-offset-4 hover:underline">
        Back to auth
      </Link>
    </div>
  );
}
