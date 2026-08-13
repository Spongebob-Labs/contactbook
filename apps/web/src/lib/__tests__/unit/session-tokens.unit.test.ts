import { describe, expect, it, beforeEach } from "vitest";
import {
  clearSessionTokens,
  getAccessToken,
  getRefreshToken,
  hasClientSessionHint,
  setSessionTokens,
} from "@/lib/session-tokens";

describe("session-tokens", () => {
  beforeEach(() => {
    clearSessionTokens();
  });

  it("stores and reads access/refresh tokens", () => {
    setSessionTokens({
      accessToken: "  access-1  ",
      refreshToken: "refresh-1",
    });
    expect(getAccessToken()).toBe("access-1");
    expect(getRefreshToken()).toBe("refresh-1");
    expect(hasClientSessionHint()).toBe(true);
  });

  it("ignores empty token writes", () => {
    setSessionTokens({ accessToken: "keep", refreshToken: "keep-r" });
    setSessionTokens({ accessToken: "  ", refreshToken: null });
    expect(getAccessToken()).toBe("keep");
    expect(getRefreshToken()).toBe("keep-r");
  });

  it("clears tokens", () => {
    setSessionTokens({ accessToken: "a", refreshToken: "r" });
    clearSessionTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(hasClientSessionHint()).toBe(false);
  });

  it("keeps the session after the tab is closed", () => {
    setSessionTokens({ accessToken: "access-1", refreshToken: "refresh-1" });
    // A new tab starts with an empty per-tab store; the session must survive it.
    sessionStorage.clear();
    expect(getAccessToken()).toBe("access-1");
    expect(hasClientSessionHint()).toBe(true);
  });

  it("adopts tokens left in the per-tab store by an older build", () => {
    sessionStorage.setItem("cb_client_access_token", "legacy-access");
    sessionStorage.setItem("cb_client_refresh_token", "legacy-refresh");

    expect(getAccessToken()).toBe("legacy-access");
    expect(getRefreshToken()).toBe("legacy-refresh");
    expect(localStorage.getItem("cb_client_access_token")).toBe("legacy-access");
    expect(sessionStorage.getItem("cb_client_access_token")).toBeNull();
  });

  it("clears both stores so logout cannot leave a session behind", () => {
    sessionStorage.setItem("cb_client_access_token", "legacy-access");
    setSessionTokens({ accessToken: "access-1", refreshToken: "refresh-1" });

    clearSessionTokens();

    expect(localStorage.getItem("cb_client_access_token")).toBeNull();
    expect(sessionStorage.getItem("cb_client_access_token")).toBeNull();
    expect(hasClientSessionHint()).toBe(false);
  });
});
