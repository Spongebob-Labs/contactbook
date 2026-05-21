import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, ChevronsUpDown, MessageCircle } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { DIAL_COUNTRIES } from "@/lib/dial-countries";
import { buildE164, nationalDigits } from "@/lib/phone";
import type { VerifyCodeResponse } from "@/lib/types";

const COUNTRY_CODE_PATTERN = /^\+\d{1,4}$/;
const NATIONAL_PHONE_PATTERN = /^\d{4,15}$/;

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

export default function AuthPage() {
  const [step, setStep] = useState<Step>("phone");
  const [isBusy, setIsBusy] = useState(false);
  const [phoneVerificationToken, setPhoneVerificationToken] = useState("");
  const [phoneContext, setPhoneContext] = useState({
    countryCode: "+1",
    phone: "",
  });
  const [postAuthRedirect, setPostAuthRedirect] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, markAuthenticated } = useAuth();
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
      toast.error(error instanceof Error ? error.message : "Enter a valid phone number.");
      return;
    }
    setIsBusy(true);
    try {
      await apiFetch<{ message: string }>("/v1/auth/whatsapp/request-code", {
        method: "POST",
        body: { phone, countryCode },
      });
      setPhoneContext({ countryCode, phone });
      setStep("otp");
      toast.success("Verification code sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send code.");
    } finally {
      setIsBusy(false);
    }
  };

  const onVerifyCode = async (values: OtpForm) => {
    setIsBusy(true);
    try {
      const result = await apiFetch<VerifyCodeResponse>("/v1/auth/whatsapp/verify-code", {
        method: "POST",
        body: {
          phone: phoneContext.phone,
          countryCode: phoneContext.countryCode,
          code: values.code,
        },
      });
      if (result.registered) {
        markAuthenticated();
        toast.success("Signed in.");
        navigate(locationRedirectTo, { replace: true });
        return;
      }
      setPhoneVerificationToken(result.phoneVerificationToken);
      setStep("register");
      toast.info("Complete your profile to continue.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not verify code.");
    } finally {
      setIsBusy(false);
    }
  };

  const onRegister = async (values: RegisterForm) => {
    setIsBusy(true);
    try {
      await apiFetch<Record<string, never>>("/v1/auth/register", {
        method: "POST",
        body: {
          phoneVerificationToken,
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phone: phoneContext.phone,
          countryCode: phoneContext.countryCode,
        },
      });
      const onboardingPath = "/dashboard?onboarding=profile&flow=setup";
      setPostAuthRedirect(onboardingPath);
      markAuthenticated();
      toast.success("Account created.");
      navigate(onboardingPath, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create account.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_480px]">
      <section className="hidden min-h-screen border-r border-border bg-secondary/35 p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="font-semibold">ContactBook</span>
        </div>
        <div className="max-w-xl space-y-5">
          <p className="text-sm font-medium text-primary">Private by design</p>
          <h1 className="text-5xl font-semibold tracking-normal text-foreground">
            Build a contact profile people can actually keep up to date.
          </h1>
          <p className="max-w-lg text-base text-muted-foreground">
            Sign in with WhatsApp, create your profile, and bring your Google
            contacts into one focused workspace.
          </p>
        </div>
        <div className="grid max-w-lg grid-cols-3 gap-3">
          {["OTP login", "Google import", "Dark mode"].map((item) => (
            <div key={item} className="rounded-lg border border-border bg-card p-3 text-sm">
              <Check className="mb-3 h-4 w-4 text-primary" aria-hidden="true" />
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-4 pb-16 pt-24 md:px-8 md:pb-20 md:pt-28 lg:pb-24 lg:pt-24">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-md">
          <CardHeader className="gap-2 p-6 pb-4">
            <CardTitle>
              {step === "phone" && "Sign in or create account"}
              {step === "otp" && "Enter WhatsApp code"}
              {step === "register" && "Finish your profile"}
            </CardTitle>
            <CardDescription>
              {step === "phone" && "We use WhatsApp OTP for secure account access."}
              {step === "otp" && `Code sent to ${phoneContext.countryCode} ${phoneContext.phone}.`}
              {step === "register" && "Add the details that identify your contact profile."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-2">
            {step === "phone" && (
              <form className="space-y-5" onSubmit={phoneForm.handleSubmit(onRequestCode)}>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  <span>Country code</span>
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
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  <span>Phone number</span>
                  <Input
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="5551234567"
                    {...phoneForm.register("national")}
                  />
                </label>
                {phoneForm.formState.errors.countryCode && (
                  <p className="text-sm text-destructive">
                    {phoneForm.formState.errors.countryCode.message}
                  </p>
                )}
                {phoneForm.formState.errors.national && (
                  <p className="text-sm text-destructive">
                    {phoneForm.formState.errors.national.message}
                  </p>
                )}
                <Button type="submit" className="mt-1 w-full" disabled={isBusy}>
                  Send WhatsApp code
                </Button>
              </form>
            )}

            {step === "otp" && (
              <form className="space-y-5" onSubmit={otpForm.handleSubmit(onVerifyCode)}>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  <span>6-digit code</span>
                  <Input
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    className="font-mono tracking-[0.3em]"
                    {...otpForm.register("code")}
                    onChange={(event) =>
                      otpForm.setValue(
                        "code",
                        event.target.value.replace(/\D/g, "").slice(0, 6),
                      )
                    }
                  />
                </label>
                {otpForm.formState.errors.code && (
                  <p className="text-sm text-destructive">
                    {otpForm.formState.errors.code.message}
                  </p>
                )}
                <div className="flex gap-3 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep("phone")}
                    disabled={isBusy}
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isBusy}>
                    Verify
                  </Button>
                </div>
              </form>
            )}

            {step === "register" && (
              <form className="space-y-5" onSubmit={registerForm.handleSubmit(onRegister)}>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  <span>First name</span>
                  <Input autoComplete="given-name" {...registerForm.register("firstName")} />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  <span>Last name</span>
                  <Input autoComplete="family-name" {...registerForm.register("lastName")} />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  <span>Email</span>
                  <Input
                    type="email"
                    autoComplete="email"
                    {...registerForm.register("email")}
                  />
                </label>
                {(registerForm.formState.errors.firstName ||
                  registerForm.formState.errors.lastName ||
                  registerForm.formState.errors.email) && (
                  <p className="text-sm text-destructive">
                    {registerForm.formState.errors.firstName?.message ??
                      registerForm.formState.errors.lastName?.message ??
                      registerForm.formState.errors.email?.message}
                  </p>
                )}
                <div className="flex gap-3 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep("otp")}
                    disabled={isBusy}
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isBusy}>
                    Create account
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
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
  const selectedOption = options.find((option) => option.dial === value);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter(
      (option) => {
        const label = `${option.name} ${option.dial}`.toLowerCase();

        return label.includes(normalizedQuery) || option.dial.includes(normalizedQuery);
      },
    );
  }, [options, query]);

  const selectOption = (option: CountryCodeOption) => {
    onChange(option.dial);
    setQuery(option.dial);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <div className="flex rounded-md border border-input bg-background shadow-xs transition-colors focus-within:ring-2 focus-within:ring-ring">
        <Input
          inputMode="tel"
          autoComplete="tel-country-code"
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

            setQuery(value);
            setIsOpen(false);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setQuery(selectedOption ? `${selectedOption.name} ${selectedOption.dial}` : value);
            setIsOpen(true);
          }}
          placeholder="+1"
          className="border-0 shadow-none focus-visible:ring-0"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="country-code-options"
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="rounded-l-none border-y-0 border-r-0 px-3 shadow-none focus-visible:ring-0"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setQuery(selectedOption ? `${selectedOption.name} ${selectedOption.dial}` : value);
            setIsOpen((current) => !current);
          }}
          aria-label="Show country codes"
        >
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </Button>
      </div>

      {isOpen && (
        <div
          id="country-code-options"
          role="listbox"
          className="absolute z-20 mt-2 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={`${option.iso2}-${option.dial}`}
                type="button"
                role="option"
                aria-selected={option.dial === value}
                className="flex h-10 w-full items-center justify-between rounded-sm px-3 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option)}
              >
                <span className="truncate">
                  {option.name} <span className="text-muted-foreground">{option.dial}</span>
                </span>
                {option.dial === value && (
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                )}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">No country code found.</div>
          )}
        </div>
      )}
    </div>
  );
}
