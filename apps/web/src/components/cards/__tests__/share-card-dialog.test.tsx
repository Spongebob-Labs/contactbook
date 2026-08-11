/**
 * The share dialog is where two very different recipient experiences have to
 * become legible before anything is sent: a URL-button template downloads the
 * contact file the instant the recipient taps, a quick-reply template only opens
 * a session and the file arrives as a second message.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  ShareCardDialog,
  type ShareCardDialogProps,
} from "@/components/cards/share-card-dialog";
import { generateCardVcard, listShareTemplates } from "@/lib/card-share-api";
import type { ShareTemplate } from "@/lib/card-share-types";
import type { ContactCard } from "@/lib/types";

vi.mock("@/lib/card-share-api", async (importOriginal) => {
  // `renderTemplateBody` stays real — the preview is the thing under test.
  const actual = await importOriginal<typeof import("@/lib/card-share-api")>();
  return {
    ...actual,
    listShareTemplates: vi.fn(),
    shareCard: vi.fn(),
    generateCardVcard: vi.fn(),
  };
});

const listShareTemplatesMock = vi.mocked(listShareTemplates);

const QUICK_REPLY: ShareTemplate = {
  key: "user_baad7976_classic_msk2wpe5",
  locale: "en",
  body: 'New contact card: {{1}} shared "{{2}}" with you on ContactBook.{{3}}',
  buttonTitle: "Send it over",
  headerImageUrl: null,
  syncedAt: "2026-08-08T09:00:00.000Z",
};

const DIRECT_WITH_IMAGE: ShareTemplate = {
  key: "card_share_vcf_image_en",
  // Explicit: a key name alone no longer implies a URL button, because
  // production proved card_share_vcf_en is in fact a quick reply.
  buttonType: "URL",
  locale: "en",
  body: '{{1}} shared "{{2}}" with you on ContactBook.{{3}}',
  buttonTitle: "Save contact",
  headerImageUrl: "https://storage.googleapis.com/card-shares/header.png",
  syncedAt: "2026-08-08T09:00:00.000Z",
};

const CARD: ContactCard = {
  id: "11111111-2222-3333-4444-555555555555",
  userId: "99999999-8888-7777-6666-555555555555",
  name: "Work card",
  type: "BUSINESS",
  createdAt: "2026-08-01T09:00:00.000Z",
  updatedAt: "2026-08-07T09:00:00.000Z",
};

function renderDialog(
  templates: ShareTemplate[],
  props: Partial<ShareCardDialogProps> = {},
): RenderResult {
  listShareTemplatesMock.mockResolvedValue(templates);
  vi.mocked(generateCardVcard).mockResolvedValue({
    objectKey: "card/abc.vcf",
    url: "https://storage.googleapis.com/card-shares/abc.vcf",
    fieldTypes: [],
    sizeBytes: 141,
  });
  return render(
    <MemoryRouter>
      <ShareCardDialog
        open
        onClose={() => {}}
        card={CARD}
        senderName="Vansh Mehta"
        {...props}
      />
    </MemoryRouter>,
  );
}

/** The radio option wrapping a given capability summary. */
function optionFor(summary: string): HTMLElement {
  const option = screen.getByText(summary).closest('[role="radio"]');
  if (!(option instanceof HTMLElement)) {
    throw new Error(`No template option renders "${summary}"`);
  }
  return option;
}

const DIRECT_SUMMARY = "Downloads the contact instantly · With image";
const QUICK_SUMMARY = "Sends the contact after they tap";

describe("ShareCardDialog step 1 — template capabilities", () => {
  it("says what tapping each template's button actually does", async () => {
    renderDialog([QUICK_REPLY, DIRECT_WITH_IMAGE]);

    expect(await screen.findByText(DIRECT_SUMMARY)).toBeTruthy();
    expect(screen.getByText(QUICK_SUMMARY)).toBeTruthy();
  });

  it("preselects the direct-download template, not merely the first one", async () => {
    renderDialog([QUICK_REPLY, DIRECT_WITH_IMAGE]);

    await screen.findByText(DIRECT_SUMMARY);

    expect(optionFor(DIRECT_SUMMARY).getAttribute("aria-checked")).toBe("true");
    expect(optionFor(QUICK_SUMMARY).getAttribute("aria-checked")).toBe("false");
  });

  it("does not overwrite a template the user picked when the list settles", async () => {
    const user = userEvent.setup();
    const { rerender } = renderDialog([QUICK_REPLY, DIRECT_WITH_IMAGE]);

    await screen.findByText(DIRECT_SUMMARY);
    await user.click(optionFor(QUICK_SUMMARY));

    // A late render pass re-runs the default-selection effect; an explicit
    // choice has to survive it.
    rerender(
      <MemoryRouter>
        <ShareCardDialog
          open
          onClose={() => {}}
          card={CARD}
          senderName="Vansh M"
        />
      </MemoryRouter>,
    );

    expect(optionFor(QUICK_SUMMARY).getAttribute("aria-checked")).toBe("true");
    expect(optionFor(DIRECT_SUMMARY).getAttribute("aria-checked")).toBe("false");
  });
});

