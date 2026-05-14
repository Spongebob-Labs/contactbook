import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001/api";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const providerAccessToken = session?.provider_token ?? null;
  const providerRefreshToken = session?.provider_refresh_token ?? null;
  const scope = (session as unknown as { provider_scope?: string | null })
    ?.provider_scope ?? null;
  const expiresAt =
    typeof session?.expires_at === "number"
      ? new Date(session.expires_at * 1000).toISOString()
      : null;

  if (!providerAccessToken || !providerRefreshToken) {
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?reason=missing_provider_tokens`,
    );
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("cb_access_token")?.value ?? null;
  if (!accessToken) {
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?reason=missing_api_session`,
    );
  }

  const r = await fetch(`${apiBase}/v1/integrations/google/link-provider`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      providerAccessToken,
      providerRefreshToken,
      expiresAt: expiresAt ?? undefined,
      scope: scope ?? undefined,
    }),
  });

  if (!r.ok) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error?reason=api_link_failed`);
  }

  const safeNext = next.startsWith("/") ? next : "/";
  return NextResponse.redirect(`${origin}${safeNext}`);
}

