/**
 * Dashboard metrics rendering.
 *
 * The assertions that matter most are the honesty ones: the delivery numbers come
 * from two different axes (`read ⊆ delivered`, and both are separate from the
 * dispatch state), every status carries a text label plus its number rather than
 * a bare colour, and losing the stats request must not show fewer numbers than
 * the page managed before the endpoint existed.
 */
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DashboardMetrics } from "@/components/dashboard/dashboard-metrics";
import type { DashboardStats } from "@/lib/types";

function statsFixture(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    totalCards: 7,
    totalContacts: 8,
    totalShareBatches: 12,
    totalRecipientsReached: 40,
    deliveryBreakdown: {
      pending: 2,
      dispatched: 20,
      delivered: 10,
      read: 4,
      failed: 3,
    },
    topContacts: [
      {
        contactId: "contact-1",
        displayName: "Rahul Sharma",
        countryCode: "+91",
        phone: "9876543210",
        timesSharedWith: 6,
        lastSharedAt: "2026-08-12T18:30:00.000Z",
      },
    ],
    topCards: [
      {
        cardId: "card-1",
        cardName: "Work card",
        cardType: "BUSINESS",
        timesShared: 8,
        recipientCount: 21,
      },
    ],
    sharesLast7Days: 3,
    sharesLast30Days: 12,
    contactsAddedLast30Days: 5,
    newCardsLast30Days: 2,
    ...overrides,
  };
}

function renderMetrics(props: Partial<Parameters<typeof DashboardMetrics>[0]> = {}) {
  render(
    <MemoryRouter>
      <DashboardMetrics
        stats={statsFixture()}
        fallbackCardCount={0}
        fallbackContactCount={0}
        {...props}
      />
    </MemoryRouter>,
  );
}

/** The panel whose heading matches, so list queries stay scoped. */
function panel(name: string): HTMLElement {
  const heading = screen.getByRole("heading", { name });
  const node = heading.parentElement?.parentElement;
  if (!node) throw new Error(`no panel around "${name}"`);
  return node;
}

/**
 * The stat tile carrying this label. Values repeat across the page — a card
 * shared 8 times next to 8 contacts — so a bare `getByText("8")` is ambiguous.
 */
function tile(label: string): HTMLElement {
  const node = screen.getByText(label).closest("div")?.parentElement;
  if (!node) throw new Error(`no tile for "${label}"`);
  return node;
}

describe("DashboardMetrics tiles", () => {
  it("shows the four headline counts with their 30-day deltas", () => {
    renderMetrics();

    expect(within(tile("Cards")).getByText("7")).toBeTruthy();
    expect(within(tile("Cards")).getByText("+2 in the last 30 days")).toBeTruthy();
    expect(within(tile("Contacts")).getByText("8")).toBeTruthy();
    expect(
      within(tile("Contacts")).getByText("+5 in the last 30 days"),
    ).toBeTruthy();
    expect(within(tile("Shares sent")).getByText("12")).toBeTruthy();
    // Both share windows the endpoint returns are surfaced.
    expect(
      within(tile("Shares sent")).getByText("3 in 7 days · 12 in 30"),
    ).toBeTruthy();
    expect(within(tile("People reached")).getByText("40")).toBeTruthy();
  });

  it("derives the read rate against recipients reached", () => {
    renderMetrics();
    // 4 read of 40 recipients.
    expect(screen.getByText("10% read your card")).toBeTruthy();
  });

  it("falls back to the page's own counts when stats are unavailable", () => {
    renderMetrics({ stats: null, fallbackCardCount: 5, fallbackContactCount: 9 });

    expect(within(tile("Cards")).getByText("5")).toBeTruthy();
    expect(within(tile("Contacts")).getByText("9")).toBeTruthy();
    expect(within(tile("Cards")).getByText("Your shareable cards")).toBeTruthy();
    // No invented deltas when there is nothing to derive them from.
    expect(screen.queryByText(/in the last 30 days/)).toBeNull();
  });
});

