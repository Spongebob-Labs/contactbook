import { createHash } from "node:crypto";
import {
  serializeCard,
  type VCardFieldInput,
  type VCardOwnerInput,
} from "./vcard-generator.service";

const owner: VCardOwnerInput = { firstName: "Ada", lastName: "Lovelace" };

function field(overrides: Partial<VCardFieldInput>): VCardFieldInput {
  return {
    groupId: "group-1",
    type: "PHONE",
    label: null,
    isSensitive: false,
    value: null,
    address: null,
    ...overrides,
  };
}

describe("serializeCard", () => {
  it("always includes FN/N built from the owner's name", () => {
    const { buffer } = serializeCard(owner, []);
    const text = buffer.toString("utf-8");
    expect(text).toContain("FN:Ada Lovelace");
    expect(text).toContain("N:Lovelace;Ada;;;");
    expect(text).toMatch(/^BEGIN:VCARD/);
    expect(text).toMatch(/END:VCARD$/);
  });

  it("excludes fields marked isSensitive even if their type is otherwise mapped", () => {
    const { buffer } = serializeCard(owner, [
      field({ type: "PHONE", value: "+15551234567", isSensitive: true }),
    ]);
    expect(buffer.toString("utf-8")).not.toContain("+15551234567");
  });

  it("excludes FieldTypes with no vCard equivalent (e.g. BANK_ACCOUNT)", () => {
    const { buffer } = serializeCard(owner, [
      field({ type: "BANK_ACCOUNT", value: "ACC123456" }),
      field({ type: "CRYPTO_WALLET", value: "0xABC" }),
      field({ type: "CUSTOM", value: "secret-note" }),
    ]);
    const text = buffer.toString("utf-8");
    expect(text).not.toContain("ACC123456");
    expect(text).not.toContain("0xABC");
    expect(text).not.toContain("secret-note");
  });

  it("maps PHONE/LANDLINE/FAX to TEL with distinct TYPE params", () => {
    const { buffer } = serializeCard(owner, [
      field({ type: "PHONE", value: "+15550001111" }),
      field({ type: "LANDLINE", value: "+15550002222" }),
      field({ type: "FAX", value: "+15550003333" }),
    ]);
    const text = buffer.toString("utf-8");
    expect(text).toMatch(/TEL;TYPE=CELL:\+15550001111/);
    expect(text).toMatch(/TEL;TYPE=HOME:\+15550002222/);
    expect(text).toMatch(/TEL;TYPE=FAX:\+15550003333/);
  });

  it("composes ADR from the AddressDetail fields", () => {
    const { buffer } = serializeCard(owner, [
      field({
        type: "ADDRESS",
        address: {
          street: "1 Infinite Loop",
          city: "Cupertino",
          state: "CA",
          pincode: "95014",
          country: "USA",
        },
      }),
    ]);
    const text = buffer.toString("utf-8");
    expect(text).toContain(
      "ADR:;;1 Infinite Loop;Cupertino;CA;95014;USA",
    );
  });

  it("escapes semicolons, commas, backslashes, and newlines in text values", () => {
    const { buffer } = serializeCard(owner, [
      field({
        type: "ADDRESS",
        address: {
          street: "Suite 5; Building A, Block\\B",
          city: "Line1\nLine2",
          state: null,
          pincode: null,
          country: "USA",
        },
      }),
    ]);
    const text = buffer.toString("utf-8");
    expect(text).toContain("Suite 5\\; Building A\\, Block\\\\B");
    expect(text).toContain("Line1\\nLine2");
  });

  it("pairs COMPANY and DEPARTMENT from the same groupId into one ORG", () => {
    const { buffer } = serializeCard(owner, [
      field({ type: "COMPANY", value: "Acme Corp", groupId: "work-1" }),
      field({ type: "DEPARTMENT", value: "Engineering", groupId: "work-1" }),
      field({ type: "COMPANY", value: "Side Gig LLC", groupId: "work-2" }),
    ]);
    const text = buffer.toString("utf-8");
    expect(text).toContain("ORG:Acme Corp;Engineering");
    expect(text).toContain("ORG:Side Gig LLC");
  });

  it("only maps DATE to BDAY when the label reads as a birthday", () => {
    const { buffer } = serializeCard(owner, [
      field({ type: "DATE", value: "1990-01-01", label: "Birthday" }),
      field({ type: "DATE", value: "2020-05-05", label: "Work anniversary" }),
    ]);
    const text = buffer.toString("utf-8");
    expect(text).toContain("BDAY:1990-01-01");
    expect(text).not.toContain("2020-05-05");
  });

  it("only maps PHOTO when the value is an https URL, skipping silently otherwise", () => {
    const { buffer: withHttps } = serializeCard(owner, [
      field({ type: "PHOTO", value: "https://cdn.example.com/a.jpg" }),
    ]);
    expect(withHttps.toString("utf-8")).toContain(
      "PHOTO;VALUE=URI:https://cdn.example.com/a.jpg",
    );

    const { buffer: withRawBase64 } = serializeCard(owner, [
      field({ type: "PHOTO", value: "not-a-url" }),
    ]);
    expect(withRawBase64.toString("utf-8")).not.toContain("PHOTO");
  });

  it("produces a stable content hash for identical input and a different one for different input", () => {
    const fields = [field({ type: "EMAIL", value: "ada@example.com" })];
    const first = serializeCard(owner, fields);
    const second = serializeCard(owner, fields);
    expect(first.contentHash).toBe(second.contentHash);
    expect(first.contentHash).toBe(
      createHash("sha256").update(first.buffer).digest("hex"),
    );

    const third = serializeCard(owner, [
      field({ type: "EMAIL", value: "different@example.com" }),
    ]);
    expect(third.contentHash).not.toBe(first.contentHash);
  });
});
