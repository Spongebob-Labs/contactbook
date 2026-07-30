import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TwilioSendError } from "../twilio-otp/twilio-error-mapping";

const CONTENT_API_BASE = "https://content.twilio.com/v1/Content";

export type TwilioApprovalStatus =
  | "approved"
  | "pending"
  | "received"
  | "rejected"
  | "unknown";

export type CreateTemplateInput = {
  name: string;
  body: string;
  buttonTitle: string;
  category: string;
};

export type TwilioTemplateApproval = {
  contentSid: string;
  approvalStatus: TwilioApprovalStatus;
  rejectionReason?: string;
};

@Injectable()
export class TwilioContentApiService {
  private readonly logger = new Logger(TwilioContentApiService.name);

  constructor(private readonly config: ConfigService) {}

  private authHeader(): string {
    const accountSid = this.config.get<string>("TWILIO_ACCOUNT_SID");
    const authToken = this.config.get<string>("TWILIO_AUTH_TOKEN");
    if (!accountSid || !authToken) {
      throw new TwilioSendError("Twilio credentials are not configured", 503);
    }
    return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
  }

  private get vcardBaseUrl(): string {
    return (
      this.config
        .get<string>("GCS_CARD_SHARES_PUBLIC_BASE_URL")
        ?.replace(/\/+$/, "") ?? ""
    );
  }

  /**
   * Creates a twilio/call-to-action Content Template with a URL button pointing at the
   * GCS vCard bucket. Variable {{4}} in the button URL is the per-send object key.
   * Returns the new Content SID.
   */
  async create(input: CreateTemplateInput): Promise<string> {
    const baseUrl = this.vcardBaseUrl;
    if (!baseUrl) {
      throw new TwilioSendError(
        "GCS_CARD_SHARES_PUBLIC_BASE_URL is not configured",
        503,
      );
    }

    const payload = {
      friendly_name: input.name,
      language: "en",
      variables: {
        "1": "Ada Lovelace",
        "2": "Business Card",
        "3": " Great meeting you!",
        "4": "sample/contact.vcf",
      },
      types: {
        "twilio/call-to-action": {
          body: input.body,
          actions: [
            {
              type: "URL",
              title: input.buttonTitle,
              url: `${baseUrl}/{{4}}`,
            },
          ],
        },
      },
    };

    const res = await fetch(CONTENT_API_BASE, {
      method: "POST",
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      this.logger.warn(
        `Twilio Content API create failed: ${res.status} ${JSON.stringify(json)}`,
      );
      throw new TwilioSendError(
        `Failed to create Twilio template: ${(json["message"] as string) ?? res.status}`,
        res.status >= 500 ? 502 : 400,
      );
    }

    return json["sid"] as string;
  }

  /** Submits a Content Template for WhatsApp approval. Returns the initial approval status. */
  async submitForApproval(
    contentSid: string,
    name: string,
    category: string,
  ): Promise<TwilioApprovalStatus> {
    const res = await fetch(
      `${CONTENT_API_BASE}/${encodeURIComponent(contentSid)}/ApprovalRequests/whatsapp`,
      {
        method: "POST",
        headers: {
          Authorization: this.authHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, category }),
      },
    );

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      this.logger.warn(
        `Twilio approval submission failed: ${res.status} ${JSON.stringify(json)}`,
      );
      throw new TwilioSendError(
        `Failed to submit template for WhatsApp approval: ${(json["message"] as string) ?? res.status}`,
        res.status >= 500 ? 502 : 400,
      );
    }

    return this.normalizeStatus(json["status"] as string | undefined);
  }

  /** Fetches the current WhatsApp approval status for a given Content SID. */
  async fetchApprovalStatus(
    contentSid: string,
  ): Promise<TwilioTemplateApproval> {
    const res = await fetch(
      `${CONTENT_API_BASE}/${encodeURIComponent(contentSid)}/ApprovalRequests`,
      {
        headers: { Authorization: this.authHeader() },
      },
    );

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      this.logger.warn(
        `Twilio approval fetch failed: ${res.status} ${JSON.stringify(json)}`,
      );
      return { contentSid, approvalStatus: "unknown" };
    }

    const whatsapp = (
      json["whatsapp"] as Record<string, unknown> | undefined
    );
    return {
      contentSid,
      approvalStatus: this.normalizeStatus(
        whatsapp?.["status"] as string | undefined,
      ),
      rejectionReason:
        typeof whatsapp?.["rejection_reason"] === "string" &&
        whatsapp["rejection_reason"]
          ? whatsapp["rejection_reason"]
          : undefined,
    };
  }

  /**
   * Permanently deletes a Content Template from Twilio. This is irreversible — any future
   * sends referencing the deleted ContentSid will fail. Callers should deactivate the DB
   * row before or after calling this.
   */
  async delete(contentSid: string): Promise<void> {
    const res = await fetch(
      `${CONTENT_API_BASE}/${encodeURIComponent(contentSid)}`,
      {
        method: "DELETE",
        headers: { Authorization: this.authHeader() },
      },
    );

    if (!res.ok && res.status !== 404) {
      const json = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      this.logger.warn(
        `Twilio Content API delete failed: ${res.status} ${JSON.stringify(json)}`,
      );
      throw new TwilioSendError(
        `Failed to delete Twilio template: ${(json["message"] as string) ?? res.status}`,
        res.status >= 500 ? 502 : 400,
      );
    }
  }

  private normalizeStatus(raw: string | undefined): TwilioApprovalStatus {
    switch (raw?.toLowerCase()) {
      case "approved":
        return "approved";
      case "pending":
        return "pending";
      case "received":
        return "received";
      case "rejected":
        return "rejected";
      default:
        return "unknown";
    }
  }
}
