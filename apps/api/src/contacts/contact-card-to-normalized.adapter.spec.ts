import { ContactSource, FieldType } from "@prisma/client";
import { contactCardToNormalizedContact } from "./contact-card-to-normalized.adapter";
import { contactbookUserExternalId } from "./contactbook-external-id";

describe("contactCardToNormalizedContact", () => {
  const sharer = {
    id: "user-1",
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: "2025551234",
    countryCode: "+1",
  };

  it("maps phones and omits sensitive fields", () => {
    const contact = contactCardToNormalizedContact(sharer, [
      {
        id: "f1",
        groupId: "g1",
        type: FieldType.PHONE,
        label: "mobile",
        isSensitive: false,
        value: "+12025551234",
        address: null,
      },
      {
        id: "f2",
        groupId: "g1",
        type: FieldType.EMAIL,
        label: "work",
        isSensitive: true,
        value: "secret@example.com",
        address: null,
      },
    ]);

    expect(contact.source).toBe(ContactSource.CONTACTBOOK);
    expect(contact.externalId).toBe(contactbookUserExternalId("user-1"));
    expect(contact.phones).toHaveLength(1);
    expect(contact.emails.every((e) => e.value !== "secret@example.com")).toBe(
      true,
    );
    expect(contact.displayName).toBe("Jane Doe");
  });

  it("falls back to user phone and email when no mapped fields", () => {
    const contact = contactCardToNormalizedContact(sharer, []);
    expect(contact.phones[0]?.value).toContain("+1");
    expect(contact.emails[0]?.value).toBe("jane@example.com");
  });
});
