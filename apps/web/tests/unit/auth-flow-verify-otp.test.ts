import { beforeEach, describe, expect, it, vi } from "vitest";

const otpVerify = vi.fn();
const me = vi.fn();
vi.mock("@/lib/api/browser", () => ({
  auth: { otpVerify: (...args: unknown[]) => otpVerify(...args) },
  profile: { me: (...args: unknown[]) => me(...args) },
}));

import { verifyOtp } from "@/lib/auth-flow-api";

describe("verifyOtp — where the OTP screen sends the user", () => {
  beforeEach(() => {
    otpVerify.mockReset();
    me.mockReset();
  });

  it("reads isOnboardingCompleted off the verify response, with no second request", async () => {
    otpVerify.mockResolvedValue({ userId: "u1", accessToken: "t", isOnboardingCompleted: true });
    const result = await verifyOtp("IN", "9876543210", "123456");
    expect(result).toMatchObject({ ok: true, data: { isOnboardingCompleted: true } });
    expect(me).not.toHaveBeenCalled();
  });

  it("sends a new user (flag false) into signup, still without a profile read", async () => {
    otpVerify.mockResolvedValue({ userId: "u1", accessToken: "t", isOnboardingCompleted: false });
    const result = await verifyOtp("IN", "9876543210", "123456");
    expect(result).toMatchObject({ ok: true, data: { isOnboardingCompleted: false } });
    expect(me).not.toHaveBeenCalled();
  });

  it("asks GET /profile/me when the API build predates the flag, rather than reading undefined as false", async () => {
    otpVerify.mockResolvedValue({ userId: "u1", accessToken: "t" });
    me.mockResolvedValue({ onboardingCompleted: true });
    const result = await verifyOtp("IN", "9876543210", "123456");
    expect(result).toMatchObject({ ok: true, data: { isOnboardingCompleted: true } });
    expect(me).toHaveBeenCalledTimes(1);
  });
});
