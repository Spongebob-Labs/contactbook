import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { clearGetCache } from "@/lib/api";
import { clearSessionTokens } from "@/lib/session-tokens";

afterEach(() => {
  // `globals: false` means Testing Library never registers its own auto-cleanup,
  // so mounted trees would leak between component tests without this.
  cleanup();
  clearGetCache();
  clearSessionTokens();
  sessionStorage.clear();
  localStorage.clear();
  document.cookie.split(";").forEach((part) => {
    const name = part.split("=")[0]?.trim();
    if (name) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  });
});
