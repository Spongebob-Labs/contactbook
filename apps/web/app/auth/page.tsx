"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { readSessionFromResponseHeaders } from "@/lib/api-auth-headers";
import { DIAL_COUNTRIES } from "@/lib/dial-countries";
import { buildE164 } from "@/lib/phone";

const apiBase =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001/api";

type Step = "phone" | "otp" | "register" | "done";

function formatApiError(data: unknown): string {
  if (data && typeof data === "object" && "message" in data) {
    const m = (data as { message: unknown }).message;
    if (typeof m === "string") {
      return m;
    }
    if (Array.isArray(m)) {
      return m.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join("; ");
    }
  }
  return JSON.stringify(data);
}

function nationalDigits(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^0+/, "");
}

export default function AuthPage() {
  const [step, setStep] = useState<Step>("phone");
  const [countryIso, setCountryIso] = useState("US");
  const [national, setNational] = useState("");
  const [code, setCode] = useState("");
  const [phoneVerifyToken, setPhoneVerifyToken] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{
    userId: string;
    accessToken: string;
    refreshToken: string;
  } | null>(null);
  const persistApiTokens = (accessToken: string, refreshToken: string) => {
    // Keep it simple for now: a cookie for server routes (oauth callback),
    // and localStorage for client usage.
    document.cookie = `cb_access_token=${encodeURIComponent(accessToken)}; Path=/; SameSite=Lax`;
    document.cookie = `cb_refresh_token=${encodeURIComponent(refreshToken)}; Path=/; SameSite=Lax`;
    localStorage.setItem("cb_access_token", accessToken);
    localStorage.setItem("cb_refresh_token", refreshToken);
  };

  const dial = useMemo(() => {
    return DIAL_COUNTRIES.find((c) => c.iso2 === countryIso)?.dial ?? "+1";
  }, [countryIso]);

  const phone = useMemo(() => nationalDigits(national), [national]);

  const displayNumber = useMemo(() => {
    try {
      return buildE164(dial, national);
    } catch {
      return `${countryIso} ${dial} ${phone || "…"}`;
    }
  }, [countryIso, dial, national, phone]);

  const requestCode = async () => {
    try {
      if (phone.length < 4) {
        toast.error("Enter a valid local phone number");
        return;
      }
      const r = await fetch(`${apiBase}/v1/auth/whatsapp/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, countryCode: dial }),
      });
      const data: unknown = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(formatApiError(data));
        return;
      }
      const msg =
        data && typeof data === "object" && "message" in data
          ? String((data as { message: unknown }).message)
          : "Code sent";
      toast.success(msg);
      setStep("otp");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error");
    }
  };

  const verify = async () => {
    try {
      const r = await fetch(`${apiBase}/v1/auth/whatsapp/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, countryCode: dial, code }),
      });
      const data: unknown = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(formatApiError(data));
        return;
      }
      if (
        data &&
        typeof data === "object" &&
        "registered" in data &&
        (data as { registered: unknown }).registered === true
      ) {
        const session = readSessionFromResponseHeaders(r.headers);
        if (!session) {
          toast.error("Missing session headers from server");
          return;
        }
        setResult(session);
        persistApiTokens(session.accessToken, session.refreshToken);
        setStep("done");
        toast.success("Signed in");
        return;
      }
      if (
        data &&
        typeof data === "object" &&
        "phoneVerificationToken" in data &&
        typeof (data as { phoneVerificationToken: unknown }).phoneVerificationToken ===
          "string"
      ) {
        setPhoneVerifyToken(
          (data as { phoneVerificationToken: string }).phoneVerificationToken,
        );
        setStep("register");
        toast.info(
          (data as { message?: string }).message ?? "Complete registration",
        );
        return;
      }
      toast.error("Unexpected response from server");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error");
    }
  };

  const completeRegister = async () => {
    try {
      const r = await fetch(`${apiBase}/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneVerificationToken: phoneVerifyToken,
          name,
          phone,
          countryCode: dial,
          email,
        }),
      });
      const data: unknown = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(formatApiError(data));
        return;
      }
      const session = readSessionFromResponseHeaders(r.headers);
      if (session) {
        setResult(session);
        persistApiTokens(session.accessToken, session.refreshToken);
        setStep("done");
        toast.success("Account created");
        return;
      }
      toast.error("Missing session headers from server");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error");
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in / Register</h1>
        <Link
          href="/"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Home
        </Link>
      </div>
      <p className="text-[15px] text-muted-foreground">
        WhatsApp is required: codes are delivered only to WhatsApp on this number.
      </p>

      {step === "phone" && (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Country
            <select
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
              value={countryIso}
              onChange={(e) => setCountryIso(e.target.value)}
            >
              {DIAL_COUNTRIES.map((c) => (
                <option key={c.iso2} value={c.iso2}>
                  {c.name} ({c.dial})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Phone number (without country code)
            <input
              className="rounded-md border border-border bg-background px-3 py-2 font-mono text-foreground"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="5551234567"
              value={national}
              onChange={(e) => setNational(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => void requestCode()}
          >
            Send WhatsApp code
          </button>
        </div>
      )}

      {step === "otp" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Code sent to{" "}
            <span className="font-mono text-foreground">{displayNumber}</span>{" "}
            <span className="text-muted-foreground">
              ({dial}, {countryIso})
            </span>
          </p>
          <label className="flex flex-col gap-1 text-sm font-medium">
            6-digit code
            <input
              className="rounded-md border border-border bg-background px-3 py-2 font-mono text-foreground tracking-widest"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm"
              onClick={() => {
                setStep("phone");
                setCode("");
              }}
            >
              Back
            </button>
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              onClick={() => void verify()}
            >
              Verify
            </button>
          </div>
        </div>
      )}

      {step === "register" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            No account for{" "}
            <span className="font-mono text-foreground">{displayNumber}</span>. Add your
            details to finish registration.
          </p>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Full name
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Email (required)
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Calling code: <span className="font-mono">{dial}</span> · National:{" "}
            <span className="font-mono">{phone || "—"}</span> · Region: {countryIso}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm"
              onClick={() => setStep("otp")}
            >
              Back
            </button>
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              onClick={() => void completeRegister()}
            >
              Create account
            </button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
          <p className="text-sm font-medium">You are in</p>
          <p className="text-xs text-muted-foreground">
            userId: <span className="font-mono text-foreground">{result.userId}</span>
          </p>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Access token
            <textarea
              readOnly
              className="min-h-[72px] resize-y rounded border border-border bg-muted/30 p-2 font-mono text-[11px] text-foreground"
              value={result.accessToken}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Refresh token
            <textarea
              readOnly
              className="min-h-[72px] resize-y rounded border border-border bg-muted/30 p-2 font-mono text-[11px] text-foreground"
              value={result.refreshToken}
            />
          </label>
          <Link href="/" className="text-sm underline-offset-4 hover:underline">
            Back to home
          </Link>
        </div>
      )}
    </div>
  );
}
