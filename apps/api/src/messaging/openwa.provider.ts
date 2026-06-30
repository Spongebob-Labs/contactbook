import { ConfigService } from "@nestjs/config";
import {
  WHATSAPP_DELIVERY_FAILED,
  WhatsappProviderError,
} from "./whatsapp-errors";
import type {
  WhatsappConnectionInviteInput,
  WhatsappDeliveryEvent,
  WhatsappDeliveryStatus,
  WhatsappOtpInput,
  WhatsappProvider,
  WhatsappProviderEvent,
  WhatsappSendInput,
  WhatsappSendResult,
} from "./whatsapp-provider";

type JsonObject = Record<string, unknown>;

export class OpenWaProvider implements WhatsappProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly sessionId: string;
  private readonly timeoutMs: number;
  private readonly deliveryEvents = new Map<string, WhatsappDeliveryEvent>();

  constructor(config: ConfigService) {
    this.baseUrl = this.required(config, "OPENWA_BASE_URL").replace(/\/$/, "");
    this.apiKey = this.required(config, "OPENWA_API_KEY");
    this.sessionId = this.required(config, "OPENWA_SESSION_ID");
    this.timeoutMs = this.positiveInteger(
      config.get<string>("OPENWA_REQUEST_TIMEOUT_MS") ?? "5000",
      "OPENWA_REQUEST_TIMEOUT_MS",
    );
  }

  sendText(input: WhatsappSendInput): Promise<WhatsappSendResult> {
    return this.sendPlainText(input.toE164, input.text);
  }

  sendOtp(input: WhatsappOtpInput): Promise<WhatsappSendResult> {
    return this.sendPlainText(
      input.toE164,
      `Your ContactBook verification code is ${input.code}. It expires in ${input.expiresInMinutes} minutes.`,
    );
  }

  sendConnectionInvite(
    input: WhatsappConnectionInviteInput,
  ): Promise<WhatsappSendResult> {
    const text = input.signupUrl
      ? `ContactBook: ${input.requesterDisplayName} wants to connect with you. Sign up to accept: ${input.signupUrl}`
      : `ContactBook: ${input.requesterDisplayName} wants to connect. Reply ACCEPT-${input.connectionId} or DECLINE-${input.connectionId}.`;
    return this.sendPlainText(input.toE164, text);
  }

  handleInboundMessage(payload: unknown): WhatsappProviderEvent | null {
    const envelope = asObject(payload);
    const event = stringValue(envelope?.event);
    const data = asObject(envelope?.data);
    if (!event || !data) return null;

    if (event === "message.ack" || event === "message.failed") {
      const providerMessageId =
        stringValue(data.messageId) ?? stringValue(data.id);
      if (!providerMessageId) return null;
      const previous = this.deliveryEvents.get(providerMessageId);
      const status =
        deliveryStatus(data.status) ??
        (event === "message.failed" ? "failed" : previous?.status);
      if (!status) return null;
      const normalized: WhatsappDeliveryEvent = {
        type: event,
        providerMessageId,
        status,
        ...(stringValue(data.errorCode) || previous?.errorCode
          ? { errorCode: stringValue(data.errorCode) ?? previous?.errorCode }
          : {}),
      };
      this.deliveryEvents.set(providerMessageId, normalized);
      return normalized;
    }

    if (event !== "message.received") return null;
    if (
      data.fromMe === true ||
      data.isGroup === true ||
      data.isStatusBroadcast === true
    )
      return null;
    const providerMessageId = stringValue(data.id);
    const sender =
      stringValue(data.senderPhone) ??
      stringValue(data.from) ??
      stringValue(data.chatId);
    const fromE164 = sender ? jidOrPhoneToE164(sender) : null;
    if (!providerMessageId || !fromE164) return null;
    const type = stringValue(data.type) ?? "text";
    if (type !== "text" && type !== "location") return null;
    const locationData = asObject(data.location);
    const latitude = numberValue(locationData?.latitude);
    const longitude = numberValue(locationData?.longitude);
    return {
      type: "message.received",
      providerMessageId,
      fromE164,
      text: (stringValue(data.body) ?? "").trim(),
      ...(latitude != null && longitude != null
        ? { location: { latitude, longitude } }
        : {}),
    };
  }

  async getDeliveryStatus(
    toE164: string,
    providerMessageId: string,
  ): Promise<WhatsappDeliveryEvent> {
    const cached = this.deliveryEvents.get(providerMessageId);
    if (cached && isTerminal(cached.status)) return cached;
    const params = new URLSearchParams({
      chatId: e164ToChatId(toE164),
      limit: "20",
    });
    const response = await this.request(
      `/messages?${params.toString()}`,
      "GET",
    );
    const messages = Array.isArray(response.messages) ? response.messages : [];
    const message = messages
      .map(asObject)
      .find((item) => stringValue(item?.waMessageId) === providerMessageId);
    const normalized: WhatsappDeliveryEvent = {
      type: message?.status === "failed" ? "message.failed" : "message.ack",
      providerMessageId,
      status: deliveryStatus(message?.status) ?? cached?.status ?? "sent",
      ...(cached?.errorCode ? { errorCode: cached.errorCode } : {}),
    };
    this.deliveryEvents.set(providerMessageId, normalized);
    return normalized;
  }

  async getReadiness(): Promise<{ ready: boolean; status: string }> {
    try {
      const response = await this.request("", "GET");
      const status = stringValue(response.status) ?? "unknown";
      return { ready: status === "ready", status };
    } catch {
      return { ready: false, status: "unavailable" };
    }
  }

  private async sendPlainText(
    toE164: string,
    text: string,
  ): Promise<WhatsappSendResult> {
    const response = await this.request("/messages/send-text", "POST", {
      chatId: e164ToChatId(toE164),
      text,
    });
    const providerMessageId = stringValue(response.messageId);
    if (!providerMessageId) {
      throw new WhatsappProviderError(
        WHATSAPP_DELIVERY_FAILED,
        "OpenWA returned no message ID.",
      );
    }
    return {
      providerMessageId,
      status: "sent",
      ...(numberValue(response.timestamp) != null
        ? { timestamp: numberValue(response.timestamp)! }
        : {}),
    };
  }

  private async request(
    path: string,
    method: "GET" | "POST",
    body?: JsonObject,
  ): Promise<JsonObject> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(
        `${this.baseUrl}/api/sessions/${encodeURIComponent(this.sessionId)}${path}`,
        {
          method,
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": this.apiKey,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        },
      );
      const raw = await response.text();
      const json = raw ? asObject(JSON.parse(raw)) : {};
      if (!response.ok || !json) {
        throw new WhatsappProviderError(
          WHATSAPP_DELIVERY_FAILED,
          `OpenWA request failed with status ${response.status}.`,
        );
      }
      return json;
    } finally {
      clearTimeout(timeout);
    }
  }

  private required(config: ConfigService, key: string): string {
    const value = config.get<string>(key)?.trim();
    if (!value)
      throw new Error(`${key} is required when WHATSAPP_PROVIDER=openwa`);
    return value;
  }

  private positiveInteger(value: string, key: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0)
      throw new Error(`${key} must be a positive integer`);
    return parsed;
  }
}

function e164ToChatId(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!/^\d{7,15}$/.test(digits))
    throw new Error("WhatsApp recipient must be a valid E.164 phone number");
  return `${digits}@c.us`;
}

function jidOrPhoneToE164(value: string): string | null {
  const local = value.split("@")[0]?.split(":")[0] ?? "";
  const digits = local.replace(/\D/g, "");
  return /^\d{7,15}$/.test(digits) ? `+${digits}` : null;
}

function asObject(value: unknown): JsonObject | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function deliveryStatus(value: unknown): WhatsappDeliveryStatus | undefined {
  return value === "pending" ||
    value === "sent" ||
    value === "delivered" ||
    value === "read" ||
    value === "failed"
    ? value
    : undefined;
}

function isTerminal(status: WhatsappDeliveryStatus): boolean {
  return status === "delivered" || status === "read" || status === "failed";
}
