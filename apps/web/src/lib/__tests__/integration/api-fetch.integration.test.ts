import { beforeEach, describe, expect, it } from "vitest";
import { API_BASE, ApiError, apiFetch, clearGetCache } from "@/lib/api";
import { setSessionTokens } from "@/lib/session-tokens";
import { mockFetchSequence, pathFromUrl } from "@/test/fetch-mock";
import { FRONTEND_API_CONTRACT } from "../contract-map";

describe("apiFetch integration", () => {
  beforeEach(() => {
    clearGetCache();
    sessionStorage.clear();
  });

  it("sends JSON to absolute live base with credentials", async () => {
    const { calls } = mockFetchSequence([{ status: 200, body: { ok: true } }]);
    await apiFetch("/v1/health", { retry: false });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${API_BASE}/v1/health`);
    expect(calls[0]?.method).toBe("GET");
    expect(calls[0]?.headers["content-type"]).toBe("application/json");
  });

  it("attaches Bearer from session tokens", async () => {
    setSessionTokens({ accessToken: "tok-abc" });
    const { calls } = mockFetchSequence([{ status: 200, body: {} }]);
    await apiFetch("/v1/profile/me");
    expect(calls[0]?.headers.authorization).toBe("Bearer tok-abc");
  });

  it("throws ApiError with formatted message", async () => {
    mockFetchSequence([
      { status: 400, body: { message: ["phone must be a string"] } },
    ]);
    await expect(apiFetch("/v1/x", { method: "POST", body: {}, retry: false })).rejects.toMatchObject(
      {
        name: "ApiError",
        status: 400,
        message: "phone must be a string",
      } satisfies Partial<ApiError>,
    );
  });

  it("refreshes on 401 then retries once for app routes", async () => {
    setSessionTokens({ accessToken: "old", refreshToken: "refresh-1" });
    const { calls } = mockFetchSequence([
      { status: 401, body: { message: "Unauthorized" } },
      {
        status: 200,
        body: { accessToken: "new-access", refreshToken: "new-refresh" },
      },
      { status: 200, body: { id: "me" } },
    ]);

    const result = await apiFetch<{ id: string }>("/v1/profile/me");
    expect(result).toEqual({ id: "me" });
    expect(calls[1]?.url.endsWith(FRONTEND_API_CONTRACT.auth.refresh.path)).toBe(
      true,
    );
    expect(calls[1]?.method).toBe("POST");
    expect(calls).toHaveLength(3);
  });

  it("does not refresh on auth credential 401", async () => {
    setSessionTokens({ refreshToken: "refresh-1" });
    const { calls } = mockFetchSequence([
      { status: 401, body: { message: "Invalid code" } },
    ]);
    await expect(
      apiFetch("/v1/auth/otp/whatsapp/verify", {
        method: "POST",
        body: {},
        retry: false,
      }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(calls).toHaveLength(1);
  });
});