describe("DashboardMetrics delivery", () => {
  it("renders the funnel steps as shares of recipients reached", () => {
    renderMetrics();
    const delivery = panel("Share delivery");

    // 20/40, 10/40, 4/40 — nested, not a partition.
    expect(within(delivery).getByText("Dispatched")).toBeTruthy();
    expect(within(delivery).getByText("Delivered")).toBeTruthy();
    expect(within(delivery).getByText("Read")).toBeTruthy();
    expect(within(delivery).getByText(/50%/)).toBeTruthy();
    expect(within(delivery).getByText(/25%/)).toBeTruthy();
    expect(within(delivery).getByText(/10%/)).toBeTruthy();
  });

  it("gives each funnel step an accessible label carrying the raw numbers", () => {
    renderMetrics();

    expect(
      screen.getByRole("img", {
        name: "Dispatched: 20 of 40 recipients (50%)",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "Read: 4 of 40 recipients (10%)" }),
    ).toBeTruthy();
  });

  it("labels pending and failed with numbers, never colour alone", () => {
    renderMetrics();
    const delivery = panel("Share delivery");

    expect(within(delivery).getByText(/Pending/)).toBeTruthy();
    expect(within(delivery).getByText("2")).toBeTruthy();
    expect(within(delivery).getByText(/Failed/)).toBeTruthy();
    expect(within(delivery).getByText("3")).toBeTruthy();
  });

  it("prompts instead of drawing empty bars when nothing was ever shared", () => {
    renderMetrics({
      stats: statsFixture({
        totalShareBatches: 0,
        totalRecipientsReached: 0,
        deliveryBreakdown: {
          pending: 0,
          dispatched: 0,
          delivered: 0,
          read: 0,
          failed: 0,
        },
      }),
    });

    expect(
      screen.getByText("Share a card on WhatsApp and delivery shows up here."),
    ).toBeTruthy();
    expect(screen.queryByText("Dispatched")).toBeNull();
  });

  it("does not divide by zero when there are no recipients", () => {
    renderMetrics({
      stats: statsFixture({ totalRecipientsReached: 0 }),
    });

    expect(screen.queryByText(/NaN/)).toBeNull();
    expect(screen.getByText("Recipients across all sends")).toBeTruthy();
  });
});

describe("DashboardMetrics top lists", () => {
  it("links a live card and marks a deleted one", () => {
    renderMetrics({
      stats: statsFixture({
        topCards: [
          {
            cardId: "card-1",
            cardName: "Work card",
            cardType: "BUSINESS",
            timesShared: 8,
            recipientCount: 21,
          },
          {
            cardId: null,
            cardName: "Old card",
            cardType: "PERSONAL",
            timesShared: 2,
            recipientCount: 1,
          },
        ],
      }),
    });

    const link = screen.getByRole("link", { name: "Work card" });
    expect(link.getAttribute("href")).toBe("/dashboard/cards/card-1");
    expect(screen.queryByRole("link", { name: "Old card" })).toBeNull();
    expect(screen.getByText("Deleted")).toBeTruthy();
  });

  it("maps the BUSINESS card type to its user-facing label", () => {
    renderMetrics();
    expect(within(panel("Top cards")).getByText("Work")).toBeTruthy();
  });

  it("singularises a one-person recipient count", () => {
    renderMetrics({
      stats: statsFixture({
        topCards: [
          {
            cardId: "card-1",
            cardName: "Solo",
            cardType: "CUSTOM",
            timesShared: 1,
            recipientCount: 1,
          },
        ],
      }),
    });

    expect(screen.getByText("1 person")).toBeTruthy();
  });

  it("shows a top contact with their number and last share date", () => {
    renderMetrics();
    const contacts = panel("Most shared with");

    expect(within(contacts).getByText("Rahul Sharma")).toBeTruthy();
    expect(within(contacts).getByText("+91 9876543210")).toBeTruthy();
    expect(within(contacts).getByText("6")).toBeTruthy();
  });

  it("tolerates an unparseable last-shared timestamp", () => {
    renderMetrics({
      stats: statsFixture({
        topContacts: [
          {
            contactId: null,
            displayName: "No date",
            countryCode: "+1",
            phone: "5550000",
            timesSharedWith: 1,
            lastSharedAt: "",
          },
        ],
      }),
    });

    expect(within(panel("Most shared with")).getByText("—")).toBeTruthy();
    expect(screen.queryByText(/Invalid Date/)).toBeNull();
  });

  it("prompts when nothing has been shared with anyone", () => {
    renderMetrics({ stats: statsFixture({ topContacts: [], topCards: [] }) });

    expect(screen.getByText("No cards shared yet.")).toBeTruthy();
    expect(screen.getByText("Nobody has received a card yet.")).toBeTruthy();
  });
});

describe("DashboardMetrics refresh", () => {
  it("dims the previous render instead of flashing a skeleton", () => {
    const { container } = render(
      <MemoryRouter>
        <DashboardMetrics
          stats={statsFixture()}
          fallbackCardCount={0}
          fallbackContactCount={0}
          isRefreshing
        />
      </MemoryRouter>,
    );

    const root = container.querySelector("[aria-busy='true']");
    expect(root).not.toBeNull();
    expect(root?.className).toContain("opacity-60");
    // The numbers stay on screen while refreshing.
    expect(within(tile("Cards")).getByText("7")).toBeTruthy();
  });
});
