import {
  mergeEmails,
  mergeNormalizedContactFields,
  mergePhones,
  mergeScalarFields,
} from "./contact-merge.util";
import { normalizePhoneForDedup } from "./contact-dedup-index";

describe("contact-merge.util", () => {
  it("mergeScalarFields keeps existing values and fills gaps", () => {
    const merged = mergeScalarFields(
      {
        displayName: "Jane Doe",
        firstName: "Jane",
        lastName: "Doe",
        middleName: null,
        namePrefix: null,
        nameSuffix: null,
        nickname: null,
        notes: "Keep me",
        sourceRevision: null,
      },
      {
        displayName: "Other",
        firstName: "Janet",
        lastName: null,
        middleName: "M",
        namePrefix: null,
        nameSuffix: null,
        nickname: "JD",
        notes: null,
        sourceRevision: "rev-2",
      },
    );
    expect(merged.displayName).toBe("Jane Doe");
    expect(merged.middleName).toBe("M");
    expect(merged.nickname).toBe("JD");
    expect(merged.notes).toBe("Keep me");
    expect(merged.sourceRevision).toBe("rev-2");
  });

  it("mergePhones unions by normalized phone key", () => {
    const merged = mergePhones(
      [{ value: "+917013933324", isPrimary: true }],
      [{ value: "7013933324", label: "mobile" }],
      "+91",
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.value).toBe("+917013933324");
  });

  it("mergeEmails unions by normalized email", () => {
    const merged = mergeEmails(
      [{ value: "Jane@Example.com", isPrimary: true }],
      [{ value: "jane@example.com", label: "work" }],
    );
    expect(merged).toHaveLength(1);
  });

  it("mergeNormalizedContactFields combines scalars and children", () => {
    const merged = mergeNormalizedContactFields(
      {
        source: "GOOGLE",
        externalId: "g-1",
        displayName: "Ann Lee",
        phones: [{ value: "+917013933324", isPrimary: true }],
        emails: [],
        organizations: [],
        addresses: [],
        urls: [],
      },
      {
        source: "VCARD",
        externalId: "v-1",
        notes: "From vCard",
        phones: [{ value: "7013933324", isPrimary: true }],
        emails: [{ value: "ann@example.com", isPrimary: true }],
        organizations: [],
        addresses: [],
        urls: [],
      },
      "+91",
    );
    expect(merged.notes).toBe("From vCard");
    expect(merged.emails).toHaveLength(1);
    expect(merged.phones.length).toBeGreaterThanOrEqual(1);
  });
});

describe("normalizePhoneForDedup", () => {
  it("matches national and E.164 forms with default region", () => {
    const e164 = normalizePhoneForDedup("+917013933324");
    const national = normalizePhoneForDedup("7013933324", "+91");
    expect(e164).toBe(national);
  });

  it("dedupes USSD and short codes that libphonenumber rejects", () => {
    expect(normalizePhoneForDedup("*321#")).toBe("svc:*321#");
    expect(normalizePhoneForDedup("543216")).toBe("short:543216");
  });
});
