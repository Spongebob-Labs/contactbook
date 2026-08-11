import { beforeEach, describe, expect, it } from "vitest";
import { clearGetCache } from "@/lib/api";
import {
  createShareTemplate,
  generateCardVcard,
  getCardShareBatch,
  listCardShares,
  listShareTemplateVariants,
  listShareTemplates,
  renderTemplateBody,
  resendShareRecipient,
  shareCard,
} from "@/lib/card-share-api";
import { isBatchSettled } from "@/lib/card-share-types";
import { mockFetchSequence, pathFromUrl } from "@/test/fetch-mock";

const template = {
  key: "user_baad7976_classic_msk2wpe5",
  locale: "en",
  body: 'New contact card: {{1}} shared "{{2}}" with you on ContactBook.{{3}}',
  buttonTitle: "Get Contact",
  headerImageUrl: "https://storage.googleapis.com/header.png",
  syncedAt: "2026-08-08T09:00:00.000Z",
};

const batch = {
  id: "01aa5634-808b-4a2e-bf69-c9e88a6b8d73",
  cardId: "adf1c578-a54b-49c5-82c1-c060f31ee1d7",
  cardName: "Aayush Sharma",
  cardType: "PERSONAL",
  note: "Great meeting you!",
  createdAt: "2026-08-08T09:37:52.240Z",
  recipients: [
    {
      id: "48e97ff4-0000-4000-8000-000000000000",
      countryCode: "+91",
      phone: "9347243575",
      contactId: null,
      dispatchStatus: "PENDING",
      deliveryStatus: null,
      sentAt: null,
      deliveredAt: null,
      readAt: null,
      failedAt: null,
      createdAt: "2026-08-08T09:37:52.281Z",
    },
  ],
};

