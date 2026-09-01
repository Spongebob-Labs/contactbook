import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";

/**
 * The unit/contract render wrapper.
 *
 * It is deliberately a bare pass-through today: there is no global provider in this run.
 * T04 composes its own fixture provider **in its own test file** rather than editing this
 * module — `tests/helpers/**` is single-owner (plan §1.2).
 *
 * ⚠ happy-dom has no layout engine. Never assert geometry through this helper; every
 * `getBoundingClientRect` is a vacuous zero (spec §14.6). Geometry is Playwright-only.
 */
function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function renderWithProviders(
  ui: ReactElement,
  options: Omit<RenderOptions, "wrapper"> = {},
): RenderResult {
  return render(ui, { wrapper: Providers, ...options });
}

export {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
