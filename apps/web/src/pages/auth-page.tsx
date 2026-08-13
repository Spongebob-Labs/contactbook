import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ContactRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";
import {
  completeRegistration,
  isPhoneVerificationToken,
  isRegisteredAuthResult,
  sendWhatsappOtp,
  verifyWhatsappOtp,
} from "@/lib/auth-api";
import { setSessionTokens } from "@/lib/session-tokens";
import { DIAL_COUNTRIES } from "@/lib/dial-countries";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import { buildE164, nationalDigits } from "@/lib/phone";
import { cn } from "@/lib/utils";

const COUNTRY_CODE_PATTERN = /^\+\d{1,4}$/;
const NATIONAL_PHONE_PATTERN = /^\d{4,15}$/;
const RESEND_COOLDOWN_SECONDS = 30;

/** Matches the app design system: same field metrics and focus treatment the
 *  dashboard `Input` uses, applied once to the country + number group so the
 *  composite reads as a single control instead of nested boxes. */
const FIELD_GROUP =
  "flex h-9 rounded-md border border-border bg-surface transition-colors duration-150 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-foreground";
const FIELD_GROUP_INPUT =
  "h-full min-w-0 flex-1 rounded-none border-0 bg-transparent focus-visible:outline-none";
const FIELD_LABEL = "text-sm font-medium text-foreground";
const QUIET_ACTION =
  "inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors duration-150 hover:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40";

const phoneSchema = z.object({
  countryCode: z
    .string()
    .trim()
    .regex(COUNTRY_CODE_PATTERN, "Enter a valid country code."),
  national: z
    .string()
    .transform((value) => nationalDigits(value))
    .refine(
      (value) => NATIONAL_PHONE_PATTERN.test(value),
      "Enter a 4 to 15 digit phone number.",
    ),
});

const otpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

const registerSchema = z.object({
  firstName: z.string().min(1, "Enter your first name.").max(120),
  lastName: z.string().min(1, "Enter your last name.").max(120),
  email: z.string().email("Enter a valid email."),
});

type PhoneForm = z.infer<typeof phoneSchema>;
type OtpForm = z.infer<typeof otpSchema>;
type RegisterForm = z.infer<typeof registerSchema>;
type Step = "phone" | "otp" | "register";
type CountryCodeOption = (typeof DIAL_COUNTRIES)[number];

const COUNTRY_CODE_OPTIONS = [...DIAL_COUNTRIES].sort((current, next) => {
  const codeOrder = Number(current.dial.slice(1)) - Number(next.dial.slice(1));

  if (codeOrder !== 0) {
    return codeOrder;
  }

  return current.name.localeCompare(next.name);
});

const STEP_ORDER: Step[] = ["phone", "otp", "register"];

const STEP_LABELS: Record<Step, string> = {
  phone: "Your number",
  otp: "Verification",
  register: "Your profile",
};

const BRAND_HIGHLIGHTS = [
  {
    icon: ContactRound,
    title: "Connect",
    description: "Share one profile instead of retyping your details.",
  },
  {
    icon: ShieldCheck,
    title: "Control",
    description: "Decide which details each connection can see.",
  },
  {
    icon: RefreshCw,
    title: "Current",
    description: "Update once and everyone you trust stays up to date.",
  },
];

function countryCodeInput(value: string) {
  return `+${value.replace(/\D/g, "").slice(0, 4)}`;
}

function phoneNumberInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 15);
}

/** ISO2 → regional indicator flag, used to make the country list scannable. */
function countryFlag(iso2: string) {
  if (!/^[A-Za-z]{2}$/.test(iso2)) {
    return "";
  }

  return iso2
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127_397 + char.charCodeAt(0)));
}

/** Groups national digits so a long number stays readable when echoed back. */
function formatPhoneDisplay(countryCode: string, national: string) {
  const groups = national.match(/\d{1,5}/g) ?? [];

  return `${countryCode} ${groups.join(" ")}`.trim();
}

