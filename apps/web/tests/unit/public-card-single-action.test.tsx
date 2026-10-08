import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { canBuildVcf } from "@/card/build-vcf";
import { resolveCard } from "@/card/resolve-card";
import { PublicCardClient } from "@/app/c/[slug]/public-card-client";
import { fixtureCards } from "@/fixtures/cards";
import { fixtureFields, fixtureGroups } from "@/fixtures/profile";
import { fixtureUser } from "@/fixtures/user";

/**
 * The public card page offers exactly one action: **"Send to my phone"**.
 *
 * Client, 2026-10-08: the black "Send to Phone" button — which only downloaded a `.vcf` — comes
 * off, and "Send to my phone" (type your own number, the card arrives on WhatsApp) takes its
 * place as the primary button. These are structural claims, so they hold without a browser; the
 * Playwright suites cover the network side.
 */

const shared = fixtureCards.find((card) => card.id !== undefined && canShare(card));

function canShare(card: (typeof fixtureCards)[number]): boolean {
  return canBuildVcf(resolveCard(card, fixtureUser, fixtureGroups, fixtureFields));
}

function renderPage() {
  if (shared === undefined) throw new Error("no fixture card shares anything");
  const resolved = resolveCard(shared, fixtureUser, fixtureGroups, fixtureFields);
  return render(<PublicCardClient resolved={resolved} token="n5" />);
}

describe("public card actions", () => {
  it("renders one button, and it is Send to my phone", () => {
    const { container } = renderPage();

    expect(container.querySelector("[data-card-actions]")?.getAttribute("data-card-action-count")).toBe("1");
    const buttons = container.querySelectorAll("[data-card-action]");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.getAttribute("data-card-action")).toBe("connect");
    expect(buttons[0]?.textContent).toContain("Send to my phone");
  });

  it("has no vCard download and no 'Send to Phone' button", () => {
    const { container } = renderPage();

    expect(container.querySelector('[data-card-action="save"]')).toBeNull();
    expect(screen.queryByText("Send to Phone", { exact: true })).toBeNull();
  });

  it("is the primary button, and opens a number box that asks for the reader's own", () => {
    const { container } = renderPage();
    const trigger = container.querySelector('[data-card-action="connect"]') as HTMLElement;

    expect(trigger.getAttribute("data-action-variant")).toBe("primary");
    fireEvent.click(trigger);

    expect(container.querySelector("[data-connect-stage]")?.getAttribute("data-connect-stage")).toBe("phone");
    expect(screen.getByLabelText("Your phone number")).toBeTruthy();
    expect(container.textContent).toContain("Enter your own number");
  });
});
