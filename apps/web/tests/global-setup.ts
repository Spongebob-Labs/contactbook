import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { SNAPSHOT_PATH, buildApiSnapshot } from "./stubs/api-snapshot";

/**
 * Writes the fixture snapshot the e2e API stub serves.
 *
 * Playwright transpiles this file and resolves the `@/` alias from `tsconfig.json`, which is
 * the whole reason the snapshot is built here rather than in `tests/stubs/api.mjs`: that server
 * is a separate plain-Node process, and this workspace ships no TypeScript runner for it. See
 * the header of `api-snapshot.ts` for the full reasoning.
 *
 * ⚠ Do not add anything order-dependent here. `webServer` and `globalSetup` have swapped
 * relative order between Playwright versions, so the stub reads this file **per request**
 * rather than at boot and simply 503s with a named error until it exists.
 */
export default function globalSetup(): void {
  const target = resolve(process.cwd(), SNAPSHOT_PATH);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(buildApiSnapshot(), null, 2)}\n`, "utf8");
  process.stdout.write(`e2e fixtures written to ${SNAPSHOT_PATH}\n`);
}
