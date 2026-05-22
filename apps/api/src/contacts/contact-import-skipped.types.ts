export const ContactImportSkipReason = {
  missing_identity: "missing_identity",
  unparseable: "unparseable",
} as const;

export type ContactImportSkipReason =
  (typeof ContactImportSkipReason)[keyof typeof ContactImportSkipReason];

export type ContactImportSkippedItem = {
  externalId: string | null;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  primaryPhone: string | null;
  primaryEmail: string | null;
  reason: ContactImportSkipReason;
};
