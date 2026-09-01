/**
 * A stand-in for the `server-only` package under Vitest.
 *
 * `import "server-only"` is a **build-time guard**, not a runtime module: bundlers resolve it
 * to a variant that throws if it is ever reached from a client bundle, which is exactly how
 * `src/lib/api/server.ts` makes "this must not ship to the browser" a build error instead of a
 * code review comment.
 *
 * Vitest has no such resolution, so the bare specifier fails with "Failed to resolve import".
 * That is a harness gap, not a problem with the guard — the guard is doing its job in the real
 * build, where it matters. This file gives the specifier something to resolve to.
 *
 * Same mechanism and same reason as `next-font-google.ts`: a resolve alias in
 * `vitest.config.ts`, because `vi.mock` in `tests/setup.ts` is hoisted per test file and the
 * real resolution still wins.
 */

export {};
