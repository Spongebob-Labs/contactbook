import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CLIENT_ERROR_TWILIO_CODES,
  mapHttpStatus,
  TwilioSendError,
} from "./twilio-error-mapping";

export { TwilioSendError };

export interface TwilioMessageResult {
  sid: string;
  status: string;
}

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  /** Normalized `whatsapp:+<e164>` sender. */
  whatsappFrom: string;
  /** Approved WhatsApp Authentication template SID (HX…). */
  otpContentSid: string;
}

const MESSAGES_ENDPOINT = (accountSid: string) =>
  `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
    accountSid,
  )}/Messages.json`;

@Injectable()
export class TwilioOtpClient {
  private readonly logger = new Logger(TwilioOtpClient.name);

  constructor(private readonly config: ConfigService) {}

  /** True when all required Twilio env vars are present. */
  isConfigured(): boolean {
    return this.readConfig() !== null;
  }

  /**
   * Sends the OTP through the approved WhatsApp Authentication template.
   * The code is injected as template variable `{{1}}`.
   * @throws TwilioSendError on misconfiguration or an upstream failure.
   */
  async sendOtpTemplate(
    toE164: string,
    code: string,
  ): Promise<TwilioMessageResult> {
    const cfg = this.readConfigOrThrow();
    const body = new URLSearchParams({
      To: `whatsapp:${toE164}`,
      From: cfg.whatsappFrom,
      ContentSid: cfg.otpContentSid,
      ContentVariables: JSON.stringify({ "1": code }),
    });

    let res: Response;
    try {
      res = await fetch(MESSAGES_ENDPOINT(cfg.accountSid), {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${cfg.accountSid}:${cfg.authToken}`,
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal: AbortSignal.timeout(this.requestTimeoutMs()),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new TwilioSendError(`Could not reach Twilio: ${reason}`, 502);
    }

    const payload = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!res.ok) {
      const twilioCode =
        typeof payload["code"] === "number" ? payload["code"] : null;
      const message =
        typeof payload["message"] === "string"
          ? payload["message"]
          : `Twilio returned HTTP ${res.status}`;
      const moreInfo =
        typeof payload["more_info"] === "string"
          ? payload["more_info"]
          : undefined;
      // Log the technical detail server-side; the client gets a safe status.
      this.logger.warn(
        `Twilio send failed: http=${res.status} code=${twilioCode ?? "?"} message=${message}`,
      );
      throw new TwilioSendError(
        mapClientMessage(twilioCode),
        mapHttpStatus(res.status, twilioCode),
        twilioCode,
        moreInfo,
      );
    }

    return {
      sid: typeof payload["sid"] === "string" ? payload["sid"] : "",
      status:
        typeof payload["status"] === "string" ? payload["status"] : "queued",
    };
  }

  private requestTimeoutMs(): number {
    const parsed = Number(
      this.config.get<string>("TWILIO_REQUEST_TIMEOUT_MS", "10000"),
    );
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 10_000;
  }

  private readConfigOrThrow(): TwilioConfig {
    const cfg = this.readConfig();
    if (!cfg) {
      throw new TwilioSendError(
        "WhatsApp OTP is temporarily unavailable.",
        503,
      );
    }
    return cfg;
  }

  private readConfig(): TwilioConfig | null {
    const accountSid = this.config.get<string>("TWILIO_ACCOUNT_SID");
    const authToken = this.config.get<string>("TWILIO_AUTH_TOKEN");
    const whatsappFromRaw = this.config.get<string>("TWILIO_WHATSAPP_FROM");
    const otpContentSid = this.config.get<string>("TWILIO_OTP_CONTENT_SID");
    if (!accountSid || !authToken || !whatsappFromRaw || !otpContentSid) {
      return null;
    }
    const whatsappFrom = whatsappFromRaw.startsWith("whatsapp:")
      ? whatsappFromRaw
      : `whatsapp:${whatsappFromRaw}`;
    return { accountSid, authToken, whatsappFrom, otpContentSid };
  }
}

/** Client-safe message; hides internal detail for non-client errors. */
function mapClientMessage(twilioCode: number | null): string {
  if (twilioCode !== null && CLIENT_ERROR_TWILIO_CODES.has(twilioCode)) {
    return "This number can't receive a WhatsApp verification code. Check the number and try again.";
  }
  return "Could not send the verification code. Please try again shortly.";
}