describe("ShareCardDialog step 1 — message preview", () => {
  it("previews a direct template's button as a download", async () => {
    renderDialog([DIRECT_WITH_IMAGE]);

    // The empty preview renders while templates load, so wait for the option.
    await screen.findByText(DIRECT_SUMMARY);
    const preview = screen.getByRole("group", {
      name: "WhatsApp message preview",
    });
    expect(within(preview).getByText("Save contact")).toBeTruthy();
    expect(
      within(preview).getByText("Tapping downloads the contact file"),
    ).toBeTruthy();
  });

  it("previews a quick-reply template's button as a reply instead", async () => {
    renderDialog([QUICK_REPLY]);

    await screen.findByText(QUICK_SUMMARY);
    const preview = screen.getByRole("group", {
      name: "WhatsApp message preview",
    });
    expect(within(preview).getByText("Send it over")).toBeTruthy();
    expect(
      within(preview).getByText("Tapping replies — the contact file follows"),
    ).toBeTruthy();
    expect(
      within(preview).queryByText("Tapping downloads the contact file"),
    ).toBeNull();
  });

  it("swaps the preview affordance when the user changes template", async () => {
    const user = userEvent.setup();
    renderDialog([QUICK_REPLY, DIRECT_WITH_IMAGE]);

    await screen.findByText(DIRECT_SUMMARY);
    const preview = screen.getByRole("group", {
      name: "WhatsApp message preview",
    });
    expect(
      within(preview).getByText("Tapping downloads the contact file"),
    ).toBeTruthy();

    await user.click(optionFor(QUICK_SUMMARY));

    expect(
      within(preview).getByText("Tapping replies — the contact file follows"),
    ).toBeTruthy();
  });
});

describe("ShareCardDialog steps", () => {
  it("gates Next on having a template to send", async () => {
    renderDialog([]);

    expect(await screen.findByText("No approved templates yet")).toBeTruthy();
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next" }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("enables Next once a template is selected", async () => {
    renderDialog([QUICK_REPLY, DIRECT_WITH_IMAGE]);

    await screen.findByText(DIRECT_SUMMARY);

    expect(screen.getByRole("button", { name: "Next" }).hasAttribute("disabled")).toBe(
      false,
    );
  });

  it("prefills step 2 from the card's saved field selection", async () => {
    const user = userEvent.setup();
    renderDialog([DIRECT_WITH_IMAGE], { defaultFieldTypes: ["PHONE", "EMAIL"] });

    await screen.findByText(DIRECT_SUMMARY);
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("checkbox", { name: /Mobile/ })).toHaveProperty(
      "checked",
      true,
    );
    expect(screen.getByRole("checkbox", { name: /Email/ })).toHaveProperty(
      "checked",
      true,
    );
    expect(screen.getByRole("checkbox", { name: /Website/ })).toHaveProperty(
      "checked",
      false,
    );
  });

  it("spells out that an empty selection shares everything", async () => {
    const user = userEvent.setup();
    renderDialog([DIRECT_WITH_IMAGE]);

    await screen.findByText(DIRECT_SUMMARY);
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(
      screen.getByText(
        /shares every field mapped to this card — not none of them/i,
      ),
    ).toBeTruthy();
  });
});

describe("ShareCardDialog delivery expectation", () => {
  it("states what the recipient gets before sending, for a direct template", async () => {
    const user = userEvent.setup();
    renderDialog([DIRECT_WITH_IMAGE]);
    await screen.findByText(DIRECT_SUMMARY);

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText(/tapping the button should open your contact file/i)).toBeTruthy();
  });

  it("warns on the send step when the contact will arrive as a second message", async () => {
    const user = userEvent.setup();
    renderDialog([QUICK_REPLY]);
    await screen.findByText(QUICK_SUMMARY);

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    // The sender must not discover this from a recipient complaining later.
    expect(
      screen.getByText(/contact file arrives as a separate message/i),
    ).toBeTruthy();
  });
});


describe("ShareCardDialog contact file preview", () => {
  it("previews the exact file the send will use, for the fields chosen here", async () => {
    // The share call and the preview must be driven by one selection. Previewing
    // a different field list than the one sent is how a photo silently vanishes:
    // the VCF is content-addressed, so a different selection is a different file.
    const user = userEvent.setup();
    renderDialog([DIRECT_WITH_IMAGE], { defaultFieldTypes: ["PHONE", "EMAIL"] });
    await screen.findByText(DIRECT_SUMMARY);

    await user.click(screen.getByRole("button", { name: "Next" }));

    await vi.waitFor(
      () => {
        expect(vi.mocked(generateCardVcard)).toHaveBeenCalledWith(CARD.id, [
          "PHONE",
          "EMAIL",
        ]);
      },
      { timeout: 3000 },
    );
  });
});
