import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { WhatsappMessagingService } from "../messaging/whatsapp-messaging.service";

describe("HealthController", () => {
  let controller: HealthController;
  const messaging = { getReadiness: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: WhatsappMessagingService, useValue: messaging }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it("returns ok when OpenWA is ready", async () => {
    messaging.getReadiness.mockResolvedValue({ ready: true, status: "ready" });
    const result = await controller.getHealth();
    expect(result.status).toBe("ok");
    expect(result.whatsapp).toEqual({ ready: true, status: "ready" });
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns degraded when OpenWA is unavailable", async () => {
    messaging.getReadiness.mockResolvedValue({
      ready: false,
      status: "unavailable",
    });
    await expect(controller.getHealth()).resolves.toMatchObject({
      status: "degraded",
      whatsapp: { ready: false, status: "unavailable" },
    });
  });
});
