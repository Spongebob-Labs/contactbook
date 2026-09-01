"use client";

/**
 * The `(auth)` flow's memory — spec §8D.2, §10.1, §11 E-46.
 *
 * ⚠ **In-memory only, and that is the whole design.** Nothing is written to browser
 * storage of any kind — no web-storage API, no cookie, no server round-trip (§10.1, §3.1),
 * and the §3.1 sweeps grep for exactly those names. The provider is mounted
 * once in `(auth)/layout.tsx`; because a route group's layout is *not* remounted when the
 * router moves between its own pages, the five answers survive every step change —
 * forwards, backwards, and through the browser's own Back button. That is E-46, and it
 * costs one `useReducer`.
 *
 * The flip side is stated rather than hidden: a **reload** starts the flow over. §5.7 says
 * exactly that about every in-memory reducer in this run, and inventing persistence to
 * paper over it would be the first crack in the §3.1 wall.
 *
 * ⚠ NOT A SESSION. Nothing here signs anybody in — this is the *questionnaire*, holding five
 * answers between six screens. The session is an httpOnly cookie minted by
 * `verifyOtpAction` and read server-side; `src/lib/session-context.tsx` exposes the resulting
 * user to `(app)`. These two files never talk to each other, and a value in here is not
 * evidence of anything.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";

import type { AuthField } from "@/lib/auth-validation";

/** The six screens, in the order the verified API contract from the old build defines. */
export type AuthStepId = "phone" | "otp" | "first-name" | "last-name" | "email" | "done";

export interface AuthStep {
  /** 1-based, and the number rendered in `STEP n OF 6`. */
  index: number;
  id: AuthStepId;
  href: string;
  /** The answer this screen collects. `null` on the confirmation screen. */
  field: AuthField | null;
  /**
   * Where the Back control goes. **`null` on step 1 only** — §8D.2 puts Back on every
   * screen except the first, and this is the single place that fact is encoded.
   */
  backHref: string | null;
  /** Where a valid answer goes. `null` on the last step, which leaves the group. */
  nextHref: string | null;
}

const STEP_HREFS = [
  "/signin/phone",
  "/signin/otp",
  "/signup/first-name",
  "/signup/last-name",
  "/signup/email",
  "/signup/done",
] as const;

const STEP_IDS: readonly AuthStepId[] = [
  "phone",
  "otp",
  "first-name",
  "last-name",
  "email",
  "done",
];

const STEP_FIELDS: readonly (AuthField | null)[] = [
  "phone",
  "otp",
  "firstName",
  "lastName",
  "email",
  null,
];

/**
 * The step manifest. Derived rather than hand-written so `backHref`/`nextHref` cannot
 * disagree with the order — a mistyped link is exactly how a six-screen flow develops a
 * dead end that only shows up in manual testing.
 */
export const AUTH_STEPS: readonly AuthStep[] = STEP_HREFS.map((href, i) => ({
  index: i + 1,
  id: STEP_IDS[i],
  href,
  field: STEP_FIELDS[i],
  backHref: i === 0 ? null : STEP_HREFS[i - 1],
  nextHref: i === STEP_HREFS.length - 1 ? null : STEP_HREFS[i + 1],
}));

/** Six. Rendered as the denominator of `STEP n OF 6` and as the segment count. */
export const AUTH_STEP_COUNT = AUTH_STEPS.length;

/**
 * Which step a pathname is, or `undefined` for anything outside the flow.
 *
 * A trailing slash is tolerated because it is a URL a person can type; anything else
 * returns `undefined` and the shell simply renders no progress indicator rather than
 * guessing at a step number.
 */
export function authStepFor(pathname: string | null | undefined): AuthStep | undefined {
  if (typeof pathname !== "string") return undefined;
  const normalised = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return AUTH_STEPS.find((step) => step.href === normalised);
}

/** The five answers, plus the country the dialling code came from. */
export interface AuthFlowValues {
  /** ISO 3166-1 alpha-2. The dialling code is derived from it — see `country-select.tsx`. */
  country: string;
  phone: string;
  otp: string;
  firstName: string;
  lastName: string;
  email: string;
}

/** India, because the fixture user's number is `+91` (§10.3). */
export const DEFAULT_COUNTRY = "IN";

const INITIAL_VALUES: AuthFlowValues = {
  country: DEFAULT_COUNTRY,
  phone: "",
  otp: "",
  firstName: "",
  lastName: "",
  email: "",
};

type AuthFlowAction =
  | { type: "set"; field: keyof AuthFlowValues; value: string }
  | { type: "reset" };

function reducer(state: AuthFlowValues, action: AuthFlowAction): AuthFlowValues {
  switch (action.type) {
    case "set":
      // Identity is preserved when nothing changed, so a re-render caused by navigation
      // never invalidates a `useMemo` downstream.
      return state[action.field] === action.value
        ? state
        : { ...state, [action.field]: action.value };
    case "reset":
      return INITIAL_VALUES;
  }
}

export interface AuthFlowApi {
  values: AuthFlowValues;
  setValue: (field: keyof AuthFlowValues, value: string) => void;
  /** Start over. Nothing in the flow calls this yet; the real sign-out will. */
  reset: () => void;
  /**
   * The OTP itself, when the API returned it instead of sending a WhatsApp message.
   *
   * `RequestOtpResponseDto.devCode` is present only outside production and only when Twilio is
   * unconfigured — the API decides, never the client. It is held here rather than in `values`
   * because it is not one of the six answers: nobody types it, no validator runs on it, and it
   * must not appear in the URL, which is where it would end up if it were passed between the
   * two screens any other way.
   *
   * `null` whenever a real message was sent, which is the production path.
   */
  devCode: string | null;
  setDevCode: (code: string | null) => void;
}

const AuthFlowContext = createContext<AuthFlowApi | null>(null);

export function AuthFlowProvider({ children }: { children: ReactNode }) {
  const [values, dispatch] = useReducer(reducer, INITIAL_VALUES);
  const [devCode, setDevCode] = useState<string | null>(null);

  const setValue = useCallback((field: keyof AuthFlowValues, value: string) => {
    dispatch({ type: "set", field, value });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "reset" });
    setDevCode(null);
  }, []);

  const api = useMemo<AuthFlowApi>(
    () => ({ values, setValue, reset, devCode, setDevCode }),
    [values, setValue, reset, devCode],
  );

  return <AuthFlowContext.Provider value={api}>{children}</AuthFlowContext.Provider>;
}

/**
 * The flow's answers. Throws when no provider is mounted, because the alternative — a
 * silent empty string — presents as "Back wiped my number", three screens from the cause.
 */
export function useAuthFlow(): AuthFlowApi {
  const api = useContext(AuthFlowContext);
  if (api === null) {
    throw new Error(
      "useAuthFlow must be used inside an <AuthFlowProvider>. The (auth) group mounts one in its layout.",
    );
  }
  return api;
}
