/**
 * A stand-in for `next/font/google` under Vitest.
 *
 * `next/font` is a COMPILE-TIME api. In a real build Next's compiler rewrites each
 * `Geist({…})` call into a generated module that downloads and self-hosts the face and returns
 * a class name for it. Under Vitest there is no such transform, so the import resolves to a
 * module whose named exports are not callable, and any layout that loads a font throws
 * `X is not a function` before a single assertion runs — which is what happened the moment the
 * `(marketing)` layout started loading its display face.
 *
 * `vi.mock` in `tests/setup.ts` does NOT fix this: mock registration is hoisted per test file,
 * not globally from a setup file, so the real module still wins. The mechanism that works is a
 * resolve alias, wired in `vitest.config.ts`.
 *
 * ⚠ **Adding a typeface to a route means adding a line here.** Named ESM exports have to exist
 * statically for `import { X } from "next/font/google"` to resolve, so this cannot be a Proxy.
 * The failure mode is loud (`X is not a function` on the first test that renders that layout),
 * which is the right kind of failure for a harness gap.
 */

/** The shape a next/font loader returns, reduced to the parts a layout actually reads. */
interface StubFont {
  variable: string;
  className: string;
  style: { fontFamily: string };
}

const loader =
  (name: string) =>
  (_options?: unknown): StubFont => ({
    variable: `--font-${name.toLowerCase()}`,
    className: `font-${name.toLowerCase()}`,
    style: { fontFamily: name },
  });

/** Body + mono + display, all loaded by the ROOT layout for the whole product. */
export const Geist = loader("geist");
export const Geist_Mono = loader("geist-mono");
export const Space_Grotesk = loader("space");

/**
 * The app chrome's face, also loaded by the root layout.
 *
 * ⚠ It was missing, and the gap only surfaced when a test first imported `app/layout.tsx`
 * directly — `tests/unit/mobile-contracts.test.tsx` reads the `viewport` export from it — at
 * which point the whole suite died at import with `Instrument_Sans is not a function`. Nothing
 * had imported that module before; every other test renders `AppChrome` or below, which never
 * touches the root layout. Exactly the loud failure this file's header promises.
 */
export const Instrument_Sans = loader("instrument");

/**
 * The CARD's display serif, loaded by the root layout for `card-page.tsx`'s name and bio.
 *
 * Added with the 2026-09-17 card rebuild, and the gap announced itself exactly as this file's
 * header promises it would: `mobile-contracts.test.tsx` imports the root layout directly, and
 * the whole file died at import with `Instrument_Serif is not a function` on the first run
 * after the font was added. One line, and the loud failure did its job.
 */
export const Instrument_Serif = loader("instrument-serif");

/*
 * `Fraunces` was here, for the display face `(marketing)/layout.tsx` used to load itself. That
 * layout now loads no typeface at all — marketing draws the app's own Space Grotesk through
 * `--font-space` — so the export is gone with its only caller. Nothing route-scopes a face
 * today; the moment something does, it needs a line here or every test that renders that
 * layout dies at import with `X is not a function`.
 */
