import { describe, expect, it } from "vitest";

import { renderWithProviders, screen, userEvent } from "../helpers/render";
import { ToastProvider } from "@/components/overlay/toast";
import { Button } from "@/components/primitives/button";
import { ShareSheet, whatsappShareHref } from "@/components/share/share-sheet";
import type { MintedLink } from "@/components/share/card-sharing";
import { canBuildVcf } from "@/card/build-vcf";
import { resolveCard } from "@/card/resolve-card";
import { cardLedgerDemo } from "@/fixtures/cards";
import { fixtureFields, fixtureGroups } from "@/fixtures/profile";
import { fixtureUser } from "@/fixtures/user";

/**
 * The share panel's link half.
 *
 * The panel exists to hand somebody a URL, and until now nothing proved it hands over the *right*
 * one, or that it stops claiming a link is shareable when it is a `localhost` guess. Both are
 * assertions about copy and structure rather than geometry, which is what this environment can
 * actually decide (spec §14.6).
 *
 * ⚠ The two states are not "loading" and "loaded". They are **live** — a URL the API minted for a
 * named recipient — and **preview**, this app's own `${NEXT_PUBLIC_SITE_URL}/c/{slug}` guess,
 * which resolves to nothing because `ShareCardDto` requires a `contactId` and the API has no
 * anonymous minting path. Presenting the second as the first is the defect these tests exist to
 * prevent.
 */

const LIVE_URL = "https://cards.contactbook.app/c/4f8Kq2mR7xJp1sN0vLtQ9a";

const SENT: MintedLink = {
  shareLinkId: "9c1a1b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c",
  url: LIVE_URL,
  contactId: "b7e1c2a3-1234-4f5a-8b6c-7d8e9f0a1b2c",
  recipientLabel: "Priya",
  recipientPhoneE164: "+919876543210",
  templateMissing: false,
};

/**
 * `resolveCard` no longer takes a share URL — the card's QR and its copyable link are
 * `card.publicUrl`, never whichever ShareLink happened to be minted last. A test that wants a
 * different link overrides the card's own publicUrl.
 */
function resolvedCard(publicUrl?: string) {
  const card =
    publicUrl === undefined ? cardLedgerDemo : { ...cardLedgerDemo, publicUrl };
  return resolveCard(card, fixtureUser, fixtureGroups, fixtureFields);
}

/** Opens the sheet and returns its link block, which is what every assertion here is about. */
async function openLinkBlock(options: {
  shareUrl?: string;
  linkIsLive: boolean;
  lastSent?: MintedLink;
}): Promise<HTMLElement> {
  const resolved = resolvedCard(options.shareUrl);
  renderWithProviders(
    <ToastProvider>
      <ShareSheet
        resolved={resolved}
        sharesNothing={!canBuildVcf(resolved)}
        editHref="/cards/x/edit"
        linkIsLive={options.linkIsLive}
        lastSent={options.lastSent}
        trigger={<Button>Share</Button>}
      />
    </ToastProvider>,
  );

  await userEvent.click(screen.getByRole("button", { name: "Share" }));
  const dialog = await screen.findByRole("dialog");
  const block = dialog.querySelector("[data-share-link]");
  if (block === null) throw new Error("the share panel rendered no link block");
  return block as HTMLElement;
}

/** The whole dialog, for the assertions that are about what the panel does *not* contain. */
async function openDialog(): Promise<HTMLElement> {
  const resolved = resolvedCard(LIVE_URL);
  renderWithProviders(
    <ToastProvider>
      <ShareSheet
        resolved={resolved}
        sharesNothing={!canBuildVcf(resolved)}
        editHref="/cards/x/edit"
        linkIsLive
        lastSent={SENT}
        trigger={<Button>Share</Button>}
      />
    </ToastProvider>,
  );

  await userEvent.click(screen.getByRole("button", { name: "Share" }));
  return (await screen.findByRole("dialog")) as HTMLElement;
}

describe("whatsappShareHref — the deep link the owner presses send on", () => {
  it("strips the + , because wa.me takes bare digits and fails silently on one", () => {
    const href = whatsappShareHref("+919876543210", "Work", LIVE_URL);
    expect(href.startsWith("https://wa.me/919876543210?text=")).toBe(true);
    expect(href).not.toContain("wa.me/+");
  });

  it("carries the link through encoding intact", () => {
    const href = whatsappShareHref("+919876543210", "Work", LIVE_URL);
    const text = new URL(href).searchParams.get("text") ?? "";
    // Read back through the URL parser rather than string-matching the encoded form: what matters
    // is what WhatsApp receives, not how it was spelled on the way.
    expect(text).toContain(LIVE_URL);
  });

  it("survives a card name carrying characters that would truncate a raw query string", () => {
    const href = whatsappShareHref("+919876543210", "R&D #2", LIVE_URL);
    const text = new URL(href).searchParams.get("text") ?? "";
    expect(text).toContain("R&D #2");
    expect(text).toContain(LIVE_URL);
  });
});

describe("the share panel with no link minted yet", () => {
  it("calls it a preview and says plainly that it is not shareable", async () => {
    const block = await openLinkBlock({ linkIsLive: false });

    expect(block).toHaveTextContent("Preview link");
    expect(block.querySelector("[data-share-link-preview-note]")).not.toBeNull();
    // The note has to point at the thing that fixes it, which is the field in the send slot.
    expect(block.textContent).toContain("Create a link above");
  });

  it("offers no copy or share control at all, rather than one that hands over a dead URL", async () => {
    const block = await openLinkBlock({ linkIsLive: false });

    expect(block.querySelector("[data-share-copy]")).toBeNull();
    expect(block.querySelector("[data-share-whatsapp]")).toBeNull();
    expect(block.querySelector("[data-share-link-actions]")).toBeNull();
  });
});

