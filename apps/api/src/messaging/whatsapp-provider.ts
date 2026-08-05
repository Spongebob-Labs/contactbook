import type { WhatsappMessagePurpose } from "@prisma/client";

export const WHATSAPP_PROVIDER = Symbol("WHATSAPP_PROVIDER");

export type WhatsappDeliveryStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export interface WhatsappSendInput {
  toE164: string;
  text: string;
  purpose: WhatsappMessagePurpose;
  correlationId?: string;
}

export interface WhatsappOtpInput {
  toE164: string;
  code: string;
  expiresInMinutes: number;
  correlationId?: string;
}

export interface WhatsappConnectionInviteInput {
  toE164: string;
  requesterDisplayName: string;
  connectionId?: string;
  signupUrl?: string;
  correlationId?: string;
}

export interface WhatsappSendResult {
  providerMessageId: string;
  status: WhatsappDeliveryStatus;
  timestamp?: number;
}

export type WhatsappInboundEvent = {
  type: "message.received";
  providerMessageId: string;
  fromE164: string;
  text: string;
  location?: { latitude: number; longitude: number };
};

export type WhatsappDeliveryEvent = {
  type: "message.ack" | "message.failed";
  providerMessageId: string;
  status: WhatsappDeliveryStatus;
  errorCode?: string;
};

export type WhatsappProviderEvent =
  | WhatsappInboundEvent
  | WhatsappDeliveryEvent;

export interface WhatsappProvider {
  sendText(input: WhatsappSendInput): Promise<WhatsappSendResult>;
  sendOtp(input: WhatsappOtpInput): Promise<WhatsappSendResult>;
  sendConnectionInvite(
    input: WhatsappConnectionInviteInput,
  ): Promise<WhatsappSendResult>;
  handleInboundMessage(payload: unknown): WhatsappProviderEvent | null;
  getDeliveryStatus(
    toE164: string,
    providerMessageId: string,
  ): Promise<WhatsappDeliveryEvent>;
  getReadiness(): Promise<{ ready: boolean; status: string }>;
}
