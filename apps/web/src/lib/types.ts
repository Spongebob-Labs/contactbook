export type VerifyCodeResponse =
  | { registered: true }
  | {
      registered: false;
      message: string;
      phoneVerificationToken: string;
    };

export type ContactImport = {
  id: string;
  source: "GOOGLE" | "ICLOUD" | "CSV";
  status: "PENDING" | "PROCESSED" | "FAILED" | "IGNORED";
  displayNameSnapshot: string | null;
  rawPerson: unknown;
  lastSyncedAt: string | null;
  processedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GoogleSyncResponse = {
  imported: number;
};
