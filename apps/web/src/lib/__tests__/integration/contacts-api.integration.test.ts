import { beforeEach, describe, expect, it } from "vitest";
import {
  createContactGroup,
  createContactTag,
  disconnectGoogle,
  fetchContact,
  fetchContactGroups,
  fetchContactTags,
  fetchContactsPage,
  fetchImportSummary,
  importGoogleContacts,
  importIcloudContacts,
  patchContact,
  setContactGroups,
  setContactTags,
  syncContacts,
} from "@/lib/contacts-api";
import { clearGetCache } from "@/lib/api";
import { mockFetchSequence, pathFromUrl } from "@/test/fetch-mock";
import { FRONTEND_API_CONTRACT } from "../contract-map";

describe("contacts-api integration", () => {
  beforeEach(() => {
    clearGetCache();
  });

  it("lists contacts with 1-based page and normalizes items", async () => {
    const { calls } = mockFetchSequence([
      {
        status: 200,
        body: { contacts: [{ id: "c1" }], total: 1, totalPages: 1, limit: 25 },
      },
    ]);
    const result = await fetchContactsPage({ page: "1", limit: "25" });
    expect(result.items[0]?.id).toBe("c1");
    const path = pathFromUrl(calls[0]?.url ?? "");
    expect(path.startsWith("/api/v1/contacts?")).toBe(true);
    expect(path).toContain("page=1");
    expect(path).toContain("limit=25");
  });

  it("hits detail, patch, import summary, sync, imports", async () => {
    const { calls } = mockFetchSequence([
      { status: 200, body: { id: "c1" } },
      { status: 200, body: { id: "c1", notes: "n" } },
      { status: 200, body: { totalActive: 0, totalDeleted: 0, bySource: [] } },
      {
        status: 200,
        body: {
          source: "GOOGLE",
          syncMode: "full",
          stats: { created: 0, updated: 0, deleted: 0, skipped: 0 },
          processedCount: 0,
          totalContacts: 0,
          lastSyncAt: null,
        },
      },
      { status: 200, body: { imported: 0 } },
      { status: 200, body: { imported: 0 } },
      { status: 200, body: { ok: true } },
    ]);

    await fetchContact("c1");
    await patchContact("c1", { notes: "n" });
    await fetchImportSummary();
    await syncContacts("GOOGLE");
    await importGoogleContacts();
    await importIcloudContacts({
      appleId: "a@icloud.com",
      appSpecificPassword: "xxxx",
    });
    await disconnectGoogle();

    expect(pathFromUrl(calls[0]?.url ?? "")).toBe("/api/v1/contacts/c1");
    expect(calls[1]?.method).toBe("PATCH");
    expect(pathFromUrl(calls[2]?.url ?? "")).toBe(
      `/api${FRONTEND_API_CONTRACT.contacts.importSummary.path}`,
    );
    expect(pathFromUrl(calls[3]?.url ?? "")).toBe(
      "/api/v1/contacts/sync?source=GOOGLE",
    );
    expect(pathFromUrl(calls[4]?.url ?? "")).toBe(
      `/api${FRONTEND_API_CONTRACT.contacts.importGoogle.path}`,
    );
    expect(calls[5]?.method).toBe("POST");
    expect(pathFromUrl(calls[6]?.url ?? "")).toBe(
      `/api${FRONTEND_API_CONTRACT.integrations.googleDisconnect.path}`,
    );
    expect(calls[6]?.method).toBe("DELETE");
  });

  it("manages tags and groups", async () => {
    const { calls } = mockFetchSequence([
      { status: 200, body: [] },
      { status: 200, body: [] },
      { status: 200, body: { id: "t1", name: "vip" } },
      { status: 200, body: { id: "g1", name: "clients" } },
      { status: 200, body: { id: "c1" } },
      { status: 200, body: { id: "c1" } },
    ]);

    await fetchContactTags();
    await fetchContactGroups();
    await createContactTag("vip");
    await createContactGroup("clients");
    await setContactTags("c1", ["t1"]);
    await setContactGroups("c1", ["g1"]);

    expect(pathFromUrl(calls[0]?.url ?? "")).toBe("/api/v1/contacts/tags");
    expect(pathFromUrl(calls[1]?.url ?? "")).toBe("/api/v1/contacts/groups");
    expect(calls[2]?.method).toBe("POST");
    expect(calls[4]?.method).toBe("PUT");
    expect(pathFromUrl(calls[4]?.url ?? "")).toBe("/api/v1/contacts/c1/tags");
    expect(calls[4]?.body).toEqual({ tagIds: ["t1"] });
  });
});
