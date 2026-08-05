import { afterEach } from "vitest";
import { clearGetCache } from "@/lib/api";
import { clearSessionTokens } from "@/lib/session-tokens";

afterEach(() => {
  clearGetCache();
  clearSessionTokens();
  sessionStorage.clear();
  document.cookie.split(";").forEach((part) => {
    const name = part.split("=")[0]?.trim();
    if (name) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  });
});