describe("card-share-api integration", () => {
  beforeEach(() => {
    clearGetCache();
  });

  it("lists sendable templates and body variants", async () => {
    const { calls } = mockFetchSequence([
      { status: 200, body: [template] },
      {
        status: 200,
        body: [
          { id: "classic", label: "Classic", body: "b", buttonTitle: "Get Contact" },
        ],
      },
    ]);

    const templates = await listShareTemplates();
    expect(templates[0]?.key).toBe(template.key);
    expect(templates[0]?.headerImageUrl).toBe(template.headerImageUrl);
    expect(pathFromUrl(calls[0]?.url ?? "")).toBe("/api/v1/cards/share-templates");

    const variants = await listShareTemplateVariants();
    expect(variants).toEqual([
      { id: "classic", label: "Classic", body: "b", buttonTitle: "Get Contact" },
    ]);
    expect(pathFromUrl(calls[1]?.url ?? "")).toBe(
      "/api/v1/cards/share-templates/variants",
    );
  });

  it("carries buttonType through only when the API sends one", async () => {
    // It decides whether the UI promises an instant download or a follow-up
    // message, so a silently dropped value would mislead the sender.
    mockFetchSequence([
      { status: 200, body: [{ ...template, buttonType: "URL" }, template] },
    ]);

    const templates = await listShareTemplates();
    expect(templates[0]?.buttonType).toBe("URL");
    expect("buttonType" in (templates[1] ?? {})).toBe(false);
  });

  it("creates a user template as multipart form data", async () => {
    const { calls } = mockFetchSequence([
      { status: 201, body: { ...template, approvalStatus: "PENDING" } },
    ]);

    const created = await createShareTemplate({
      variant: "classic",
      image: new File(["x"], "header.png", { type: "image/png" }),
    });

    expect(created.approvalStatus).toBe("PENDING");
    expect(calls[0]?.method).toBe("POST");
    expect(pathFromUrl(calls[0]?.url ?? "")).toBe("/api/v1/cards/share-templates");
    const body = calls[0]?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("variant")).toBe("classic");
    expect(body.get("image")).toBeInstanceOf(File);
    // Content-Type must be left to the browser so the multipart boundary is set.
    expect(calls[0]?.headers["content-type"]).toBeUndefined();
  });

  it("omits the image field for text-only templates", async () => {
    const { calls } = mockFetchSequence([{ status: 201, body: template }]);
    await createShareTemplate({ variant: "minimal" });
    const body = calls[0]?.body as FormData;
    expect(body.get("image")).toBeNull();
  });

  it("shares a card with template, note and field types", async () => {
    const { calls } = mockFetchSequence([{ status: 201, body: batch }]);

    const created = await shareCard(batch.cardId, {
      templateKey: template.key,
      note: "  Great meeting you!  ",
      fieldTypes: ["PHONE", "ADDRESS"],
      recipients: [
        { phone: "9347243575", countryCode: "+91" },
        { phone: "4155551234", countryCode: "+1", contactId: "contact-1" },
      ],
    });

    expect(pathFromUrl(calls[0]?.url ?? "")).toBe(
      `/api/v1/cards/${batch.cardId}/share`,
    );
    expect(calls[0]?.body).toEqual({
      templateKey: template.key,
      recipients: [
        { phone: "9347243575", countryCode: "+91" },
        { phone: "4155551234", countryCode: "+1", contactId: "contact-1" },
      ],
      note: "Great meeting you!",
      fieldTypes: ["PHONE", "ADDRESS"],
    });
    expect(created.recipients[0]?.dispatchStatus).toBe("PENDING");
    expect(isBatchSettled(created)).toBe(false);
  });

  /*
    The API filters with `fieldTypes ? new Set(fieldTypes) : null`, so a literal
    `[]` matches nothing and ships a name-only VCF, while an absent key ships
    every mapped field. The UI's empty selection means the latter — so both the
    share and the vcard body must drop the key rather than send an empty array.
  */
  it("drops an empty field selection from the share body instead of sending []", async () => {
    const { calls } = mockFetchSequence([{ status: 201, body: batch }]);

    await shareCard(batch.cardId, {
      templateKey: template.key,
      fieldTypes: [],
      recipients: [{ phone: "9347243575", countryCode: "+91" }],
    });

    expect(calls[0]?.body).toEqual({
      templateKey: template.key,
      recipients: [{ phone: "9347243575", countryCode: "+91" }],
    });
  });

  it("drops an empty field selection from the vcard body too", async () => {
    const { calls } = mockFetchSequence([
      {
        status: 201,
        body: {
          objectKey: "adf1c578/88d321.vcf",
          url: "https://storage.googleapis.com/contactbook-card-shares/88d321.vcf",
          fieldTypes: [],
          sizeBytes: 141,
        },
      },
    ]);

    await generateCardVcard(batch.cardId, []);

    expect(calls[0]?.body).toEqual({});
  });

  it("polls a batch and resends a failed recipient", async () => {
    const { calls } = mockFetchSequence([
      {
        status: 200,
        body: {
          ...batch,
          recipients: [
            {
              ...batch.recipients[0],
              dispatchStatus: "FAILED",
              failedAt: "2026-08-08T09:40:00.000Z",
            },
          ],
        },
      },
      { status: 200, body: { ...batch.recipients[0], dispatchStatus: "PENDING" } },
    ]);

    const polled = await getCardShareBatch(batch.id);
    expect(isBatchSettled(polled)).toBe(true);
    expect(pathFromUrl(calls[0]?.url ?? "")).toBe(`/api/v1/card-shares/${batch.id}`);

    const recipient = polled.recipients[0];
    const resent = await resendShareRecipient(batch.id, recipient?.id ?? "");
    expect(resent.dispatchStatus).toBe("PENDING");
    expect(calls[1]?.method).toBe("POST");
    expect(pathFromUrl(calls[1]?.url ?? "")).toBe(
      `/api/v1/card-shares/${batch.id}/recipients/${recipient?.id}/resend`,
    );
  });

  it("re-fetches status reads instead of serving the GET cache", async () => {
    // Polling is the whole point of these endpoints — a cached GET would freeze
    // the first response and the UI would never see delivery land.
    const { calls } = mockFetchSequence([
      { status: 200, body: batch },
      {
        status: 200,
        body: {
          ...batch,
          recipients: [
            { ...batch.recipients[0], dispatchStatus: "DISPATCHED", deliveryStatus: "READ" },
          ],
        },
      },
      { status: 200, body: [template] },
      { status: 200, body: [template] },
    ]);

    const first = await getCardShareBatch(batch.id);
    const second = await getCardShareBatch(batch.id);
    expect(first.recipients[0]?.dispatchStatus).toBe("PENDING");
    expect(second.recipients[0]?.deliveryStatus).toBe("READ");
    expect(calls).toHaveLength(2);

    await listShareTemplates();
    await listShareTemplates();
    expect(calls).toHaveLength(4);
  });

  it("normalises the paginated share history and clamps the page", async () => {
    const { calls } = mockFetchSequence([
      { status: 200, body: { items: [batch], page: 1, limit: 20, total: 4, totalPages: 1 } },
    ]);

    const page = await listCardShares(batch.cardId, { page: 0, limit: 20 });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(4);
    expect(pathFromUrl(calls[0]?.url ?? "")).toContain("page=1");
  });

  it("accepts the legacy `batches` key in the share history", async () => {
    mockFetchSequence([{ status: 200, body: { batches: [batch], total: 1 } }]);
    const page = await listCardShares(batch.cardId);
    expect(page.items[0]?.id).toBe(batch.id);
    expect(page.totalPages).toBe(1);
  });

  it("generates a vcard and keeps only known field types", async () => {
    const { calls } = mockFetchSequence([
      {
        status: 201,
        body: {
          objectKey: "adf1c578/88d321.vcf",
          url: "https://storage.googleapis.com/contactbook-card-shares/88d321.vcf",
          fieldTypes: ["PHONE", "ADDRESS", "NOT_A_TYPE"],
          sizeBytes: 141,
        },
      },
    ]);

    const asset = await generateCardVcard(batch.cardId, ["PHONE", "ADDRESS"]);
    expect(asset.fieldTypes).toEqual(["PHONE", "ADDRESS"]);
    expect(asset.sizeBytes).toBe(141);
    expect(pathFromUrl(calls[0]?.url ?? "")).toBe(
      `/api/v1/cards/${batch.cardId}/vcard`,
    );
    expect(calls[0]?.body).toEqual({ fieldTypes: ["PHONE", "ADDRESS"] });
  });

  it("renders template variables the way the server does", () => {
    expect(
      renderTemplateBody(template.body, {
        senderName: "Vansh",
        cardName: "Personal",
        note: "Great meeting you!",
      }),
    ).toBe(
      'New contact card: Vansh shared "Personal" with you on ContactBook. Great meeting you!',
    );

    // An empty note collapses to a single space — WhatsApp rejects empty vars.
    expect(
      renderTemplateBody("a{{3}}b", {
        senderName: "x",
        cardName: "y",
        note: "   ",
      }),
    ).toBe("a b");
  });
});
