/**
 * Reading a card's own vCard back is the only way to learn what it holds — the
 * API returns no list of a card's field mappings, and the `fieldTypes` on a
 * generate response just echoes the filter that was sent in. These cases mirror
 * `serializeCard` in `apps/api/src/card-share/vcard-generator.service.ts`; if
 * that writer changes, this reader has to change with it.
 */
import { describe, expect, it } from "vitest";
import { parseVcardRows, vcardFieldTypes, vcardTextUrl } from "@/lib/vcard-content";

function vcf(...lines: string[]): string {
  return ["BEGIN:VCARD", "VERSION:3.0", ...lines, "END:VCARD"].join("\r\n");
}

describe("vcardFieldTypes", () => {
  it("reads a name-only card as holding nothing", () => {
    // FN/N come from the user row, not a mapping — a card with no fields
    // attached must not look like it carries a detail.
    expect(vcardFieldTypes(vcf("FN:Vansh Mehta", "N:Mehta;Vansh;;;"))).toEqual([]);
  });

  it("tells the three phone types apart by their TYPE param", () => {
    expect(
      vcardFieldTypes(
        vcf(
          "TEL;TYPE=CELL:+919347243575",
          "TEL;TYPE=HOME:+914023456789",
          "TEL;TYPE=FAX:+914023456780",
        ),
      ),
    ).toEqual(["PHONE", "LANDLINE", "FAX"]);
  });

  it("separates a plain website from a social link", () => {
    expect(
      vcardFieldTypes(
        vcf("URL:https://vansh.dev", "URL;TYPE=social:https://x.com/vansh"),
      ),
    ).toEqual(["URL", "SOCIAL_LINK"]);
  });

  it("reads a department only when ORG carries a second part", () => {
    expect(vcardFieldTypes(vcf("ORG:Shava Studios"))).toEqual(["COMPANY"]);
    expect(vcardFieldTypes(vcf("ORG:Shava Studios;Engineering"))).toEqual([
      "COMPANY",
      "DEPARTMENT",
    ]);
  });

  it("covers the remaining single-property types", () => {
    expect(
      vcardFieldTypes(
        vcf(
          "EMAIL:vansh@example.com",
          "ADR:;;12 Main St;Hyderabad;TS;500001;IN",
          "PHOTO;VALUE=uri:https://cdn.example.com/me.jpg",
          "TITLE:Founder",
          "BDAY:1998-04-02",
        ),
      ),
    ).toEqual(["EMAIL", "ADDRESS", "PHOTO", "JOB_TITLE", "DATE"]);
  });

  it("returns canonical order and no duplicates however the file is ordered", () => {
    expect(
      vcardFieldTypes(
        vcf("EMAIL:a@b.com", "TEL;TYPE=CELL:+91", "EMAIL:c@d.com"),
      ),
    ).toEqual(["PHONE", "EMAIL"]);
  });

  it("ignores blank values and unknown properties", () => {
    expect(vcardFieldTypes(vcf("TEL;TYPE=CELL:", "X-SOMETHING:value"))).toEqual([]);
  });

  it("survives a file it cannot make sense of", () => {
    expect(vcardFieldTypes("")).toEqual([]);
    expect(vcardFieldTypes("not a vcard at all")).toEqual([]);
  });
});

describe("parseVcardRows", () => {
  it("labels each property the way a person would read it", () => {
    const rows = parseVcardRows(
      vcf(
        "FN:Vansh Mehta",
        "TEL;TYPE=CELL:+919347243575",
        "ORG:Shava Studios;Engineering",
        "BDAY:1998-04-02",
      ),
    );
    expect(rows).toEqual([
      { label: "Name", value: "Vansh Mehta" },
      { label: "Mobile", value: "+919347243575" },
      { label: "Company", value: "Shava Studios · Engineering" },
      { label: "Birthday", value: "1998-04-02" },
    ]);
  });

  it("unescapes vCard TEXT values and rejoins folded lines", () => {
    const rows = parseVcardRows(
      ["BEGIN:VCARD", "EMAIL:vansh@exa", " mple.com", "TITLE:Founder\\, CEO", "END:VCARD"].join(
        "\r\n",
      ),
    );
    expect(rows).toEqual([
      { label: "Email", value: "vansh@example.com" },
      { label: "Job title", value: "Founder, CEO" },
    ]);
  });

  it("only shows a photo it can actually render", () => {
    expect(parseVcardRows(vcf("PHOTO;VALUE=uri:http://insecure.example/me.jpg"))).toEqual(
      [],
    );
    expect(
      parseVcardRows(vcf("PHOTO;VALUE=uri:https://cdn.example.com/me.jpg")),
    ).toEqual([
      { label: "Photo", value: "https://cdn.example.com/me.jpg", isImage: true },
    ]);
  });
});

describe("vcardTextUrl", () => {
  it("proxies through the API rather than the bucket, escaping each segment", () => {
    expect(vcardTextUrl("card-1/ab cd.vcf")).toMatch(
      /\/v1\/vcards\/download\/card-1\/ab%20cd\.vcf$/,
    );
  });
});
