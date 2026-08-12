import { beforeEach, describe, expect, it } from "vitest";
import {
  completeRegistration,
  sendWhatsappOtp,
  verifyWhatsappOtp,
} from "@/lib/auth-api";
import { clearGetCache } from "@/lib/api";
import { mockFetchSequence, pathFromUrl } from "@/test/fetch-mock";
import { FRONTEND_API_CONTRACT } from "../contract-map";

describe("auth-api integration", () => {
  beforeEach(() => {
    clearGetCache();
  });

  it("POSTs send OTP to current otp/whatsapp/send path", async () => {
    const { calls } = mockFetchSequence([
      { status: 200, body: { message: "OTP sent", expiresInSeconds: 300 } },
    ]);
    await sendWhatsappOtp({ phone: "9876543210", countryCode: "+91" });
    expect(pathFromUrl(calls[0]?.url ?? "")).toBe(
      `/api${FRONTEND_API_CONTRACT.auth.sendOtp.path}`,
    );
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.body).toEqual({
      phone: "9876543210",
      countryCode: "+91",
    });
  });

  it("POSTs verify OTP with code", async () => {
    const { calls } = mockFetchSequence([
      { status: 200, body: { registered: true, accessToken: "a" } },
    ]);
    await verifyWhatsappOtp(
      { phone: "9876543210", countryCode: "+91" },
      "123456",
    );
    expect(pathFromUrl(calls[0]?.url ?? "")).toBe(
      `/api${FRONTEND_API_CONTRACT.auth.verifyOtp.path}`,
    );
    expect(calls[0]?.body).toEqual({
      phone: "9876543210",
      countryCode: "+91",
      code: "123456",
    });
  });

  it("POSTs register with trimmed fields and the verified phone pair", async () => {
    const token = "t".repeat(24);
    const { calls } = mockFetchSequence([{ status: 200, body: {} }]);
    await completeRegistration({
      phoneVerificationToken: ` ${token} `,
      firstName: " Ada ",
      lastName: " Lovelace ",
      phone: " 098765 43210 ",
      countryCode: " 91 ",
      email: " ada@example.com ",
    });
    expect(pathFromUrl(calls[0]?.url ?? "")).toBe(
      `/api${FRONTEND_API_CONTRACT.auth.register.path}`,
    );
    expect(calls[0]?.body).toEqual({
      phoneVerificationToken: token,
      firstName: "Ada",
      lastName: "Lovelace",
      phone: "9876543210",
      countryCode: "+91",
      email: "ada@example.com",
    });
  });
});
