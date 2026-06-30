import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  WhatsappMessageDirection,
  WhatsappMessagePurpose,
  WhatsappMessageStatus,
  WhatsappProvider as WhatsappProviderName,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  RECIPIENT_INITIATION_REQUIRED,
  WHATSAPP_DELIVERY_FAILED,
  WhatsappProviderError,
} from "./whatsapp-errors";
import {
  WHATSAPP_PROVIDER,
  type WhatsappConnectionInviteInput,
  type WhatsappDeliveryEvent,
  type WhatsappInboundEvent,
  type WhatsappOtpInput,
  type WhatsappProvider,
  type WhatsappProviderEvent,
  type WhatsappSendInput,
  type WhatsappSendResult,
} from "./whatsapp-provider";

export type WhatsappDelivery = {
  ledgerId: string;
  providerMessageId: string;
  status: WhatsappSendResult["status"];
};

@Injectable()
export class WhatsappMessagingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WHATSAPP_PROVIDER) private readonly provider: WhatsappProvider,
    private readonly config: ConfigService,
  ) {}

  sendText(input: WhatsappSendInput): Promise<WhatsappDelivery> {
    return this.sendTracked(
      input.toE164,
      input.purpose,
      input.correlationId,
      () => this.provider.sendText(input),
    );
  }

  sendOtp(input: WhatsappOtpInput): Promise<WhatsappDelivery> {
    return this.sendTracked(
      input.toE164,
      WhatsappMessagePurpose.OTP,
      input.correlationId,
      () => this.provider.sendOtp(input),
    );
  }

  sendConnectionInvite(
    input: WhatsappConnectionInviteInput,
  ): Promise<WhatsappDelivery> {
    return this.sendTracked(
      input.toE164,
      input.signupUrl
        ? WhatsappMessagePurpose.SIGNUP_INVITE
        : WhatsappMessagePurpose.CONNECTION_INVITE,
      input.correlationId,
      () => this.provider.sendConnectionInvite(input),
    );
  }

  normalizeProviderEvent(payload: unknown): WhatsappProviderEvent | null {
    return this.provider.handleInboundMessage(payload);
  }

  getReadiness(): Promise<{ ready: boolean; status: string }> {
    return this.provider.getReadiness();
  }

  async recordDelivery(event: WhatsappDeliveryEvent): Promise<number> {
    const now = new Date();
    const result = await this.prisma.whatsappMessage.updateMany({
      where: {
        provider: WhatsappProviderName.OPENWA,
        providerMessageId: event.providerMessageId,
        status: { in: allowedPriorStatuses(event.status) },
      },
      data: {
        status: toStoredStatus(event.status),
        ...(event.errorCode ? { providerErrorCode: event.errorCode } : {}),
        ...(event.status === "delivered" ? { deliveredAt: now } : {}),
        ...(event.status === "read" ? { readAt: now } : {}),
        ...(event.status === "failed" ? { failedAt: now } : {}),
      },
    });
    return result.count;
  }

  async claimInbound(event: WhatsappInboundEvent): Promise<string | null> {
    try {
      const record = await this.prisma.whatsappMessage.create({
        data: {
          provider: WhatsappProviderName.OPENWA,
          providerMessageId: event.providerMessageId,
          deduplicationKey: `OPENWA:INBOUND:${event.providerMessageId}:${event.type}`,
          eventType: event.type,
          direction: WhatsappMessageDirection.INBOUND,
          purpose: WhatsappMessagePurpose.CONVERSATION,
          phoneE164: event.fromE164,
          status: WhatsappMessageStatus.RECEIVED,
        },
      });
      return record.id;
    } catch (error) {
      if (hasErrorCode(error, "P2002")) {
        const existing = await this.prisma.whatsappMessage.findUnique({
          where: {
            deduplicationKey: `OPENWA:INBOUND:${event.providerMessageId}:${event.type}`,
          },
          select: { id: true, status: true },
        });
        return existing?.status === WhatsappMessageStatus.FAILED
          ? existing.id
          : null;
      }
      throw error;
    }
  }

  async markInboundProcessed(ledgerId: string): Promise<void> {
    await this.prisma.whatsappMessage.update({
      where: { id: ledgerId },
      data: {
        status: WhatsappMessageStatus.PROCESSED,
        processedAt: new Date(),
      },
    });
  }

  async markInboundFailed(ledgerId: string, error: unknown): Promise<void> {
    await this.prisma.whatsappMessage.update({
      where: { id: ledgerId },
      data: {
        status: WhatsappMessageStatus.FAILED,
        providerErrorMessage:
          error instanceof Error ? error.message : String(error),
        failedAt: new Date(),
      },
    });
  }

  private async sendTracked(
    phoneE164: string,
    purpose: WhatsappMessagePurpose,
    correlationId: string | undefined,
    send: () => Promise<WhatsappSendResult>,
  ): Promise<WhatsappDelivery> {
    const ledger = await this.prisma.whatsappMessage.create({
      data: {
        provider: WhatsappProviderName.OPENWA,
        direction: WhatsappMessageDirection.OUTBOUND,
        purpose,
        phoneE164,
        correlationId,
        status: WhatsappMessageStatus.PENDING,
      },
    });
    try {
      const result = await send();
      await this.prisma.whatsappMessage.update({
        where: { id: ledger.id },
        data: {
          providerMessageId: result.providerMessageId,
          deduplicationKey: `OPENWA:OUTBOUND:${result.providerMessageId}`,
          status: toStoredStatus(result.status),
          sentAt: new Date(),
          ...(result.status === "delivered" ? { deliveredAt: new Date() } : {}),
          ...(result.status === "read" ? { readAt: new Date() } : {}),
        },
      });
      const reconciled = await this.reconcileCriticalDelivery(
        ledger.id,
        phoneE164,
        purpose,
        result,
      );
      return {
        ledgerId: ledger.id,
        providerMessageId: result.providerMessageId,
        status: reconciled.status,
      };
    } catch (error) {
      const providerError =
        error instanceof WhatsappProviderError ? error : null;
      await this.prisma.whatsappMessage.update({
        where: { id: ledger.id },
        data: {
          providerMessageId: providerError?.details.providerMessageId,
          ...(providerError?.details.providerMessageId
            ? {
                deduplicationKey: `OPENWA:OUTBOUND:${providerError.details.providerMessageId}`,
              }
            : {}),
          status: WhatsappMessageStatus.FAILED,
          providerErrorCode: providerError?.details.providerErrorCode,
          providerErrorMessage:
            error instanceof Error ? error.message : String(error),
          failedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async reconcileCriticalDelivery(
    ledgerId: string,
    phoneE164: string,
    purpose: WhatsappMessagePurpose,
    initial: WhatsappSendResult,
  ): Promise<WhatsappSendResult> {
    if (
      purpose !== WhatsappMessagePurpose.OTP &&
      purpose !== WhatsappMessagePurpose.CONNECTION_INVITE &&
      purpose !== WhatsappMessagePurpose.SIGNUP_INVITE
    ) {
      return initial;
    }
    const attempts = positiveInteger(
      this.config.get<string>("OPENWA_DELIVERY_POLL_ATTEMPTS", "10"),
      10,
    );
    const intervalMs = nonNegativeInteger(
      this.config.get<string>("OPENWA_DELIVERY_POLL_INTERVAL_MS", "250"),
      250,
    );
    let delivery: WhatsappDeliveryEvent = {
      type: "message.ack",
      providerMessageId: initial.providerMessageId,
      status: initial.status,
    };
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const stored = await this.prisma.whatsappMessage.findUnique({
        where: { id: ledgerId },
        select: { status: true, providerErrorCode: true },
      });
      if (
        stored?.status === WhatsappMessageStatus.FAILED &&
        stored.providerErrorCode
      ) {
        throw deliveryError(
          initial.providerMessageId,
          stored.providerErrorCode,
        );
      }
      try {
        delivery = await this.provider.getDeliveryStatus(
          phoneE164,
          initial.providerMessageId,
        );
        await this.recordDelivery(delivery);
      } catch (error) {
        if (error instanceof WhatsappProviderError) throw error;
      }
      if (delivery.status === "delivered" || delivery.status === "read") {
        return { ...initial, status: delivery.status };
      }
      if (delivery.status === "failed" && delivery.errorCode) {
        throw deliveryError(initial.providerMessageId, delivery.errorCode);
      }
      if (attempt + 1 < attempts)
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    if (delivery.status === "failed")
      throw deliveryError(initial.providerMessageId, delivery.errorCode);
    return initial;
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    error != null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === code
  );
}

function deliveryError(
  providerMessageId: string,
  providerErrorCode?: string,
): WhatsappProviderError {
  return new WhatsappProviderError(
    providerErrorCode === "463"
      ? RECIPIENT_INITIATION_REQUIRED
      : WHATSAPP_DELIVERY_FAILED,
    providerErrorCode === "463"
      ? "The recipient must message the ContactBook sender before WhatsApp can deliver this message."
      : "WhatsApp reported that the message could not be delivered.",
    { providerMessageId, providerErrorCode },
  );
}

function allowedPriorStatuses(
  status: WhatsappSendResult["status"],
): WhatsappMessageStatus[] {
  switch (status) {
    case "pending":
    case "sent":
      return [WhatsappMessageStatus.PENDING, WhatsappMessageStatus.SENT];
    case "delivered":
      return [
        WhatsappMessageStatus.PENDING,
        WhatsappMessageStatus.SENT,
        WhatsappMessageStatus.DELIVERED,
      ];
    case "read":
      return [
        WhatsappMessageStatus.PENDING,
        WhatsappMessageStatus.SENT,
        WhatsappMessageStatus.DELIVERED,
        WhatsappMessageStatus.READ,
      ];
    case "failed":
      return [
        WhatsappMessageStatus.PENDING,
        WhatsappMessageStatus.SENT,
        WhatsappMessageStatus.FAILED,
      ];
  }
}

function positiveInteger(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInteger(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function toStoredStatus(
  status: WhatsappSendResult["status"],
): WhatsappMessageStatus {
  switch (status) {
    case "pending":
      return WhatsappMessageStatus.PENDING;
    case "sent":
      return WhatsappMessageStatus.SENT;
    case "delivered":
      return WhatsappMessageStatus.DELIVERED;
    case "read":
      return WhatsappMessageStatus.READ;
    case "failed":
      return WhatsappMessageStatus.FAILED;
  }
}
