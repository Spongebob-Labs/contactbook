import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
import { createHmac } from "node:crypto";
import { WhatsappCloudController } from "./whatsapp-cloud.controller";

function hmacSign(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

const APP_SECRET = "6384b035b017d20d3dc11e567900ffad";

describe("WhatsappCloudController", () => {
  let controller: WhatsappCloudController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhatsappCloudController],
    }).compile();

    controller = module.get(WhatsappCloudController);
  });

  describe("GET /webhook (verification)", () => {
    it("returns challenge when mode=subscribe and token matches", () => {
      const result = controller.verify(
        "subscribe",
        "whatsapp-verify-4b7c1a",
        "challenge-abc",
      );
      expect(result).toBe("challenge-abc");
    });

    it("throws ForbiddenException when mode is wrong", () => {
      expect(() =>
        controller.verify("denied", "whatsapp-verify-4b7c1a", "challenge-abc"),
      ).toThrow(ForbiddenException);
    });

    it("throws ForbiddenException when token is wrong", () => {
      expect(() =>
        controller.verify("subscribe", "wrong-token", "challenge-abc"),
      ).toThrow(ForbiddenException);
    });

    it("throws ForbiddenException when token is missing", () => {
      expect(() =>
        controller.verify("subscribe", undefined, "challenge-abc"),
      ).toThrow(ForbiddenException);
    });

    it("returns empty string when challenge is missing", () => {
      const result = controller.verify(
        "subscribe",
        "whatsapp-verify-4b7c1a",
        undefined,
      );
      expect(result).toBe("");
    });
  });

  describe("POST /webhook (events)", () => {
    function makeReq(body: Record<string, unknown>) {
      const raw = Buffer.from(JSON.stringify(body));
      return { rawBody: raw, body } as never;
    }

    it("accepts valid signature with inbound message", async () => {
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "102290129340398",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "15550783881",
                    phone_number_id: "106540352242922",
                  },
                  contacts: [
                    {
                      profile: { name: "Sheena Nelson" },
                      wa_id: "16505551234",
                    },
                  ],
                  messages: [
                    {
                      from: "16505551234",
                      id: "wamid.test123",
                      timestamp: "1749416383",
                      type: "text",
                      text: { body: "Hello" },
                    },
                  ],
                },
                field: "messages",
              },
            ],
          },
        ],
      };
      const raw = JSON.stringify(payload);
      const sig = hmacSign(raw, APP_SECRET);

      const result = await controller.handleEvent(makeReq(payload), sig);
      expect(result).toEqual({ ok: true });
    });

    it("rejects invalid signature", async () => {
      const payload = { object: "whatsapp_business_account", entry: [] };

      await expect(
        controller.handleEvent(makeReq(payload), "sha256=deadbeef"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects missing signature", async () => {
      const payload = { object: "whatsapp_business_account", entry: [] };

      await expect(
        controller.handleEvent(makeReq(payload), undefined),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects missing raw body", async () => {
      const req = { rawBody: undefined, body: {} } as never;
      const sig = hmacSign("{}", APP_SECRET);

      await expect(controller.handleEvent(req, sig)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("accepts non-messages webhook (returns ok)", async () => {
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "123",
            changes: [
              {
                value: {},
                field: "account_alerts",
              },
            ],
          },
        ],
      };
      const raw = JSON.stringify(payload);
      const sig = hmacSign(raw, APP_SECRET);

      const result = await controller.handleEvent(makeReq(payload), sig);
      expect(result).toEqual({ ok: true });
    });

    it("accepts non-whatsapp_business_account object (returns ok)", async () => {
      const payload = { object: "page", entry: [] };
      const raw = JSON.stringify(payload);
      const sig = hmacSign(raw, APP_SECRET);

      const result = await controller.handleEvent(makeReq(payload), sig);
      expect(result).toEqual({ ok: true });
    });

    it("handles status updates", async () => {
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "123",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  statuses: [
                    {
                      id: "wamid.status123",
                      status: "delivered",
                      timestamp: "1749416400",
                      recipient_id: "16505551234",
                    },
                  ],
                },
                field: "messages",
              },
            ],
          },
        ],
      };
      const raw = JSON.stringify(payload);
      const sig = hmacSign(raw, APP_SECRET);

      const result = await controller.handleEvent(makeReq(payload), sig);
      expect(result).toEqual({ ok: true });
    });
  });
});
