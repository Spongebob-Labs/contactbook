/**
 * The share dialog is where two very different recipient experiences have to
 * become legible before anything is sent: a URL-button template downloads the
 * contact file the instant the recipient taps, a quick-reply template only opens
 * a session and the file arrives as a second message.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  ShareCardDialog,
  type ShareCardDialogProps,
} from "@/components/cards/share-card-dialog";
import { useAuth } from "@/context/auth-context";
import { cardFieldSelectionKey } from "@/lib/card-field-selection";
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

vi.mock("@/context/auth-context", () => ({ useAuth: vi.fn() }));

const listShareTemplatesMock = vi.mocked(listShareTemplates);

const USER_ID = "99999999-8888-7777-6666-555555555555";

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
  userId: USER_ID,
  name: "Work card",
  type: "BUSINESS",
  isSensitive: false,
  createdAt: "2026-08-01T09:00:00.000Z",
  updatedAt: "2026-08-07T09:00:00.000Z",
  mappedFieldIds: ["f1", "f2", "f3", "f4"],
};

/**
 * The card's unfiltered vCard — four of the twelve shareable types, which is the
 * whole point: a filter can only narrow what the card already carries. `FN` is
 * not a mapping, so it must not count as a fifth.
 */
function vcf(...lines: string[]): string {
  return ["BEGIN:VCARD", "VERSION:3.0", ...lines, "END:VCARD"].join("\r\n");
}

const CARD_VCF = vcf(
  "FN:Vansh Mehta",
  "N:Mehta;Vansh;;;",
  "TEL;TYPE=CELL:+919347243575",
  "EMAIL:vansh@shavastudios.ai",
  "TITLE:Founder",
  "ORG:Shava Studios",
);

/** The four types CARD_VCF proves, in canonical order. */
const AVAILABLE_LABELS = ["Mobile", "Email", "Job title", "Company"] as const;

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(useAuth).mockReturnValue({ userId: USER_ID } as ReturnType<typeof useAuth>);
  // Both the availability probe and the preview read the VCF through the proxy.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(CARD_VCF)),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Seeds the per-card selection the card page would have written. */
function saveSelection(types: string[]): void {
  window.localStorage.setItem(
    cardFieldSelectionKey(USER_ID),
    JSON.stringify({ [CARD.id]: types }),
  );
}

/** Walks to step 2 and waits for the card's field universe to land. */
async function goToDetailsStep(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await screen.findByText(DIRECT_SUMMARY);
  await user.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText(
    new RegExp(`of ${AVAILABLE_LABELS.length} selected`),
  );
}

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

    await goToDetailsStep(user);

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

  /*
    The card page writes the narrowing to the selection store; the cards list and
    the dashboard open this dialog with no prop at all. Falling back to `[]` there
    meant the API's inverted default took over and the whole card went out.
  */
  it("reads the card's stored narrowing when no default is passed in", async () => {
    const user = userEvent.setup();
    saveSelection(["PHONE"]);
    renderDialog([DIRECT_WITH_IMAGE]);

    await goToDetailsStep(user);

    expect(screen.getByRole("checkbox", { name: /Mobile/ })).toHaveProperty(
      "checked",
      true,
    );
    expect(screen.getByRole("checkbox", { name: /Email/ })).toHaveProperty(
      "checked",
      false,
    );
  });

  /*
    An empty selection means "everything" to the API, so the picker draws every
    box ticked instead of showing empty boxes under a caption claiming the
    opposite.
  */
  it("draws an empty selection as everything ticked", async () => {
    const user = userEvent.setup();
    renderDialog([DIRECT_WITH_IMAGE]);

    await goToDetailsStep(user);

    expect(screen.getByText("4 of 4 selected")).toBeTruthy();
    for (const label of AVAILABLE_LABELS) {
      expect(screen.getByRole("checkbox", { name: new RegExp(label) })).toHaveProperty(
        "checked",
        true,
      );
    }
  });

  /*
    `fieldTypes` filters the mappings a card already holds — it never carries
    values. Offering a type the card has nothing behind promises a detail the
    recipient will never see.
  */
  it("does not let the user tick a detail the card has no value for", async () => {
    const user = userEvent.setup();
    renderDialog([DIRECT_WITH_IMAGE]);

    await goToDetailsStep(user);

    const fax = screen.getByRole("checkbox", { name: /Fax/ });
    expect(fax).toHaveProperty("checked", false);
    expect(fax).toHaveProperty("disabled", true);
  });

  /*
    Unticking the last box stored `[]`, which the API reads as "send everything" —
    so the one click that means "share less" shared the most.
  */
  it("keeps the last ticked detail ticked", async () => {
    const user = userEvent.setup();
    renderDialog([DIRECT_WITH_IMAGE], { defaultFieldTypes: ["PHONE"] });

    await goToDetailsStep(user);

    const mobile = screen.getByRole("checkbox", { name: /Mobile/ });
    expect(mobile).toHaveProperty("disabled", true);
    await user.click(mobile);
    expect(mobile).toHaveProperty("checked", true);
    expect(screen.getByText("1 of 4 selected")).toBeTruthy();
  });

  /*
    A card with no mappings sends FN/N whatever is ticked, so there is no decision
    to make. Twelve dead checkboxes over "0 of 0 selected" read as a broken
    screen — the picker is replaced by the one thing that can be acted on.
  */
  it("replaces the picker with a way out when the card carries nothing", async () => {
    const user = userEvent.setup();
    // A card with no mappings really does generate a name-only file.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(vcf("FN:Vansh Mehta", "N:Mehta;Vansh;;;"))),
    );
    // `mappedFieldIds` left off deliberately: the cards list omits it, so the
    // warning has to survive on the vCard evidence alone.
    renderDialog([DIRECT_WITH_IMAGE], {
      card: { ...CARD, mappedFieldIds: undefined },
    });

    await screen.findByText(DIRECT_SUMMARY);
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(
      await screen.findByText('"Work card" has no details attached yet'),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /open card and attach details/i }),
    ).toBeTruthy();
    // No dead grid, and no "0 of 0 selected" caption under it.
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByText(/of 0 selected/)).toBeNull();
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
