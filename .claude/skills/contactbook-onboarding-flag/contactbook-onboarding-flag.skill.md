---
name: contactbook-onboarding-flag
description: How to use the isOnboardingCompleted flag now returned by the auth endpoints (POST /auth/otp/verify and POST /auth/me). Load this before writing any FE code that redirects after login or checks session state on app load.
---

# Onboarding completion flag — FE integration guide

## What changed

`isOnboardingCompleted: boolean` is now returned by two auth endpoints:

| Endpoint | When to use |
| --- | --- |
| `POST /auth/otp/verify` | Right after the user enters their OTP — the natural branch point between "new user → onboarding" and "returning user → dashboard" |
| `POST /auth/me` | Session-validity check on app load — same flag, no extra round-trip needed |

The flag is derived from `profileOnboardingCompletedAt` in the DB (set once by `POST /profile/onboarding`). No separate boolean column exists — the derivation is server-side only.

## Before vs. after

**Before** — two calls were needed to find out if the user had completed onboarding:

```ts
// apps/web/src/lib/auth-flow-api.ts  (old pattern — still works, now redundant)
await auth.otpVerify({ phoneE164, code });
const me = await profile.me();            // ← extra round-trip just for this flag
return succeed({ onboardingCompleted: me.onboardingCompleted });
```

**After** — read it directly from the verify response:

```ts
// apps/web/src/lib/auth-flow-api.ts  (new pattern)
const result = await auth.otpVerify({ phoneE164, code });
return succeed({ isOnboardingCompleted: result.isOnboardingCompleted });
```

## Updating auth-flow-api.ts

The `verifyOtp` function in `apps/web/src/lib/auth-flow-api.ts` currently calls
`profile.me()` as a second request after OTP verification. That second call is no longer
needed for the routing decision:

```ts
export interface VerifyOtpOutcome {
  isOnboardingCompleted: boolean;
}

export async function verifyOtp(
  country: string,
  phoneDigits: string,
  code: string,
): Promise<ActionResult<VerifyOtpOutcome>> {
  if (!validatePhone(phoneDigits).valid) {
    return failLocally("We lost your number. Go back and enter it again.");
  }
  const codeCheck = validateOtp(code);
  if (!codeCheck.valid) return failLocally(codeCheck.message ?? "Enter the 6-digit code.");

  try {
    const result = await auth.otpVerify({ phoneE164: toE164(country, phoneDigits), code });
    return succeed({ isOnboardingCompleted: result.isOnboardingCompleted });
  } catch (thrown) {
    return failFrom(thrown);
  }
}
```

Then update the consumer in `apps/web/src/app/(auth)/signin/otp/page.tsx`:

```ts
onSuccess: (outcome) => {
  router.push(
    outcome.isOnboardingCompleted ? (next ?? "/dashboard") : "/signup/first-name",
  );
},
```

## Checking session state on app load

`POST /auth/me` now returns the same flag, so any layout or guard that calls it can branch
without a separate `GET /profile/me`:

```ts
const session = await auth.me();
if (!session.isOnboardingCompleted) {
  redirect("/signup/first-name");
}
```

## What NOT to change

- `GET /profile/me` still returns `onboardingCompleted: boolean` (note: different name,
  no `is` prefix) — that endpoint is the full profile read model and is unchanged. If a screen
  already reads from it, leave it alone; the flag there is accurate too.
- `POST /profile/onboarding` still returns `OnboardingResponseDto` (which extends
  `MeResponseDto`) with `onboardingCompleted: true` — unchanged.
- The DB schema is unchanged — no migration needed.

## Naming note

The auth endpoints use `isOnboardingCompleted` (with `is` prefix) while `GET /profile/me`
uses `onboardingCompleted` (without). This is intentional — they live on different DTOs and
the `is` prefix makes the boolean nature explicit in the auth context where you only have a
handful of scalar fields.
