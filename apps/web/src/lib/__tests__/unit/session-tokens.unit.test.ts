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
    sessionStorage.clear();
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
});
