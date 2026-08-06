import { apiFetch } from "@/lib/api";
import type { ShareBatch, ShareRecipientInput, ShareTemplate } from "@/lib/types";

/**
 * Templates currently sendable (active, WhatsApp-approved, verified in sync with
 * Twilio). Empty means sharing is temporarily unavailable.
 */
export async function fetchShareTemplates(): Promise<ShareTemplate[]> {
  return apiFetch<ShareTemplate[]>("/v1/cards/share-templates");
}

export async function shareCard(
  cardId: string,
  input: {
    templateKey: string;
    note?: string;
    recipients: ShareRecipientInput[];
  },
): Promise<ShareBatch> {
  return apiFetch<ShareBatch>(`/v1/cards/${cardId}/share`, {
    method: "POST",
    body: input,
  });
}

export type ShareBatchListResponse = {
  items: ShareBatch[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export async function fetchShares(
  cardId: string,
  page = 1,
  limit = 20,
): Promise<ShareBatchListResponse> {
  return apiFetch<ShareBatchListResponse>(
    `/v1/cards/${cardId}/shares?page=${page}&limit=${limit}`,
  );
}
