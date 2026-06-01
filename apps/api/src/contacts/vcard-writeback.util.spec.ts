import {
  buildIcloudResourceUrl,
  patchVcardFromContact,
} from "./vcard-writeback.util";

describe("patchVcardFromContact", () => {
  const baseVcard = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "UID:abc",
    "FN:Old Name",
    "N:Doe;John;;;",
    "TEL;TYPE=CELL:111",
    "EMAIL;TYPE=HOME:old@example.com",
    "END:VCARD",
  ].join("\n");

  it("updates name, phones, and emails", () => {
    const patched = patchVcardFromContact(baseVcard, {
      firstName: "Jane",
      lastName: "Smith",
      displayName: "Jane Smith",
      notes: null,
      phones: [{ value: "+15551234", label: "mobile" }],
      emails: [{ value: "jane@example.com", label: "work" }],
      organizations: [{ companyName: "Acme", title: "CEO" }],
    });
    expect(patched).toContain("FN:Jane Smith");
    expect(patched).toContain("N:Smith;Jane");
    expect(patched).toContain("TEL;TYPE=MOBILE:+15551234");
    expect(patched).toContain("EMAIL;TYPE=WORK:jane@example.com");
    expect(patched).toContain("ORG:Acme;CEO");
    expect(patched).not.toContain("111");
    expect(patched).not.toContain("old@example.com");
  });
});

describe("buildIcloudResourceUrl", () => {
  it("joins server base and path", () => {
    expect(
      buildIcloudResourceUrl(
        "https://p12-contacts.icloud.com",
        "/123/carddav/contacts/a.vcf",
      ),
    ).toBe("https://p12-contacts.icloud.com/123/carddav/contacts/a.vcf");
  });
});
