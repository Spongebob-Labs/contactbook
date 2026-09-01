import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Every unit/contract file gets a clean DOM. Without this, `screen` queries leak
// across tests and produce "found multiple elements" failures that look like
// product bugs but are harness bugs.
afterEach(() => {
  cleanup();
});