export default function AuthPage() {
  const [step, setStep] = useState<Step>("phone");
  const [isBusy, setIsBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const verifyInFlight = useRef(false);
  const [phoneVerificationToken, setPhoneVerificationToken] = useState("");
  const [phoneContext, setPhoneContext] = useState({
    countryCode: "+1",
    phone: "",
  });
  const [postAuthRedirect, setPostAuthRedirect] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, markAuthenticated, refreshUser } =
    useAuth();
  const locationRedirectTo =
    typeof location.state === "object" &&
    location.state !== null &&
    "from" in location.state &&
    typeof location.state.from === "string"
      ? location.state.from
      : "/dashboard";
  const redirectTo = postAuthRedirect ?? locationRedirectTo;

  const phoneForm = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { countryCode: "+1", national: "" },
  });
  const otpForm = useForm<OtpForm>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  });
  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: "", lastName: "", email: "" },
  });
  const selectedCountryCode = phoneForm.watch("countryCode");

  useEffect(() => {
    if (resendSeconds <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  // The phone field takes focus on arrival, but plain `autoFocus` lets the
  // browser scroll the card into view and clips the top of the split layout.
  useEffect(() => {
    if (isLoading || step !== "phone") {
      return;
    }

    document
      .getElementById("auth-phone-national")
      ?.focus({ preventScroll: true });
  }, [isLoading, step]);

  if (isLoading) {
    return <PageLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const onRequestCode = async (values: PhoneForm) => {
    const phone = nationalDigits(values.national);
    const countryCode = values.countryCode.trim();
    try {
      buildE164(countryCode, values.national);
    } catch (error) {
      logUiError("Invalid phone number", error);
      toast.error("Enter a valid phone number.");
      return;
    }
    setIsBusy(true);
    try {
      const result = await sendWhatsappOtp({ phone, countryCode });
      setPhoneContext({ countryCode, phone });
      setPhoneVerificationToken("");
      setStep("otp");
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
      toast.success(
        result.message ||
          "Verification code sent to your WhatsApp number.",
      );
    } catch (error) {
      logUiError("Could not send code", error);
      if (error instanceof ApiError && error.status === 429) {
        toast.error(
          error.message ||
            "Please wait before requesting another code.",
        );
      } else {
        toast.error(
          error instanceof ApiError && error.message
            ? error.message
            : "We couldn't send the code. Please try again.",
        );
      }
    } finally {
      setIsBusy(false);
    }
  };

  const onResendCode = async () => {
    if (isBusy || resendSeconds > 0) {
      return;
    }

    setIsBusy(true);
    try {
      const result = await sendWhatsappOtp(phoneContext);
      otpForm.reset({ code: "" });
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
      toast.success(
        result.message || "New verification code sent to your WhatsApp number.",
      );
    } catch (error) {
      logUiError("Could not resend code", error);
      toast.error(
        error instanceof ApiError && error.message
          ? error.message
          : "We couldn't send the code. Please try again.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const onVerifyCode = async (values: OtpForm) => {
    // OTP is single-use: ignore double-clicks after the first verify succeeds.
    if (verifyInFlight.current || isBusy) {
      return;
    }
    verifyInFlight.current = true;
    setIsBusy(true);
    try {
      // Twilio OTP verify: session when registered; else registration token.
      const result = await verifyWhatsappOtp(phoneContext, values.code);

      // Existing account → dashboard (never Create account again).
      if (isRegisteredAuthResult(result)) {
        const payload = result as {
          accessToken?: string;
          refreshToken?: string;
        };
        setSessionTokens({
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
        });
        markAuthenticated();
        await refreshUser().catch(() => undefined);
        toast.success("Signed in.");
        const nextPath = locationRedirectTo;
        setPostAuthRedirect(nextPath);
        otpForm.reset({ code: "" });
        setPhoneVerificationToken("");
        setStep("phone");
        navigate(nextPath, { replace: true });
        return;
      }

      // New user only: Finish profile → POST /auth/register (OTP is single-use).
      otpForm.reset({ code: "" });
      const token =
        "phoneVerificationToken" in result
          ? (result.phoneVerificationToken?.trim() ?? "")
          : "";
      setPhoneVerificationToken(token);
      setStep("register");
      if (isPhoneVerificationToken(token)) {
        toast.success(
          ("message" in result && result.message) ||
            "Phone verified. Complete your details to create your account.",
        );
      } else {
        toast.error(
          "We couldn't finish verifying your number. Request a new code and try again.",
        );
      }
    } catch (error) {
      logUiError("Could not verify code", error);
      if (error instanceof ApiError && error.status === 401) {
        toast.error(
          error.message ||
            "Invalid or expired code. Request a new WhatsApp code and try again.",
        );
        return;
      }
      toast.error(
        error instanceof ApiError && error.message
          ? error.message
          : friendlyErrorMessages.auth,
      );
    } finally {
      verifyInFlight.current = false;
      setIsBusy(false);
    }
  };

  const onRegister = async (values: RegisterForm) => {
    if (!isPhoneVerificationToken(phoneVerificationToken)) {
      toast.error(
        "Your verification has expired. Request a new WhatsApp code and try again.",
      );
      return;
    }

    // The API re-checks this pair against the token claims, so it must be the
    // same number OTP send/verify used — not whatever is in the phone form now.
    if (
      !NATIONAL_PHONE_PATTERN.test(phoneContext.phone) ||
      !COUNTRY_CODE_PATTERN.test(phoneContext.countryCode)
    ) {
      toast.error(
        "Verified phone number missing. Request a new WhatsApp code and try again.",
      );
      setStep("phone");
      return;
    }

    setIsBusy(true);
    try {
      await completeRegistration({
        phoneVerificationToken,
        firstName: values.firstName,
        lastName: values.lastName,
        phone: phoneContext.phone,
        countryCode: phoneContext.countryCode,
        email: values.email,
      });
      const onboardingPath = "/dashboard?onboarding=profile&flow=setup";
      setPostAuthRedirect(onboardingPath);
      markAuthenticated();
      await refreshUser().catch(() => undefined);
      toast.success("Account created.");
      navigate(onboardingPath, { replace: true });
    } catch (error) {
      logUiError("Could not create account", error);
      if (error instanceof ApiError && error.status === 409) {
        toast.error(
          error.message ||
            "This phone number is already registered. Request a new code to sign in.",
        );
        setPhoneVerificationToken("");
        setStep("phone");
        otpForm.reset({ code: "" });
        return;
      }
      toast.error(
        error instanceof ApiError && error.message
          ? error.message
          : "We couldn't create your account. Please try again.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const restartFromPhone = () => {
    setPhoneVerificationToken("");
    setStep("phone");
    setResendSeconds(0);
    otpForm.reset({ code: "" });
  };

  const canSubmitRegister = isPhoneVerificationToken(phoneVerificationToken);
  const verifiedPhoneLabel = formatPhoneDisplay(
    phoneContext.countryCode,
    phoneContext.phone,
  );
  const phoneErrors = phoneForm.formState.errors;
  const registerErrors = registerForm.formState.errors;
  const hasPhoneError = Boolean(phoneErrors.countryCode || phoneErrors.national);
  const registerDisabled = isBusy || !canSubmitRegister;

  return (
    <main className="min-h-screen bg-background">
      {/* Two panels split by a single hairline: brand narrative on the left,
       *  the auth box on the right. The grid is min-h-screen so the partition
       *  runs the full viewport height instead of only beside the card. */}
      <div className="mx-auto grid min-h-screen w-full max-w-[80rem] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_29rem] xl:grid-cols-[minmax(0,1fr)_31rem]">
        <section className="order-2 flex flex-col justify-center border-t border-border px-6 pb-14 pt-12 sm:px-8 lg:order-1 lg:border-t-0 lg:px-10 lg:py-12 lg:pr-16">
          <div className="w-full max-w-[34rem]">
            <BrandLockup className="hidden lg:inline-flex" />

            <p className="text-sm font-medium text-muted-foreground lg:mt-10">
              Never lose contact
            </p>
            <h1 className="mt-3 text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.02em] text-foreground sm:text-[2rem] lg:text-[2.25rem]">
              Create the address book profile that updates itself.
            </h1>
            <p className="mt-4 max-w-[30rem] text-[0.9375rem] leading-7 text-muted-foreground">
              Sign in with WhatsApp, create your personal ContactBook, and choose
              the details family, friends, and new connections can keep current.
            </p>

            <dl className="mt-8 space-y-5 border-t border-border pt-8">
              {BRAND_HIGHLIGHTS.map((highlight) => (
                <div key={highlight.title} className="flex items-start gap-4">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface"
                    aria-hidden="true"
                  >
                    <highlight.icon className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <dt className="text-sm font-medium text-foreground">
                      {highlight.title}
                    </dt>
                    <dd className="mt-1 text-sm leading-6 text-muted-foreground">
                      {highlight.description}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>

            <p className="mt-8 max-w-[26rem] text-xs leading-5 text-muted-foreground">
              Private by design. Your details stay yours, and sharing is always
              your choice.
            </p>
          </div>
        </section>

        <section className="order-1 flex flex-col justify-center px-6 py-12 sm:px-8 lg:order-2 lg:border-l lg:border-border lg:px-10">
          <div className="mx-auto flex w-full max-w-md flex-col gap-6">
            <BrandLockup className="inline-flex lg:hidden" />

            <Card className="w-full">
              <CardHeader className="gap-5 p-6 pb-5 sm:p-7 sm:pb-6">
                <div className="flex items-center gap-3">
                  <div className="flex flex-1 gap-1.5" aria-hidden="true">
                    {STEP_ORDER.map((stepKey, index) => (
                      <span
                        key={stepKey}
                        className={cn(
                          "h-1 flex-1 rounded-full transition-colors duration-300",
                          index <= STEP_ORDER.indexOf(step)
                            ? "bg-foreground"
                            : "bg-border",
                        )}
                      />
                    ))}
                  </div>
                  <p className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                    Step {STEP_ORDER.indexOf(step) + 1} of {STEP_ORDER.length}
                    <span className="sr-only">: {STEP_LABELS[step]}</span>
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
                    {step === "phone" && "Sign in or create account"}
                    {step === "otp" && "Enter your WhatsApp code"}
                    {step === "register" && "Finish your profile"}
                  </h2>
                  <p className="body">
                    {step === "phone" &&
                      "Enter your WhatsApp number and we'll send a 6-digit code. No password to remember."}
                    {step === "otp" && (
                      <>
                        We sent a code to{" "}
                        <span className="font-medium text-foreground">
                          {verifiedPhoneLabel}
                        </span>{" "}
                        on WhatsApp.
                      </>
                    )}
                    {step === "register" &&
                      "Add the details that identify your contact profile."}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0 sm:p-7 sm:pt-0">
                {step === "phone" && (
                  <form
                    className="space-y-5"
                    onSubmit={phoneForm.handleSubmit(onRequestCode)}
                  >
                    <div className="flex flex-col gap-2">
                      <label className={FIELD_LABEL} htmlFor="auth-phone-national">
                        Phone number
                      </label>
                      <div
                        className={cn(FIELD_GROUP, hasPhoneError && "border-destructive")}
                      >
                        <CountryCodeCombobox
                          value={selectedCountryCode}
                          options={COUNTRY_CODE_OPTIONS}
                          disabled={isBusy}
                          onChange={(countryCode) =>
                            phoneForm.setValue("countryCode", countryCode, {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true,
                            })
                          }
                        />
                        <Input
                          id="auth-phone-national"
                          inputMode="tel"
                          autoComplete="tel-national"
                          disabled={isBusy}
                          placeholder="98765 43210"
                          aria-invalid={Boolean(phoneErrors.national)}
                          aria-describedby={
                            hasPhoneError ? "auth-phone-error" : "auth-phone-hint"
                          }
                          className={cn(FIELD_GROUP_INPUT, "text-base sm:text-sm")}
                          {...phoneForm.register("national")}
                          onChange={(event) =>
                            phoneForm.setValue(
                              "national",
                              phoneNumberInput(event.target.value),
                              {
                                shouldDirty: true,
                                shouldTouch: true,
                                shouldValidate: true,
                              },
                            )
                          }
                        />
                      </div>
                      {hasPhoneError ? (
                        <p
                          id="auth-phone-error"
                          role="alert"
                          className="text-sm text-destructive"
                        >
                          {phoneErrors.countryCode?.message ??
                            phoneErrors.national?.message}
                        </p>
                      ) : (
                        <p id="auth-phone-hint" className="body">
                          Use the number linked to your WhatsApp account.
                        </p>
                      )}
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isBusy}
                      aria-busy={isBusy}
                    >
                      {isBusy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Sending code
                        </>
                      ) : (
                        "Send WhatsApp code"
                      )}
                    </Button>
                  </form>
                )}

                {step === "otp" && (
                  <form
                    className="space-y-5"
                    onSubmit={otpForm.handleSubmit(onVerifyCode)}
                  >
                    <div className="flex flex-col gap-2">
                      <label className={FIELD_LABEL} htmlFor="auth-otp-code">
                        6-digit code
                      </label>
                      <Input
                        id="auth-otp-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoFocus
                        maxLength={6}
                        disabled={isBusy}
                        placeholder="000000"
                        aria-invalid={Boolean(otpForm.formState.errors.code)}
                        aria-describedby={
                          otpForm.formState.errors.code ? "auth-otp-error" : undefined
                        }
                        className={cn(
                          "text-center font-mono text-base tracking-[0.35em] sm:text-sm",
                          otpForm.formState.errors.code && "border-destructive",
                        )}
                        {...otpForm.register("code")}
                        onChange={(event) =>
                          otpForm.setValue(
                            "code",
                            event.target.value.replace(/\D/g, "").slice(0, 6),
                          )
                        }
                      />
                      {otpForm.formState.errors.code && (
                        <p
                          id="auth-otp-error"
                          role="alert"
                          className="text-sm text-destructive"
                        >
                          {otpForm.formState.errors.code.message}
                        </p>
                      )}
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isBusy}
                      aria-busy={isBusy}
                    >
                      {isBusy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Verifying
                        </>
                      ) : (
                        "Verify and continue"
                      )}
                    </Button>
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                      <p className="body">
                        Didn&apos;t get it?{" "}
                        <button
                          type="button"
                          onClick={onResendCode}
                          disabled={isBusy || resendSeconds > 0}
                          className="font-medium text-foreground underline underline-offset-4 transition-colors duration-150 hover:text-muted-foreground disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                        >
                          {resendSeconds > 0
                            ? `Resend in ${resendSeconds}s`
                            : "Resend code"}
                        </button>
                      </p>
                      <button
                        type="button"
                        onClick={restartFromPhone}
                        disabled={isBusy}
                        className={QUIET_ACTION}
                      >
                        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        Change number
                      </button>
                    </div>
                  </form>
                )}

                {step === "register" && (
                  <form
                    className="space-y-5"
                    onSubmit={registerForm.handleSubmit(onRegister)}
                  >
                    {canSubmitRegister ? (
                      <p className="flex items-center gap-2.5 rounded-md border border-border bg-secondary px-3 py-2.5 text-sm text-foreground">
                        <Check
                          className="h-4 w-4 shrink-0 text-success"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 truncate">
                          <span className="font-medium">{verifiedPhoneLabel}</span>{" "}
                          verified
                        </span>
                      </p>
                    ) : (
                      <p
                        role="alert"
                        className="rounded-md border border-destructive/30 bg-[var(--color-danger-bg)] px-3 py-2.5 text-sm text-destructive"
                      >
                        Your verification has expired. Request a new WhatsApp code to
                        continue.
                      </p>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <label className={FIELD_LABEL} htmlFor="auth-first-name">
                          First name
                        </label>
                        <Input
                          id="auth-first-name"
                          autoComplete="given-name"
                          disabled={registerDisabled}
                          placeholder="Aayush"
                          aria-invalid={Boolean(registerErrors.firstName)}
                          className={cn(
                            "text-base sm:text-sm",
                            registerErrors.firstName && "border-destructive",
                          )}
                          {...registerForm.register("firstName")}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className={FIELD_LABEL} htmlFor="auth-last-name">
                          Last name
                        </label>
                        <Input
                          id="auth-last-name"
                          autoComplete="family-name"
                          disabled={registerDisabled}
                          placeholder="Sharma"
                          aria-invalid={Boolean(registerErrors.lastName)}
                          className={cn(
                            "text-base sm:text-sm",
                            registerErrors.lastName && "border-destructive",
                          )}
                          {...registerForm.register("lastName")}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className={FIELD_LABEL} htmlFor="auth-email">
                        Email
                      </label>
                      <Input
                        id="auth-email"
                        type="email"
                        autoComplete="email"
                        disabled={registerDisabled}
                        placeholder="you@example.com"
                        aria-invalid={Boolean(registerErrors.email)}
                        className={cn(
                          "text-base sm:text-sm",
                          registerErrors.email && "border-destructive",
                        )}
                        {...registerForm.register("email")}
                      />
                    </div>
                    {(registerErrors.firstName ||
                      registerErrors.lastName ||
                      registerErrors.email) && (
                      <p role="alert" className="text-sm text-destructive">
                        {registerErrors.firstName?.message ??
                          registerErrors.lastName?.message ??
                          registerErrors.email?.message}
                      </p>
                    )}
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={registerDisabled}
                      aria-busy={isBusy}
                    >
                      {isBusy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Creating account
                        </>
                      ) : (
                        "Create account"
                      )}
                    </Button>
                    <button
                      type="button"
                      onClick={restartFromPhone}
                      disabled={isBusy}
                      className={QUIET_ACTION}
                    >
                      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      Start with a different number
                    </button>
                  </form>
                )}

                <p className="mt-6 flex items-center justify-center gap-2 border-t border-border pt-5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Secured with WhatsApp one-time passcodes
                </p>
              </CardContent>
            </Card>

            <p className="text-center text-xs text-muted-foreground">
              <Link
                to="/privacy"
                className="transition-colors duration-150 hover:text-foreground"
              >
                Privacy
              </Link>
              <span aria-hidden="true" className="px-2">
                ·
              </span>
              <Link
                to="/terms"
                className="transition-colors duration-150 hover:text-foreground"
              >
                Terms
              </Link>
              <span aria-hidden="true" className="px-2">
                ·
              </span>
              <Link
                to="/"
                className="transition-colors duration-150 hover:text-foreground"
              >
                Back to home
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function BrandLockup({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        "-ml-2 w-fit items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-semibold text-foreground transition-colors duration-150 hover:bg-bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
        className,
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md">
        <img
          src="/app-logo.svg"
          alt=""
          className="h-full w-full"
          aria-hidden="true"
        />
      </span>
      ContactBook
    </Link>
  );
}

function CountryCodeCombobox({
  disabled,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  onChange: (value: string) => void;
  options: CountryCodeOption[];
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value);
  // Opening the list shows every country; only typing narrows it. Without this
  // the trigger would seed the filter with the current dial code and hide the
  // rest of the world behind a manual clear.
  const [isFiltering, setIsFiltering] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = isFiltering ? query.trim().toLowerCase() : "";

    if (!normalizedQuery) {
      return options;
    }

    return options.filter(
      (option) => {
        const label = `${option.name} ${option.dial}`.toLowerCase();

        return label.includes(normalizedQuery) || option.dial.includes(normalizedQuery);
      },
    );
  }, [isFiltering, options, query]);
  // `value` is only a dial code, so +1 matches both Canada and the US. Mark the
  // first match so the list reads as one selection instead of two.
  const selectedIndex = filteredOptions.findIndex(
    (option) => option.dial === value,
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setQuery(value);
        setIsFiltering(false);
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [isOpen, value]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query, isOpen]);

  const openList = () => {
    setQuery(value);
    setIsFiltering(false);
    setIsOpen(true);
  };

  const closeList = () => {
    setQuery(value);
    setIsFiltering(false);
    setIsOpen(false);
  };

  const selectOption = (option: CountryCodeOption) => {
    onChange(option.dial);
    setQuery(option.dial);
    setIsFiltering(false);
    setIsOpen(false);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      closeList();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setHighlightIndex((current) => {
        if (filteredOptions.length === 0) {
          return 0;
        }
        const next = event.key === "ArrowDown" ? current + 1 : current - 1;
        return (next + filteredOptions.length) % filteredOptions.length;
      });
      return;
    }

    if (event.key === "Enter" && isOpen) {
      const option = filteredOptions[highlightIndex];
      if (option) {
        event.preventDefault();
        selectOption(option);
      }
    }
  };

  return (
    <div
      ref={rootRef}
      className="relative h-full w-[5.5rem] shrink-0 border-r border-border"
      onKeyDown={handleKeyDown}
    >
      <div className="flex h-full items-center">
        <Input
          inputMode="tel"
          autoComplete="tel-country-code"
          aria-label="Country calling code"
          disabled={disabled}
          value={isOpen ? query : value}
          onBlur={() => {
            const normalizedQuery = query.trim().toLowerCase();
            const exactMatch = options.find(
              (option) =>
                option.dial === query.trim() ||
                option.name.toLowerCase() === normalizedQuery,
            );

            if (exactMatch) {
              selectOption(exactMatch);
              return;
            }

            closeList();
          }}
          onChange={(event) => {
            setQuery(countryCodeInput(event.target.value));
            setIsFiltering(true);
            setIsOpen(true);
          }}
          onFocus={openList}
          placeholder="+1"
          className={cn(
            FIELD_GROUP_INPUT,
            "pr-0 tabular-nums text-base sm:text-sm",
          )}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="country-code-options"
          aria-autocomplete="list"
          aria-activedescendant={
            isOpen && filteredOptions[highlightIndex]
              ? `country-code-option-${highlightIndex}`
              : undefined
          }
        />
        <button
          type="button"
          disabled={disabled}
          tabIndex={-1}
          className="flex h-full shrink-0 items-center justify-center pl-1 pr-2.5 text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none disabled:opacity-40"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (isOpen) {
              closeList();
              return;
            }
            openList();
          }}
          aria-label="Show country codes"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isOpen && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
      </div>

      {isOpen && (
        <div
          id="country-code-options"
          role="listbox"
          aria-label="Country calling codes"
          className="absolute left-0 top-[calc(100%+0.5rem)] z-30 max-h-60 w-72 overflow-y-auto rounded-md border border-border bg-popover p-2 text-popover-foreground"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => {
              const isSelected = index === selectedIndex;
              const isHighlighted = index === highlightIndex;

              return (
                <button
                  key={`${option.iso2}-${option.dial}`}
                  id={`country-code-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  ref={(element) => {
                    if (isHighlighted) {
                      element?.scrollIntoView({ block: "nearest" });
                    }
                  }}
                  className={cn(
                    "flex h-10 w-full items-center gap-3 rounded-sm px-3 text-left text-sm transition-colors duration-150",
                    isHighlighted ? "bg-bg-hover" : "hover:bg-bg-hover",
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlightIndex(index)}
                  onClick={() => selectOption(option)}
                >
                  <span className="text-base leading-none" aria-hidden="true">
                    {countryFlag(option.iso2)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-foreground">
                    {option.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {option.dial}
                  </span>
                  {isSelected && (
                    <Check className="h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
                  )}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No country code found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
