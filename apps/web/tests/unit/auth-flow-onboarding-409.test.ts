import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";

const onboarding = vi.fn();
vi.mock("@/lib/api/browser", () => ({
  auth: {},
  profile: { onboarding: (...args: unknown[]) => onboarding(...args), me: vi.fn() },
}));

import { submitOnboarding } from "@/lib/auth-flow-api";

const INPUT = { firstName: "Priyanka", lastName: "Raghunathan", email: "priyanka@fernwood.example" };

describe("submitOnboarding", () => {
  beforeEach(() => {
    // Braces matter: a `beforeEach` that RETURNS the mock makes vitest call it as cleanup, which
    // fires a rejecting mock with nothing awaiting it.
    onboarding.mockReset();
  });

  it("succeeds when the API accepts the profile", async () => {
    onboarding.mockResolvedValue({});
    const result = await submitOnboarding(INPUT);
    expect(result.ok).toBe(true);
  });

  it("treats ONBOARDING_ALREADY_COMPLETED as done, so the flow moves on instead of dead-ending", async () => {
    onboarding.mockImplementation(() =>
      Promise.reject(
        new ApiError({
          status: 409,
          code: "ONBOARDING_ALREADY_COMPLETED",
          rawMessage: "Onboarding has already been completed.",
        }),
      ),
    );
    const result = await submitOnboarding(INPUT);
    expect(result.ok).toBe(true);
  });

  it("still reports any other failure", async () => {
    onboarding.mockImplementation(() =>
      Promise.reject(new ApiError({ status: 500, code: "UNKNOWN", rawMessage: "boom" })),
    );
    const result = await submitOnboarding(INPUT);
    expect(result.ok).toBe(false);
  });

  it("still rejects a missing email locally, without calling the API", async () => {
    const result = await submitOnboarding({ ...INPUT, email: "" });
    expect(result.ok).toBe(false);
    expect(onboarding).not.toHaveBeenCalled();
  });
});
