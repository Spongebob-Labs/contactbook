import { ContactSource } from "@prisma/client";
import {
  parseVcfImport,
  parseVcfToNormalizedContacts,
  vcardToNormalizedContact,
} from "./vcard-contact.adapter";
import { ContactImportSkipReason } from "./contact-import-skipped.types";
import vcf from "vcf";

const SAMPLE_VCF = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "UID:test-uid-1",
  "FN:Jane Doe",
  "N:Doe;Jane;Middle;;",
  "NICKNAME:JD",
  "TEL;TYPE=CELL:+12025551234",
  "EMAIL;TYPE=INTERNET:jane@example.com",
  "NOTE:Met at conference",
  "END:VCARD",
].join("\r\n");

describe("vcard-contact.adapter", () => {
  it("maps a vCard to NormalizedContact", () => {
    const card = vcf.parse(SAMPLE_VCF)[0];
    const contact = vcardToNormalizedContact(card);
    expect(contact).toMatchObject({
      source: ContactSource.VCARD,
      externalId: "test-uid-1",
      displayName: "Jane Doe",
      firstName: "Jane",
      lastName: "Doe",
      middleName: "Middle",
      nickname: "JD",
      notes: "Met at conference",
    });
    expect(contact?.phones[0]).toMatchObject({
      value: "+12025551234",
      isPrimary: true,
    });
    expect(contact?.emails[0]).toMatchObject({
      value: "jane@example.com",
      isPrimary: true,
    });
  });

  it("parses multiple cards from one file", () => {
    const multi = `${SAMPLE_VCF}\r\nBEGIN:VCARD\r\nVERSION:3.0\r\nUID:test-2\r\nFN:Bob Smith\r\nEMAIL:bob@test.com\r\nEND:VCARD\r\n`;
    const contacts = parseVcfToNormalizedContacts(multi);
    expect(contacts).toHaveLength(2);
    expect(contacts.map((c) => c.externalId)).toEqual(["test-uid-1", "test-2"]);
  });

  it("uses a stable hash externalId when UID is missing but identity exists", () => {
    const noUid = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Only Name",
      "EMAIL:only@example.com",
      "END:VCARD",
    ].join("\r\n");
    const contact = vcardToNormalizedContact(vcf.parse(noUid)[0]);
    expect(contact?.externalId).toMatch(/^hash:[a-f0-9]{64}$/);
  });

  it("skips cards with no identity fields", () => {
    const empty = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "NOTE:No name or contact methods",
      "END:VCARD",
    ].join("\r\n");
    expect(vcardToNormalizedContact(vcf.parse(empty)[0])).toBeNull();
  });

  it("parseVcfImport returns skipped items with display details", () => {
    const multi = `${SAMPLE_VCF}\r\nBEGIN:VCARD\r\nVERSION:3.0\r\nUID:skip-1\r\nNOTE:No identity\r\nEND:VCARD\r\n`;
    const result = parseVcfImport(multi);
    expect(result.contacts).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toMatchObject({
      externalId: "skip-1",
      reason: ContactImportSkipReason.missing_identity,
    });
  });
});
