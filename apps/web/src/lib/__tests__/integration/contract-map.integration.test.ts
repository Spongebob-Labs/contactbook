import { describe, expect, it } from "vitest";
import { FRONTEND_API_CONTRACT, allContractPaths } from "../contract-map";

describe("frontend API contract map", () => {
  it("lists unique absolute-style v1 paths", () => {
    const paths = allContractPaths();
    expect(paths.length).toBeGreaterThan(10);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) {
      expect(path.startsWith("/v1/")).toBe(true);
    }
  });

  it("documents current OTP channel (send/verify — not request-code)", () => {
    expect(FRONTEND_API_CONTRACT.auth.sendOtp.path).toBe(
      "/v1/auth/otp/whatsapp/send",
    );
    expect(FRONTEND_API_CONTRACT.auth.verifyOtp.path).toBe(
      "/v1/auth/otp/whatsapp/verify",
    );
    expect(FRONTEND_API_CONTRACT.auth.outdatedRequestCode.path).toBe(
      "/v1/auth/whatsapp/request-code",
    );
  });
});
