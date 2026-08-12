import { apiFetch } from "@/lib/api";

export type ConnectionStatus = "PENDING" | "ACCEPTED" | "DECLINED" | string;

export type ConnectionDelivery = {
  ledgerId?: string;
  providerMessageId?: string;
  status?: string;
};

export type ConnectionItem = {
  type: "connection";
  id: string;
  status: ConnectionStatus;
  requesterId: string;
  receiverId: string;
  requesterSharedCardId?: string | null;
  receiverSharedCardId?: string | null;
  hasSharedBack?: boolean;
  delivery?: ConnectionDelivery | null;
  createdAt: string;
  updatedAt?: string;
};

export type ConnectionInviteItem = {
  type: "invite";
  id: string;
  recipientKind?: string;
  recipientContactId?: string | null;
  recipientCountryCode?: string | null;
  recipientPhone?: string | null;
  status: ConnectionStatus;
  expiresAt?: string | null;
  createdAt: string;
  delivery?: ConnectionDelivery | null;
};

export type ConnectionListItem = ConnectionItem | ConnectionInviteItem;

export type SendConnectionRequestInput =
  | {
      recipientCountryCode: string;
      recipientPhone: string;
      requesterSharedCardId?: string;
    }
  | {
      recipientContactId: string;
      requesterSharedCardId?: string;
    };

export async function listConnections(): Promise<ConnectionListItem[]> {
  const raw = await apiFetch<unknown>("/v1/connections");
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw as ConnectionListItem[];
}

export async function sendConnectionRequest(
  input: SendConnectionRequestInput,
): Promise<ConnectionListItem> {
  return apiFetch<ConnectionListItem>("/v1/connections/requests", {
    method: "POST",
    body: input,
  });
}

export async function resendConnectionRequest(
  requestId: string,
): Promise<ConnectionDelivery | ConnectionListItem> {
  return apiFetch(`/v1/connections/requests/${requestId}/resend`, {
    method: "POST",
  });
}
