import { describe, expect, it } from "vitest";
import {
  classifyShareTemplate,
  pickDefaultShareTemplate,
  templateCapabilitySummary,
} from "@/lib/share-template-capabilities";
import type { ShareTemplate } from "@/lib/card-share-types";

function template(overrides: Partial<ShareTemplate> = {}): ShareTemplate {
  return {
    key: "user_baad7976_classic_msk2wpe5",
    locale: "en",
    body: 'New contact card: {{1}} shared "{{2}}" with you on ContactBook.{{3}}',
    buttonTitle: "Get Contact",
    headerImageUrl: null,
    syncedAt: "2026-08-08T09:00:00.000Z",
    ...overrides,
  };
}

describe("classifyShareTemplate", () => {
  it("treats an explicit URL button as delivering the file itself", () => {
    expect(
      classifyShareTemplate(template({ buttonType: "URL" })).deliversVcfInButton,
    ).toBe(true);
  });

  it("treats an explicit quick reply as a second-message delivery", () => {
    expect(
      classifyShareTemplate(template({ buttonType: "QUICK_REPLY" }))
        .deliversVcfInButton,
    ).toBe(false);
  });

  it("lets an explicit quick reply override a vcf-looking key", () => {
    // The key is only a guess; when the API states the button type it wins.
    expect(
      classifyShareTemplate(
        template({ key: "card_share_vcf_en", buttonType: "QUICK_REPLY" }),
      ).deliversVcfInButton,
    ).toBe(false);
  });

  it("does not treat a card_share_vcf key as proof of a URL button", () => {
    // Proven in production on 2026-08-09: `card_share_vcf_en` is a QUICK_REPLY.
    // Its recipients get a reply button and the file as a second message, so a
    // key name is not evidence and must never promise an instant download.
    expect(
      classifyShareTemplate(template({ key: "card_share_vcf_en" }))
        .deliversVcfInButton,
    ).toBe(false);
    expect(
      classifyShareTemplate(template({ key: "card_share_vcf_hi" }))
        .deliversVcfInButton,
    ).toBe(false);
  });

  it("does not assume a user-created template downloads the file", () => {
    expect(classifyShareTemplate(template()).deliversVcfInButton).toBe(false);
  });

  it("does not read an unrecognised button type as a URL button", () => {
    expect(
      classifyShareTemplate(
        template({ key: "card_share_vcf_en", buttonType: "FLOW" }),
      ).deliversVcfInButton,
    ).toBe(false);
  });

  it("treats an empty button type as unknown, never as a download", () => {
    expect(
      classifyShareTemplate(template({ key: "card_share_vcf_en", buttonType: "" }))
        .deliversVcfInButton,
    ).toBe(false);
  });

  it("reports a header image only when one is set", () => {
    expect(
      classifyShareTemplate(
        template({ headerImageUrl: "https://storage.googleapis.com/header.png" }),
      ).hasImage,
    ).toBe(true);
    expect(classifyShareTemplate(template()).hasImage).toBe(false);
    expect(classifyShareTemplate(template({ headerImageUrl: "" })).hasImage).toBe(
      false,
    );
  });
});

describe("pickDefaultShareTemplate", () => {
  it("returns null when nothing is approved yet", () => {
    expect(pickDefaultShareTemplate([])).toBeNull();
  });

  it("prefers a direct download that also carries an image", () => {
    const directOnly = template({ key: "card_share_vcf_en", buttonType: "URL" });
    const directWithImage = template({
      key: "card_share_vcf_image_en",
      buttonType: "URL",
      headerImageUrl: "https://storage.googleapis.com/header.png",
    });
    expect(pickDefaultShareTemplate([directOnly, directWithImage])).toBe(
      directWithImage,
    );
  });

  it("prefers a direct download over a quick reply with an image", () => {
    const quickWithImage = template({
      key: "user_quick",
      buttonType: "QUICK_REPLY",
      headerImageUrl: "https://storage.googleapis.com/header.png",
    });
    const direct = template({ key: "user_direct", buttonType: "URL" });
    expect(pickDefaultShareTemplate([quickWithImage, direct])).toBe(direct);
  });

  it("falls back to the first template when none download directly", () => {
    const first = template({ key: "user_a" });
    const second = template({ key: "user_b" });
    expect(pickDefaultShareTemplate([first, second])).toBe(first);
  });

  it("does not mutate the list it is given", () => {
    const quick = template({ key: "user_a" });
    const direct = template({ key: "card_share_vcf_en", buttonType: "URL" });
    const templates = [quick, direct];

    pickDefaultShareTemplate(templates);

    expect(templates).toHaveLength(2);
    expect(templates[0]).toBe(quick);
    expect(templates[1]).toBe(direct);
  });
});

describe("templateCapabilitySummary", () => {
  it("describes both delivery behaviours", () => {
    expect(
      templateCapabilitySummary({ deliversVcfInButton: true, hasImage: false }),
    ).toBe("Downloads the contact instantly");
    expect(
      templateCapabilitySummary({ deliversVcfInButton: false, hasImage: false }),
    ).toBe("Sends the contact after they tap");
  });

  it("appends the image note when the template has a banner", () => {
    expect(
      templateCapabilitySummary({ deliversVcfInButton: true, hasImage: true }),
    ).toBe("Downloads the contact instantly · With image");
    expect(
      templateCapabilitySummary({ deliversVcfInButton: false, hasImage: true }),
    ).toBe("Sends the contact after they tap · With image");
  });

  it("keeps internal vocabulary out of user-facing copy", () => {
    for (const deliversVcfInButton of [true, false]) {
      for (const hasImage of [true, false]) {
        const summary = templateCapabilitySummary({
          deliversVcfInButton,
          hasImage,
        });
        expect(summary).not.toMatch(/QUICK_REPLY|URL|vcf|vCard|template/i);
      }
    }
  });
});

describe("pickDefaultShareTemplate system preference", () => {
  it("prefers the ContactBook system template over a user one", () => {
    // The backend nominates the seeded system template as the one that will
    // carry the contact file in its button. Selecting it must be deliberate,
    // not a side effect of it happening to be first in the API response.
    const mine = template({ key: "user_baad7976_classic_msk2wpe5" });
    const system = template({ key: "card_share_vcf_en" });

    expect(pickDefaultShareTemplate([mine, system])).toBe(system);
  });

  it("still lets a real URL button beat the system template", () => {
    const system = template({ key: "card_share_vcf_en" });
    const direct = template({ key: "user_direct", buttonType: "URL" });

    expect(pickDefaultShareTemplate([system, direct])).toBe(direct);
  });
});
