import { HttpStatus, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { WhatsappTemplateUseCase } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { mockJwtGuard } from "../../test/helpers/mock-jwt.guard";
import { applyApiTestConfig } from "../../test/helpers/supertest-app";
import { WhatsappTemplateController } from "./whatsapp-template.controller";
import { WhatsappTemplateService } from "./whatsapp-template.service";

describe("WhatsappTemplateController (HTTP)", () => {
  let app: INestApplication;
  let templates: { listAll: jest.Mock };

  beforeEach(async () => {
    templates = { listAll: jest.fn().mockResolvedValue([]) };

    const moduleRef = await Test.createTestingModule({
      controllers: [WhatsappTemplateController],
      providers: [{ provide: WhatsappTemplateService, useValue: templates }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtGuard)
      .compile();

    app = moduleRef.createNestApplication();
    applyApiTestConfig(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /whatsapp-templates defaults useCase to CARD_SHARE", async () => {
    await request(app.getHttpServer() as never)
      .get("/api/v1/whatsapp-templates")
      .expect(HttpStatus.OK);
    expect(templates.listAll).toHaveBeenCalledWith(
      WhatsappTemplateUseCase.CARD_SHARE,
    );
  });

  it("GET /whatsapp-templates?useCase=OTP passes through an explicit use case", async () => {
    await request(app.getHttpServer() as never)
      .get("/api/v1/whatsapp-templates?useCase=OTP")
      .expect(HttpStatus.OK);
    expect(templates.listAll).toHaveBeenCalledWith(
      WhatsappTemplateUseCase.OTP,
    );
  });

  it("GET /whatsapp-templates?useCase=BOGUS is rejected by validation", async () => {
    await request(app.getHttpServer() as never)
      .get("/api/v1/whatsapp-templates?useCase=BOGUS")
      .expect(HttpStatus.BAD_REQUEST);
    expect(templates.listAll).not.toHaveBeenCalled();
  });
});
