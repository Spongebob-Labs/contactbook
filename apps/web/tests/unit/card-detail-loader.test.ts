import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AudienceRecipientDto, ShareLinkResponseDto } from "@/lib/api/schema";

const audience = vi.fn();
const listLinks = vi.fn();
const getCard = vi.fn();
const listContacts = vi.fn();

vi.mock("@/lib/api/browser", () => ({
  auth: { me: () => Promise.resolve({ id: "u1", phoneE164: "+919820115577" }) },
  cards: { get: (...a: unknown[]) => getCard(...a), audience: (...a: unknown[]) => audience(...a) },
  contacts: { list: () => listContacts() },
  shareLinks: { list: () => listLinks() },
  profile: {
    me: () =>
      Promise.resolve({
        onboardingCompleted: true,
        identity: {
          primaryEmail: null,
          primaryPhone: "+919820115577",
          firstName: "Priyanka",
          lastName: "Raghunathan",
          profilePhoto: null,
        },
      }),
    listFields: () => Promise.resolve([]),
    listGroups: () => Promise.resolve([]),
  },
}));

const CARD_ID = "11111111-1111-4111-8111-111111111111";

const link = (id: string, contactId: string): ShareLinkResponseDto => ({
  id,
  url: `https://cards.contactbook.app/c/${id}`,
  cardId: CARD_ID,
  cardName: "Work",
  contactId,
  contactPhoneE164: "+919953266232",
  contactDisplayName: null,
  status: "ACTIVE",
  viewCount: 0,
  firstViewedAt: null,
  lastViewedAt: null,
  createdAt: "2026-08-23T18:00:00.000Z",
});

const recipient = (shareLinkId: string, contactId: string, behind: number): AudienceRecipientDto => ({
  shareLinkId,
  contactId,
  contactDisplayName: "Andrew",
  contactPhoneE164: "+919953266232",
  lastNotifiedVersion: behind === 0 ? 5 : null,
  versionsBehind: behind,
  viewCount: 2,
  lastViewedAt: null,
});

beforeEach(() => {
  vi.resetModules();
  getCard.mockReset().mockResolvedValue({
    id: CARD_ID,
    name: "Work",
    kind: "WORK",
    publicUrl: "https://cards.contactbook.app/c/4f8Kq2mR7xJp1sN0vLtQ9a",
    templateId: "meridian",
    paletteId: "emerald",
    groundHex: null,
    finish: null,
    texture: null,
    texturePresence: null,
    textureScale: null,
    fields: [],
    createdAt: "2026-08-23T18:00:00.000Z",
    updatedAt: "2026-08-30T18:00:00.000Z",
  });
  listContacts.mockReset().mockResolvedValue([]);
  listLinks.mockReset().mockResolvedValue([]);
  audience.mockReset().mockResolvedValue({ currentVersion: 5, recipients: [] });
});

describe("fetchCardDetail — the notify audience", () => {
  it("merges versionsBehind onto the matching share row", async () => {
    listLinks.mockResolvedValue([link("link-1", "c-1")]);
    audience.mockResolvedValue({ currentVersion: 5, recipients: [recipient("link-1", "c-1", 2)] });

    const { fetchCardDetail } = await import("@/lib/api/browser-loaders");
    const data = await fetchCardDetail(CARD_ID)();

    expect(data?.shares).toHaveLength(1);
    expect(data?.shares[0]?.versionsBehind).toBe(2);
  });

  it("⚠ keeps a recipient the audience lists but /share-links did not return", async () => {
    /* THE BUG THIS GUARDS. The rows used to be built from `/share-links` with the audience as a
       mere lookup, so any recipient that list omitted vanished from the picker entirely — and a
       recipient the owner cannot see is one they cannot notify. `audience` is authoritative about
       who can be notified, so a disagreement must ADD a row, never drop one. */
    listLinks.mockResolvedValue([link("link-1", "c-1")]);
    audience.mockResolvedValue({
      currentVersion: 5,
      recipients: [recipient("link-1", "c-1", 2), recipient("link-2", "c-2", 5)],
    });

    const { fetchCardDetail } = await import("@/lib/api/browser-loaders");
    const data = await fetchCardDetail(CARD_ID)();

    expect(data?.shares.map((s) => s.shareLinkId).sort()).toEqual(["link-1", "link-2"]);
    const orphan = data?.shares.find((s) => s.shareLinkId === "link-2");
    expect(orphan?.versionsBehind).toBe(5);
    /* Named from what the audience itself carries, since there is no share row to read. */
    expect(orphan?.contactLabel).toBe("Andrew");
    expect(orphan?.status).toBe("ACTIVE");
  });

  it("marks a revoked link null rather than 0 — it has no audience entry and cannot be notified", async () => {
    listLinks.mockResolvedValue([{ ...link("link-1", "c-1"), status: "REVOKED" as const }]);
    audience.mockResolvedValue({ currentVersion: 5, recipients: [] });

    const { fetchCardDetail } = await import("@/lib/api/browser-loaders");
    const data = await fetchCardDetail(CARD_ID)();

    expect(data?.shares[0]?.versionsBehind).toBeNull();
    expect(data?.shares[0]?.lastNotifiedVersion).toBeNull();
  });

  it("still renders recipients when the audience call fails", async () => {
    listLinks.mockResolvedValue([link("link-1", "c-1")]);
    audience.mockRejectedValue(new Error("audience down"));

    const { fetchCardDetail } = await import("@/lib/api/browser-loaders");
    const data = await fetchCardDetail(CARD_ID)();

    /* The card must not lose its "Sent to" list because one enrichment endpoint is unavailable. */
    expect(data?.shares).toHaveLength(1);
    expect(data?.shares[0]?.versionsBehind).toBeNull();
  });
});
