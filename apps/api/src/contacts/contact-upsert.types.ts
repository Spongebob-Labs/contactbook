import type { Contact } from "@prisma/client";

export type ContactUpsertOutcome = "added" | "updated";

export type ContactUpsertResult = {
  contact: Contact;
  outcome: ContactUpsertOutcome;
  duplicateFound: boolean;
};

export type ContactSoftDeleteResult = {
  outcome: "deleted";
  duplicateFound: false;
};
