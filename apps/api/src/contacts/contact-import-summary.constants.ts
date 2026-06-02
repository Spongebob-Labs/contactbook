import { ContactSource } from "@prisma/client";

/** Sources listed on GET /contacts/import/summary (inventory by Contact.source). */
export const IMPORT_SUMMARY_SOURCES: ContactSource[] = [
  ContactSource.GOOGLE,
  ContactSource.ICLOUD,
  ContactSource.VCARD,
  ContactSource.CONTACTBOOK,
];
