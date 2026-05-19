import { ContactSource } from "@prisma/client";
import { googlePersonToNormalizedContact } from "./google-contact.adapter";

describe("googlePersonToNormalizedContact", () => {
  it("maps Google Person to normalized relational shape", () => {
    const person = {
      etag: "%EgoBAgkLDC43PT4/GgQBAgUHIgw0RjRHSUYrcjBzND0=",
      resourceName: "people/c7903307026983949454",
      names: [
        {
          metadata: { primary: true },
          givenName: "guyig",
          familyName: "kjhkj",
          displayName: "guyig kjhkj",
        },
      ],
      phoneNumbers: [
        {
          value: "765858768687687",
          metadata: { primary: true },
        },
      ],
      emailAddresses: [
        {
          type: "jhgjh",
          value: "kjkj@hjj.hfu",
          formattedType: "jhgjh",
          metadata: { primary: true },
        },
      ],
      organizations: [
        {
          name: "kjbjkh",
          title: "hjgjkh",
          metadata: { primary: true },
        },
      ],
      metadata: { objectType: "PERSON" },
    };

    const normalized = googlePersonToNormalizedContact(person);
    expect(normalized).toMatchObject({
      source: ContactSource.GOOGLE,
      externalId: "people/c7903307026983949454",
      sourceRevision: person.etag,
      displayName: "guyig kjhkj",
      firstName: "guyig",
      lastName: "kjhkj",
      deleted: false,
    });
    expect(normalized?.phones).toHaveLength(1);
    expect(normalized?.phones[0]).toMatchObject({
      value: "765858768687687",
      isPrimary: true,
    });
    expect(normalized?.emails[0]).toMatchObject({
      value: "kjkj@hjj.hfu",
      label: "jhgjh",
      isPrimary: true,
    });
    expect(normalized?.organizations[0]).toMatchObject({
      companyName: "kjbjkh",
      title: "hjgjkh",
      isPrimary: true,
    });
  });

  it("returns null without resourceName", () => {
    expect(googlePersonToNormalizedContact({})).toBeNull();
  });
});