describe("the share panel once a link exists", () => {
  it("publishes the minted URL and calls it live", async () => {
    const block = await openLinkBlock({ shareUrl: LIVE_URL, linkIsLive: true, lastSent: SENT });

    expect(block).toHaveTextContent("Live link");
    expect(block.querySelector("[data-share-link-value]")?.textContent).toBe(LIVE_URL);
    expect(block.querySelector("[data-share-link-preview-note]")).toBeNull();
  });

  it("offers a copy control", async () => {
    const block = await openLinkBlock({ shareUrl: LIVE_URL, linkIsLive: true, lastSent: SENT });

    expect(block.querySelector("[data-share-copy]")).not.toBeNull();
  });

  it("aims the WhatsApp deep link at the recipient the link was minted for", async () => {
    // The card's own name, read off the resolution rather than repeated as a literal — the
    // fixture is named "Work", and a hardcoded guess here tests the test, not the panel.
    const { cardName } = resolvedCard(LIVE_URL);
    const block = await openLinkBlock({ shareUrl: LIVE_URL, linkIsLive: true, lastSent: SENT });

    const wa = block.querySelector("[data-share-whatsapp]");
    expect(wa).not.toBeNull();
    expect(wa?.getAttribute("href")).toBe(
      whatsappShareHref(SENT.recipientPhoneE164, cardName, LIVE_URL),
    );
    expect(wa?.textContent).toContain("Priya");
  });

  /**
   * §8A.6 — the panel and the QR are never two different URLs.
   *
   * The QR encodes `resolved.qrPayload`; so does the WhatsApp message, and so does the string the
   * panel prints. This asserts the seam rather than trusting that three call sites happen to agree.
   */
  it("sends, prints and encodes one single URL", async () => {
    const resolved = resolvedCard(LIVE_URL);
    const block = await openLinkBlock({ shareUrl: LIVE_URL, linkIsLive: true, lastSent: SENT });

    const printed = block.querySelector("[data-share-link-value]")?.textContent ?? "";
    const sent = new URL(
      block.querySelector("[data-share-whatsapp]")?.getAttribute("href") ?? "https://x.test",
    ).searchParams.get("text");

    expect(printed).toBe(resolved.qrPayload);
    expect(sent).toContain(resolved.qrPayload);
  });

  it("reports a link that was minted but not delivered, without calling it a failure", async () => {
    const block = await openLinkBlock({
      shareUrl: LIVE_URL,
      linkIsLive: true,
      lastSent: { ...SENT, templateMissing: true },
    });

    const note = block.querySelector("[data-share-template-missing]");
    expect(note).not.toBeNull();
    expect(note?.textContent).toContain("link above is live");
    // The link is still fully offered — the whole point of not treating this as an error.
    expect(block.querySelector("[data-share-copy]")).not.toBeNull();
  });

  it("still shows the link when nothing was minted this session — a link from a past send", async () => {
    const block = await openLinkBlock({ shareUrl: LIVE_URL, linkIsLive: true });

    expect(block).toHaveTextContent("Live link");
    expect(block.querySelector("[data-share-copy]")).not.toBeNull();
    // No recipient in hand, so no deep link to aim — the copy control is the whole offer.
    expect(block.querySelector("[data-share-whatsapp]")).toBeNull();
  });
});

/**
 * ⚠ The panel hands over a **link**, and must not grow a file back.
 *
 * It used to print the `.vcf` under the heading *"What people receive"* and offer a
 * **Download .vcf** control beside Close. The heading was false — a recipient of this dialog
 * receives a link, and §4.2's whole promise is that the page behind it resolves live, so an
 * edit reaches them with nothing re-sent. The button wrote the owner their own contact
 * details, answering no question they had.
 *
 * The vCard is still the product's (`CLAUDE.md` non-negotiable #2), on the two surfaces where
 * someone actually wants it: the public card's **Save to contacts** and its mirror on the
 * owner's card preview. Neither is this panel.
 *
 * A card that shares plenty is used deliberately: on an empty card these controls were always
 * absent, so only a full card can tell "removed" apart from "gated".
 */
describe("the share panel offers a link and no file at all (§4.2)", () => {
  it("renders no vCard preview and no download control", async () => {
    const dialog = await openDialog();

    expect(dialog.querySelector("[data-vcf-preview]")).toBeNull();
    expect(dialog.querySelector("[data-share-download]")).toBeNull();
  });

  it("never claims the recipient receives a file", async () => {
    const dialog = await openDialog();
    const text = dialog.textContent ?? "";

    expect(text).not.toContain("BEGIN:VCARD");
    expect(text).not.toMatch(/what people receive/i);
    expect(text).not.toMatch(/\.vcf/i);
    expect(text).not.toMatch(/download/i);
  });

  it("leaves Close as the only footer control on a card that shares fine", async () => {
    const dialog = await openDialog();

    expect(dialog.querySelector("[data-share-add-fields]")).toBeNull();
    // The link and the ways to send it are the whole offer.
    expect(dialog.querySelector("[data-share-link]")).not.toBeNull();
    expect(dialog.querySelector("[data-share-copy]")).not.toBeNull();
  });
});
