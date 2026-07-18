import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Transport-level failure talking to Twilio. `httpStatus` is the status the API
 * should surface to the caller (already mapped from the Twilio error code), and
 * `twilioCode` is Twilio's numeric error code when one was returned.
 * See https://www.twilio.com/docs/api/errors for code meanings.
 */
export class TwilioSendError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly twilioCode: number | null = null,
    readonly moreInfo?: string,
  ) {
    super(message);
    this.name = "TwilioSendError";
  }
}

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

/**
 * Twilio error codes that mean the request/recipient is at fault (bad number,
 * not a WhatsApp user, unverified trial recipient, opted out). These map to a
 * 4xx so the client can correct them; everything else is treated as an upstream
 * failure (502/503) since it is our configuration or Twilio's availability.
 */
const CLIENT_ERROR_TWILIO_CODES = new Set<number>([
  21211, // Invalid 'To' phone number
  21408, // Permission to send to this region not enabled
  21608, // Recipient not verified (trial account)
  21610, // Recipient has opted out / unsubscribed
  21614, // 'To' number is not a valid mobile number
  63003, // Channel could not find the 'To' address (not on WhatsApp)
  63013, // Message blocked by WhatsApp policy
  63024, // Invalid message recipient
]);

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

/** Maps a Twilio HTTP status + error code to the status we surface to callers. */
function mapHttpStatus(httpStatus: number, twilioCode: number | null): number {
  if (twilioCode !== null && CLIENT_ERROR_TWILIO_CODES.has(twilioCode)) {
    return 400;
  }
  // 401/403 mean OUR credentials/permissions are wrong — never blame the client.
  if (httpStatus === 401 || httpStatus === 403) {
    return 502;
  }
  return 502;
}

/** Client-safe message; hides internal detail for non-client errors. */
function mapClientMessage(twilioCode: number | null): string {
  if (twilioCode !== null && CLIENT_ERROR_TWILIO_CODES.has(twilioCode)) {
    return "This number can't receive a WhatsApp verification code. Check the number and try again.";
  }
  return "Could not send the verification code. Please try again shortly.";
}
