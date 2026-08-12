import { beforeEach, describe, expect, it } from "vitest";
import { fetchHealth } from "@/lib/health-api";
import {
  completeProfileOnboarding,
  deleteProfileGroup,
  deleteProfilePhoto,
  fetchProfileMe,
  patchProfileMe,
} from "@/lib/profile-api";
import { clearGetCache } from "@/lib/api";
import { mockFetchSequence, pathFromUrl } from "@/test/fetch-mock";
import { FRONTEND_API_CONTRACT } from "../contract-map";

describe("health + profile API integration", () => {
  beforeEach(() => {
    clearGetCache();
  });

  it("GETs health without retry", async () => {
    const { calls } = mockFetchSequence([
      { status: 200, body: { status: "ok", timestamp: "t" } },
    ]);
    await fetchHealth();
    expect(pathFromUrl(calls[0]?.url ?? "")).toBe(
      `/api${FRONTEND_API_CONTRACT.health.path}`,
    );
    expect(calls[0]?.method).toBe("GET");
  });

  it("GETs and PATCHes profile/me", async () => {
    const profile = { identity: { firstName: "Ada" } };
    const { calls } = mockFetchSequence([
      { status: 200, body: profile },
      { status: 200, body: profile },
    ]);
    await fetchProfileMe();
    await patchProfileMe({ identity: { firstName: "Ada" } });
    expect(pathFromUrl(calls[0]?.url ?? "")).toBe(
      `/api${FRONTEND_API_CONTRACT.profile.me.path}`,
    );
    expect(calls[1]?.method).toBe("PATCH");
    expect(calls[1]?.body).toEqual({ identity: { firstName: "Ada" } });
  });

  it("POSTs onboarding and DELETEs group", async () => {
    const { calls } = mockFetchSequence([
      { status: 200, body: {} },
      { status: 200, body: {} },
    ]);
    await completeProfileOnboarding({ identity: { firstName: "Ada" } });
    await deleteProfileGroup("g1", "WORK");
    expect(pathFromUrl(calls[0]?.url ?? "")).toBe(
      `/api${FRONTEND_API_CONTRACT.profile.onboarding.path}`,
    );
    expect(calls[0]?.method).toBe("POST");
    expect(pathFromUrl(calls[1]?.url ?? "")).toBe(
      `/api${FRONTEND_API_CONTRACT.profile.deleteGroup.path}`,
    );
    expect(calls[1]?.body).toEqual({ groupId: "g1", category: "WORK" });
  });

  it("DELETEs profile photo by url", async () => {
    const { calls } = mockFetchSequence([
      { status: 200, body: { url: "" } },
    ]);
    await deleteProfilePhoto("https://cdn.example/p.jpg");
    expect(pathFromUrl(calls[0]?.url ?? "")).toBe(
      `/api${FRONTEND_API_CONTRACT.profile.deletePhoto.path}`,
    );
    expect(calls[0]?.method).toBe("DELETE");
    expect(calls[0]?.body).toEqual({ url: "https://cdn.example/p.jpg" });
  });
});
