import { ConfigService } from "@nestjs/config";
import {
  mapTwilioSendStatus,
  TwilioCardShareProvider,
} from "./twilio-card-share.provider";
import { TwilioSendError } from "../twilio-otp/twilio-error-mapping";

const baseEnv: Record<string, string> = {
  TWILIO_ACCOUNT_SID: "AC123",
  TWILIO_AUTH_TOKEN: "secret",
  TWILIO_WHATSAPP_FROM: "+15005550006",
  APP_PUBLIC_URL: "https://api.example.com/",
};

function createProvider(env: Record<string, string | undefined> = baseEnv) {
  const config = { get: (key: string) => env[key] } as ConfigService;
  return new TwilioCardShareProvider(config);
}

describe("mapTwilioSendStatus", () => {
  it("maps queued/accepted/sending/sent to sent", () => {
    for (const raw of ["queued", "accepted", "sending", "sent", "unknown"]) {
      expect(mapTwilioSendStatus(raw)).toBe("sent");
    }
  });

  it("maps delivered and read directly", () => {
    expect(mapTwilioSendStatus("delivered")).toBe("delivered");
    expect(mapTwilioSendStatus("read")).toBe("read");
  });

  it("maps undelivered/failed/canceled to failed", () => {
    expect(mapTwilioSendStatus("undelivered")).toBe("failed");
    expect(mapTwilioSendStatus("failed")).toBe("failed");
    expect(mapTwilioSendStatus("canceled")).toBe("failed");
  });
});

describe("TwilioCardShareProvider", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("reports unconfigured when required env vars are missing", () => {
    expect(createProvider({}).isConfigured()).toBe(false);
    expect(createProvider(baseEnv).isConfigured()).toBe(true);
  });

  it("posts ContentVariables 1-4 and a StatusCallback built from APP_PUBLIC_URL", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sid: "SM123", status: "queued" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = createProvider();
    const result = await provider.send({
      toE164: "+919876543210",
      contentSid: "HXabc",
      senderDisplayName: "Ada Lovelace",
      cardName: "Business Card",
      note: "Great meeting you!",
      vcardObjectKey: "card-1/hash.vcf",
    });

    expect(result).toEqual({ providerMessageId: "SM123", status: "sent" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = init.body as URLSearchParams;
    expect(body.get("To")).toBe("whatsapp:+919876543210");
    expect(body.get("ContentSid")).toBe("HXabc");
    expect(JSON.parse(body.get("ContentVariables") ?? "{}")).toEqual({
      "1": "Ada Lovelace",
      "2": "Business Card",
      "3": "Great meeting you!",
      "4": "card-1/hash.vcf",
    });
    expect(body.get("StatusCallback")).toBe(
      "https://api.example.com/api/v1/webhooks/twilio/status",
    );
  });

  it("defaults the note ContentVariable to a single space when absent (WhatsApp rejects empty-string variables, Twilio error 21656)", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sid: "SM1", status: "queued" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await createProvider().send({
      toE164: "+919876543210",
      contentSid: "HXabc",
      senderDisplayName: "Ada",
      cardName: "Card",
      note: null,
      vcardObjectKey: "x.vcf",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = init.body as URLSearchParams;
    expect(JSON.parse(body.get("ContentVariables") ?? "{}")["3"]).toBe(" ");
  });

  it("also falls back to a single space when note is a blank/whitespace-only string", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sid: "SM1", status: "queued" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await createProvider().send({
      toE164: "+919876543210",
      contentSid: "HXabc",
      senderDisplayName: "Ada",
      cardName: "Card",
      note: "   ",
      vcardObjectKey: "x.vcf",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = init.body as URLSearchParams;
    expect(JSON.parse(body.get("ContentVariables") ?? "{}")["3"]).toBe(" ");
  });

  it("throws TwilioSendError(503) without calling fetch when unconfigured", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      createProvider({}).send({
        toE164: "+919876543210",
        contentSid: "HXabc",
        senderDisplayName: "Ada",
        cardName: "Card",
        note: null,
        vcardObjectKey: "x.vcf",
      }),
    ).rejects.toMatchObject({ httpStatus: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps a Twilio 4xx error code to a client-safe 400", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ code: 63003, message: "not on WhatsApp" }),
    }) as unknown as typeof fetch;

    await expect(
      createProvider().send({
        toE164: "+919876543210",
        contentSid: "HXabc",
        senderDisplayName: "Ada",
        cardName: "Card",
        note: null,
        vcardObjectKey: "x.vcf",
      }),
    ).rejects.toMatchObject({
      httpStatus: 400,
      twilioCode: 63003,
    });
  });

  it("wraps a network failure as a 502 TwilioSendError", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("timeout")) as unknown as typeof fetch;

    await expect(
      createProvider().send({
        toE164: "+919876543210",
        contentSid: "HXabc",
        senderDisplayName: "Ada",
        cardName: "Card",
        note: null,
        vcardObjectKey: "x.vcf",
      }),
    ).rejects.toBeInstanceOf(TwilioSendError);
  });
});
