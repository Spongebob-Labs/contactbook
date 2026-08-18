import { describe, expect, it } from "vitest";
import { emptyCardSnapshot, type CardSnapshot } from "@/lib/card-schema";
import {
  vcardFilename,
  vcardFromSnapshot,
} from "@/lib/vcard-from-snapshot";

function snapshot(overrides: Partial<CardSnapshot> = {}): CardSnapshot {
  const base = emptyCardSnapshot("Vansh Mehta");
  return {
    ...base,
    identity: {
      ...base.identity,
      title: "SDE Intern",
      company: "Microsoft",
    },
    contact: [
      { id: "c1", type: "phone", label: "", value: "+971501234567", visible: true },
      { id: "c2", type: "email", label: "", value: "v@x.com", visible: true },
      { id: "c3", type: "website", label: "", value: "https://x.com", visible: true },
      { id: "c4", type: "address", label: "", value: "12 Marina Walk, Dubai", visible: true },
    ],
    ...overrides,
  };
}

function lines(vcf: string): string[] {
  return vcf.split("\r\n");
}

describe("vcardFromSnapshot", () => {
  it("emits a well-formed vCard 3.0 envelope with CRLF endings", () => {
    const vcf = vcardFromSnapshot(snapshot());
    expect(vcf.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n")).toBe(true);
    expect(vcf.endsWith("END:VCARD\r\n")).toBe(true);
    expect(vcf).not.toMatch(/[^\r]\n/);
  });

  it("splits the display name into N and keeps FN whole", () => {
    const vcf = lines(vcardFromSnapshot(snapshot()));
    expect(vcf).toContain("N:Mehta;Vansh;;;");
    expect(vcf).toContain("FN:Vansh Mehta");
  });

  it("handles a single-word name without inventing a surname", () => {
    const vcf = lines(vcardFromSnapshot(emptyCardSnapshot("Cher")));
    expect(vcf).toContain("N:;Cher;;;");
  });

  it("maps each typed contact method to its own property", () => {
    const vcf = lines(vcardFromSnapshot(snapshot()));
    expect(vcf).toContain("TEL;TYPE=CELL:+971501234567");
    expect(vcf).toContain("EMAIL;TYPE=INTERNET:v@x.com");
    expect(vcf).toContain("URL:https://x.com");
    expect(vcf).toContain("ADR;TYPE=WORK:;;12 Marina Walk\\, Dubai;;;;");
  });

  it("omits hidden contact methods", () => {
    const base = snapshot();
    const vcf = vcardFromSnapshot({
      ...base,
      contact: base.contact.map((m) =>
        m.type === "phone" ? { ...m, visible: false } : m,
      ),
    });
    expect(vcf).not.toContain("TEL");
    expect(vcf).toContain("EMAIL");
  });

  it("escapes the characters vCard treats as structural", () => {
    const base = snapshot();
    const vcf = lines(
      vcardFromSnapshot({
        ...base,
        identity: {
          ...base.identity,
          company: "Shava; Studios, Inc\\Ltd",
          bio: "Line one\nLine two",
        },
      }),
    );
    expect(vcf).toContain("ORG:Shava\\; Studios\\, Inc\\\\Ltd");
    expect(vcf).toContain("NOTE:Line one\\nLine two");
  });

  it("includes the share URL when given one", () => {
    const vcf = lines(
      vcardFromSnapshot(snapshot(), "https://cb.app/c/vansh-k7qm9x2r"),
    );
    expect(vcf).toContain("URL;TYPE=card:https://cb.app/c/vansh-k7qm9x2r");
  });

  it("folds long lines to 75 octets with a leading-space continuation", () => {
    const base = snapshot();
    const vcf = lines(
      vcardFromSnapshot({
        ...base,
        identity: { ...base.identity, bio: "x".repeat(300) },
      }),
    );
    for (const line of vcf) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
    const noteIndex = vcf.findIndex((l) => l.startsWith("NOTE:"));
    expect(vcf[noteIndex + 1].startsWith(" ")).toBe(true);
  });

  it("embeds a data-URL photo as a base64 PHOTO property", () => {
    const base = snapshot();
    const vcf = vcardFromSnapshot({
      ...base,
      identity: { ...base.identity, photo: "data:image/jpeg;base64,AAAABBBB" },
    });
    expect(vcf).toContain("PHOTO;ENCODING=b;TYPE=JPEG:AAAABBBB");
  });

  it("skips a photo that is not a usable data URL", () => {
    const base = snapshot();
    const vcf = vcardFromSnapshot({
      ...base,
      identity: { ...base.identity, photo: "https://cdn/x.jpg" },
    });
    expect(vcf).not.toContain("PHOTO");
  });

  it("skips an oversized photo rather than emitting an unimportable file", () => {
    const base = snapshot();
    const vcf = vcardFromSnapshot({
      ...base,
      identity: {
        ...base.identity,
        photo: `data:image/jpeg;base64,${"A".repeat(260_000)}`,
      },
    });
    expect(vcf).not.toContain("PHOTO");
  });

  it("records visible socials", () => {
    const base = snapshot();
    const vcf = lines(
      vcardFromSnapshot({
        ...base,
        socials: [
          { id: "s1", platform: "linkedin", url: "https://l.in/v", visible: true },
          { id: "s2", platform: "github", url: "https://gh/v", visible: false },
        ],
      }),
    );
    expect(vcf).toContain("X-SOCIALPROFILE;TYPE=linkedin:https://l.in/v");
    expect(vcf.some((l) => l.includes("github"))).toBe(false);
  });
});

describe("vcardFilename", () => {
  it("slugifies the display name", () => {
    expect(vcardFilename(emptyCardSnapshot("Vansh Mehta"))).toBe(
      "vansh-mehta.vcf",
    );
  });

  it("falls back when the name has nothing usable", () => {
    const base = emptyCardSnapshot("Vansh");
    expect(
      vcardFilename({
        ...base,
        identity: { ...base.identity, displayName: "!!!" },
      }),
    ).toBe("contact.vcf");
  });
});
