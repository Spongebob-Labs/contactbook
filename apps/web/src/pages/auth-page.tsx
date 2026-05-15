import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, MessageCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { DIAL_COUNTRIES } from "@/lib/dial-countries";
import { buildE164, nationalDigits } from "@/lib/phone";
import type { VerifyCodeResponse } from "@/lib/types";

const phoneSchema = z.object({
  countryIso: z.string().min(2),
  national: z.string().min(4, "Enter a valid phone number."),
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

export default function AuthPage() {
  const [step, setStep] = useState<Step>("phone");
  const [isBusy, setIsBusy] = useState(false);
  const [phoneVerificationToken, setPhoneVerificationToken] = useState("");
  const [phoneContext, setPhoneContext] = useState({
    countryIso: "US",
    countryCode: "+1",
    phone: "",
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { markAuthenticated } = useAuth();
  const redirectTo =
    typeof location.state === "object" &&
    location.state !== null &&
    "from" in location.state &&
    typeof location.state.from === "string"
      ? location.state.from
      : "/dashboard";

  const phoneForm = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { countryIso: "US", national: "" },
  });
  const otpForm = useForm<OtpForm>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  });
  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: "", lastName: "", email: "" },
  });

  const countryIso = phoneForm.watch("countryIso");
  const dial = useMemo(
    () => DIAL_COUNTRIES.find((country) => country.iso2 === countryIso)?.dial ?? "+1",
    [countryIso],
  );

  const onRequestCode = async (values: PhoneForm) => {
    const phone = nationalDigits(values.national);
    const selectedDial =
      DIAL_COUNTRIES.find((country) => country.iso2 === values.countryIso)?.dial ?? "+1";
    try {
      buildE164(selectedDial, values.national);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enter a valid phone number.");
      return;
    }
    setIsBusy(true);
    try {
      await apiFetch<{ message: string }>("/v1/auth/whatsapp/request-code", {
        method: "POST",
        body: { phone, countryCode: selectedDial },
      });
      setPhoneContext({ countryIso: values.countryIso, countryCode: selectedDial, phone });
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
        navigate(redirectTo, { replace: true });
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
      markAuthenticated();
      toast.success("Account created.");
      navigate(redirectTo, { replace: true });
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

      <section className="flex min-h-screen items-center justify-center p-4 md:p-8">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-md">
          <CardHeader>
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
          <CardContent>
            {step === "phone" && (
              <form className="space-y-4" onSubmit={phoneForm.handleSubmit(onRequestCode)}>
                <label className="space-y-2 text-sm font-medium">
                  <span>Country</span>
                  <Select {...phoneForm.register("countryIso")}>
                    {DIAL_COUNTRIES.map((country) => (
                      <option key={country.iso2} value={country.iso2}>
                        {country.name} ({country.dial})
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  <span>Phone number</span>
                  <div className="flex gap-2">
                    <div className="flex h-10 min-w-16 items-center justify-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                      {dial}
                    </div>
                    <Input
                      inputMode="tel"
                      autoComplete="tel-national"
                      placeholder="5551234567"
                      {...phoneForm.register("national")}
                    />
                  </div>
                </label>
                {phoneForm.formState.errors.national && (
                  <p className="text-sm text-destructive">
                    {phoneForm.formState.errors.national.message}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={isBusy}>
                  Send WhatsApp code
                </Button>
              </form>
            )}

            {step === "otp" && (
              <form className="space-y-4" onSubmit={otpForm.handleSubmit(onVerifyCode)}>
                <label className="space-y-2 text-sm font-medium">
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
                <div className="flex gap-2">
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
              <form className="space-y-4" onSubmit={registerForm.handleSubmit(onRegister)}>
                <label className="space-y-2 text-sm font-medium">
                  <span>First name</span>
                  <Input autoComplete="given-name" {...registerForm.register("firstName")} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  <span>Last name</span>
                  <Input autoComplete="family-name" {...registerForm.register("lastName")} />
                </label>
                <label className="space-y-2 text-sm font-medium">
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
                <div className="flex gap-2">
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
