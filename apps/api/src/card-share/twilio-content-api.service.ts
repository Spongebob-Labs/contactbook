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
  /** Optional static image URL baked into the template header (not a per-send variable). */
  headerImageUrl?: string;
};

export type TwilioTemplateApproval = {
  contentSid: string;
  approvalStatus: TwilioApprovalStatus;
  rejectionReason?: string;
};

/** The actual template definition as it exists on Twilio right now. */
export type TwilioContentDefinition = {
  contentSid: string;
  /** false when the ContentSid no longer exists on Twilio (deleted). */
  exists: boolean;
  body?: string;
  buttonTitle?: string;
  /** Full URL on the template's URL button, including the baked-in base + {{4}}. */
  buttonUrl?: string;
  headerImageUrl?: string;
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

  /** Public: the sync service compares template button URLs against this base. */
  get vcardBaseUrl(): string {
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

    // twilio/call-to-action supports body + URL button but has NO image header support.
    // whatsapp/card supports body + media (image banner) + URL button — use it when
    // a headerImageUrl is provided, otherwise stick with the simpler CTA type.
    const templateType = input.headerImageUrl
      ? "whatsapp/card"
      : "twilio/call-to-action";
    const typePayload = input.headerImageUrl
      ? {
          body: input.body,
          media: [input.headerImageUrl],
          actions: [
            { type: "URL", title: input.buttonTitle, url: `${baseUrl}/{{4}}` },
          ],
        }
      : {
          body: input.body,
          actions: [
            { type: "URL", title: input.buttonTitle, url: `${baseUrl}/{{4}}` },
          ],
        };

    const payload = {
      friendly_name: input.name,
      language: "en",
      variables: {
        "1": "Ada Lovelace",
        "2": "Business Card",
        "3": " Great meeting you!",
        "4": "sample/contact.vcf",
      },
      types: { [templateType]: typePayload },
    };

    const res = await fetch(CONTENT_API_BASE, {
      method: "POST",
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
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

    const json = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
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

  /**
   * Fetches the live template definition from Twilio, for drift detection against our
   * DB mirror. Returns exists: false on 404 (template deleted on Twilio); throws on
   * other failures (network, auth) so callers can distinguish "gone" from "unknown".
   */
  async fetchContent(contentSid: string): Promise<TwilioContentDefinition> {
    const res = await fetch(
      `${CONTENT_API_BASE}/${encodeURIComponent(contentSid)}`,
      {
        headers: { Authorization: this.authHeader() },
      },
    );

    if (res.status === 404) {
      return { contentSid, exists: false };
    }

    const json = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!res.ok) {
      this.logger.warn(
        `Twilio Content API fetch failed: ${res.status} ${JSON.stringify(json)}`,
      );
      throw new TwilioSendError(
        `Failed to fetch Twilio template: ${(json["message"] as string) ?? res.status}`,
        res.status >= 500 ? 502 : 400,
      );
    }

    // Prefer the two types create() can produce; fall back to whatever type the
    // template has (e.g. whatsapp/authentication for OTP) — body/actions/media are
    // read generically so any registered template can be mirrored.
    const types = (json["types"] ?? {}) as Record<string, unknown>;
    const card = types["whatsapp/card"] as Record<string, unknown> | undefined;
    const cta = types["twilio/call-to-action"] as
      | Record<string, unknown>
      | undefined;
    const firstType = Object.values(types)[0] as
      | Record<string, unknown>
      | undefined;
    const definition = card ?? cta ?? firstType;
    if (!definition) {
      throw new TwilioSendError(
        `Twilio template ${contentSid} has no content types`,
        400,
      );
    }

    const actions = (definition["actions"] ?? []) as Array<
      Record<string, unknown>
    >;
    const urlAction = actions.find(
      (a) => typeof a["type"] === "string" && a["type"].toUpperCase() === "URL",
    );
    const media = (card?.["media"] ?? []) as unknown[];

    return {
      contentSid,
      exists: true,
      body: definition["body"] as string | undefined,
      buttonTitle: urlAction?.["title"] as string | undefined,
      buttonUrl: urlAction?.["url"] as string | undefined,
      headerImageUrl: typeof media[0] === "string" ? media[0] : undefined,
    };
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

    const json = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!res.ok) {
      this.logger.warn(
        `Twilio approval fetch failed: ${res.status} ${JSON.stringify(json)}`,
      );
      return { contentSid, approvalStatus: "unknown" };
    }

    const whatsapp = json["whatsapp"] as Record<string, unknown> | undefined;
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
