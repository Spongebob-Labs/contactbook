/**
 * Live API smoke tests (default: https://api.getcontactbook.com/api).
 *
 * Env:
 *   LIVE_ACCESS_TOKEN — required for protected GET suites (otherwise skipped)
 *   LIVE_ALLOW_MUTATIONS=1 — allow fake-id mutation probes (default: off)
 *   VITE_API_URL — optional override (e.g. UAT while prod gateway is down)
 *
 * Safety: no OTP send with a real phone, no register. Empty-body auth probes
 * only expect validation 4xx (or report gateway 5xx as infrastructure failure).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LIVE_API_BASE = (
  process.env.VITE_API_URL?.trim() || "https://api.getcontactbook.com/api"
).replace(/\/$/, "");

const LIVE_ACCESS_TOKEN = process.env.LIVE_ACCESS_TOKEN?.trim() || "";
const ALLOW_MUTATIONS = process.env.LIVE_ALLOW_MUTATIONS === "1";

type LiveResult = {
  name: string;
  method: string;
  path: string;
  status: number;
  ok: boolean;
  skipped?: boolean;
  detail?: string;
};

const results: LiveResult[] = [];

function isGatewayFailure(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

async function liveFetch(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown; ok: boolean }> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (LIVE_ACCESS_TOKEN && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${LIVE_ACCESS_TOKEN}`);
  }

  const response = await fetch(`${LIVE_API_BASE}${path}`, {
    ...init,
    headers,
  });
  const text = await response.text();
  let body: unknown = {};
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }
  return { status: response.status, body, ok: response.ok };
}

function record(result: LiveResult) {
  results.push(result);
  // eslint-disable-next-line no-console
  console.log(
    `[live] ${result.ok || result.skipped ? "PASS" : "FAIL"} ${result.method} ${result.path} → ${result.status}${result.detail ? ` (${result.detail})` : ""}`,
  );
}

describe("live API smoke", () => {
  beforeAll(() => {
    // eslint-disable-next-line no-console
    console.log(`[live] base=${LIVE_API_BASE}`);
    // eslint-disable-next-line no-console
    console.log(
      `[live] token=${LIVE_ACCESS_TOKEN ? "present" : "missing (protected GETs will skip)"}`,
    );
    // eslint-disable-next-line no-console
    console.log(`[live] mutations=${ALLOW_MUTATIONS ? "enabled" : "disabled"}`);
  });

  afterAll(() => {
    const target = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../test-results",
    );
    mkdirSync(target, { recursive: true });
    const report = {
      generatedAt: new Date().toISOString(),
      base: LIVE_API_BASE,
      tokenPresent: Boolean(LIVE_ACCESS_TOKEN),
      allowMutations: ALLOW_MUTATIONS,
      results,
      summary: {
        passed: results.filter((r) => r.ok && !r.skipped).length,
        failed: results.filter((r) => !r.ok && !r.skipped).length,
        skipped: results.filter((r) => r.skipped).length,
        gatewayFailures: results.filter((r) => isGatewayFailure(r.status))
          .length,
      },
    };
    writeFileSync(
      join(target, "live-api-report.json"),
      JSON.stringify(report, null, 2),
    );
    const lines = [
      `# Live API report`,
      ``,
      `- Generated: ${report.generatedAt}`,
      `- Base: ${report.base}`,
      `- Token: ${report.tokenPresent ? "present" : "missing"}`,
      `- Mutations: ${report.allowMutations ? "on" : "off"}`,
      `- Passed: ${report.summary.passed} | Failed: ${report.summary.failed} | Skipped: ${report.summary.skipped} | Gateway 5xx: ${report.summary.gatewayFailures}`,
      ``,
      `| Result | Method | Path | Status | Detail |`,
      `| --- | --- | --- | --- | --- |`,
      ...results.map(
        (r) =>
          `| ${r.skipped ? "SKIP" : r.ok ? "PASS" : "FAIL"} | ${r.method} | ${r.path} | ${r.status} | ${r.detail ?? ""} |`,
      ),
      ``,
    ];
    writeFileSync(join(target, "live-api-report.md"), lines.join("\n"));
  });

  it("GET /v1/health returns ok-ish payload", async () => {
    const res = await liveFetch("/v1/health", { method: "GET" });
    const body = res.body as { status?: string };
    const statusOk = res.status === 200 && Boolean(body.status);
    record({
      name: "health",
      method: "GET",
      path: "/v1/health",
      status: res.status,
      ok: statusOk,
      detail: isGatewayFailure(res.status)
        ? "GATEWAY_DOWN — Caddy/upstream 5xx; API not reachable"
        : statusOk
          ? `status=${body.status}`
          : JSON.stringify(res.body).slice(0, 200),
    });
    expect(
      res.status,
      isGatewayFailure(res.status)
        ? `API gateway returned ${res.status} for /v1/health — upstream is down (not a frontend contract bug)`
        : `expected 200 from /v1/health, got ${res.status}`,
    ).toBe(200);
    expect(body.status).toBeTruthy();
  });

  it("auth path probe: otp/whatsapp/send is the live channel", async () => {
    const current = await liveFetch("/v1/auth/otp/whatsapp/send", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const outdated = await liveFetch("/v1/auth/whatsapp/request-code", {
      method: "POST",
      body: JSON.stringify({}),
    });

    if (isGatewayFailure(current.status)) {
      record({
        name: "auth-otp-send",
        method: "POST",
        path: "/v1/auth/otp/whatsapp/send",
        status: current.status,
        ok: false,
        detail: "GATEWAY_DOWN — cannot verify OTP path while upstream is 5xx",
      });
      record({
        name: "auth-request-code-outdated",
        method: "POST",
        path: "/v1/auth/whatsapp/request-code",
        status: outdated.status,
        ok: true,
        skipped: true,
        detail: "GATEWAY_DOWN — outdated path not used by web",
      });
      expect.fail(
        `API gateway returned ${current.status} — cannot validate auth routes until API recovers`,
      );
    }

    const currentAlive = current.status !== 404;
    record({
      name: "auth-otp-send",
      method: "POST",
      path: "/v1/auth/otp/whatsapp/send",
      status: current.status,
      ok: currentAlive,
      detail: currentAlive
        ? "route exists (non-404)"
        : "404 — frontend send path missing on API",
    });
    record({
      name: "auth-request-code-outdated",
      method: "POST",
      path: "/v1/auth/whatsapp/request-code",
      status: outdated.status,
      ok: true,
      detail:
        outdated.status === 404
          ? "outdated path absent (web does not call it)"
          : `legacy path still present (${outdated.status}); web must not call it`,
    });

    expect(current.status).not.toBe(404);
    expect([400, 401, 403, 422, 429]).toContain(current.status);
  });

  it("auth path probe: otp/whatsapp/verify is the live channel", async () => {
    const current = await liveFetch("/v1/auth/otp/whatsapp/verify", {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (isGatewayFailure(current.status)) {
      record({
        name: "auth-otp-verify",
        method: "POST",
        path: "/v1/auth/otp/whatsapp/verify",
        status: current.status,
        ok: false,
        detail: "GATEWAY_DOWN — probe inconclusive",
      });
      expect.fail(
        `API gateway returned ${current.status} for otp/verify — upstream is down`,
      );
    }
    record({
      name: "auth-otp-verify",
      method: "POST",
      path: "/v1/auth/otp/whatsapp/verify",
      status: current.status,
      ok: current.status !== 404,
      detail: current.status === 404 ? "missing on API" : "route exists",
    });
    expect(current.status).not.toBe(404);
    expect([400, 401, 403, 422, 429]).toContain(current.status);
  });

  it("GET /v1/profile/me with Bearer", async () => {
    if (!LIVE_ACCESS_TOKEN) {
      record({
        name: "profile-me",
        method: "GET",
        path: "/v1/profile/me",
        status: 0,
        ok: true,
        skipped: true,
        detail: "LIVE_ACCESS_TOKEN unset",
      });
      return;
    }
    const res = await liveFetch("/v1/profile/me");
    const ok = res.status === 200;
    record({
      name: "profile-me",
      method: "GET",
      path: "/v1/profile/me",
      status: res.status,
      ok,
      detail: isGatewayFailure(res.status)
        ? "GATEWAY_DOWN"
        : ok
          ? "identity present"
          : JSON.stringify(res.body).slice(0, 200),
    });
    expect(res.status).toBe(200);
    expect(res.body).toBeTypeOf("object");
  });

  it("GET /v1/contacts page 1 with Bearer", async () => {
    if (!LIVE_ACCESS_TOKEN) {
      record({
        name: "contacts-list",
        method: "GET",
        path: "/v1/contacts?page=1&limit=5",
        status: 0,
        ok: true,
        skipped: true,
        detail: "LIVE_ACCESS_TOKEN unset",
      });
      return;
    }
    const res = await liveFetch("/v1/contacts?page=1&limit=5");
    record({
      name: "contacts-list",
      method: "GET",
      path: "/v1/contacts?page=1&limit=5",
      status: res.status,
      ok: res.status === 200,
      detail: isGatewayFailure(res.status)
        ? "GATEWAY_DOWN"
        : res.ok
          ? "ok"
          : JSON.stringify(res.body).slice(0, 200),
    });
    expect(res.status).toBe(200);
  });

  it("GET /v1/cards with Bearer", async () => {
    if (!LIVE_ACCESS_TOKEN) {
      record({
        name: "cards-list",
        method: "GET",
        path: "/v1/cards",
        status: 0,
        ok: true,
        skipped: true,
        detail: "LIVE_ACCESS_TOKEN unset",
      });
      return;
    }
    const res = await liveFetch("/v1/cards");
    record({
      name: "cards-list",
      method: "GET",
      path: "/v1/cards",
      status: res.status,
      ok: res.status === 200,
      detail: isGatewayFailure(res.status)
        ? "GATEWAY_DOWN"
        : res.ok
          ? `count=${Array.isArray(res.body) ? res.body.length : "?"}`
          : JSON.stringify(res.body).slice(0, 200),
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /v1/connections with Bearer", async () => {
    if (!LIVE_ACCESS_TOKEN) {
      record({
        name: "connections-list",
        method: "GET",
        path: "/v1/connections",
        status: 0,
        ok: true,
        skipped: true,
        detail: "LIVE_ACCESS_TOKEN unset",
      });
      return;
    }
    const res = await liveFetch("/v1/connections");
    record({
      name: "connections-list",
      method: "GET",
      path: "/v1/connections",
      status: res.status,
      ok: res.status === 200,
      detail: isGatewayFailure(res.status)
        ? "GATEWAY_DOWN"
        : res.ok
          ? `count=${Array.isArray(res.body) ? res.body.length : "object"}`
          : JSON.stringify(res.body).slice(0, 200),
    });
    expect(res.status).toBe(200);
  });

  it("GET /v1/whatsapp-templates with Bearer (tolerate 404)", async () => {
    if (!LIVE_ACCESS_TOKEN) {
      record({
        name: "whatsapp-templates",
        method: "GET",
        path: "/v1/whatsapp-templates",
        status: 0,
        ok: true,
        skipped: true,
        detail: "LIVE_ACCESS_TOKEN unset",
      });
      return;
    }
    const res = await liveFetch("/v1/whatsapp-templates");
    if (isGatewayFailure(res.status)) {
      record({
        name: "whatsapp-templates",
        method: "GET",
        path: "/v1/whatsapp-templates",
        status: res.status,
        ok: false,
        detail: "GATEWAY_DOWN",
      });
      expect.fail(`gateway ${res.status}`);
    }
    const ok = res.status === 200 || res.status === 404;
    record({
      name: "whatsapp-templates",
      method: "GET",
      path: "/v1/whatsapp-templates",
      status: res.status,
      ok,
      detail:
        res.status === 404
          ? "route absent (documented risk)"
          : res.ok
            ? "ok"
            : JSON.stringify(res.body).slice(0, 200),
    });
    expect(ok).toBe(true);
  });

  it("connections resend path probe (gated)", async () => {
    if (!LIVE_ACCESS_TOKEN) {
      record({
        name: "connections-resend-probe",
        method: "POST",
        path: "/v1/connections/requests/00000000-0000-0000-0000-000000000000/resend",
        status: 0,
        ok: true,
        skipped: true,
        detail: "LIVE_ACCESS_TOKEN unset",
      });
      return;
    }
    if (!ALLOW_MUTATIONS) {
      record({
        name: "connections-resend-probe",
        method: "POST",
        path: "/v1/connections/requests/:id/resend",
        status: 0,
        ok: true,
        skipped: true,
        detail: "set LIVE_ALLOW_MUTATIONS=1 to probe fake-id resend",
      });
      return;
    }
    const path =
      "/v1/connections/requests/00000000-0000-0000-0000-000000000000/resend";
    const res = await liveFetch(path, { method: "POST", body: "{}" });
    const ok = res.status !== 404 && !isGatewayFailure(res.status);
    record({
      name: "connections-resend-probe",
      method: "POST",
      path,
      status: res.status,
      ok,
      detail: isGatewayFailure(res.status)
        ? "GATEWAY_DOWN"
        : ok
          ? "route exists"
          : "404 — frontend resend path missing on API",
    });
    expect(res.status).not.toBe(405);
  });
});
