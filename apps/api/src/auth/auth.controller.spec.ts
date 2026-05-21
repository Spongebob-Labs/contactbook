import { HttpStatus, INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { applyApiTestConfig } from "../../test/helpers/supertest-app";
import {
  invalidWhatsappRequest,
  validWhatsappRequest,
} from "../../test/fixtures/profile-payloads";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

describe("AuthController (HTTP)", () => {
  let app: INestApplication;
  let auth: {
    requestWhatsappCode: jest.Mock;
    verifyWhatsappCode: jest.Mock;
    completeRegister: jest.Mock;
  };

  beforeEach(async () => {
    auth = {
      requestWhatsappCode: jest.fn().mockResolvedValue({ message: "sent" }),
      verifyWhatsappCode: jest.fn().mockResolvedValue({
        registered: false,
        message: "ok",
        phoneVerificationToken: "t",
      }),
      completeRegister: jest.fn().mockResolvedValue({
        accessToken: "a",
        refreshToken: "r",
        userId: "u",
      }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: string) => {
              if (key === "NODE_ENV") {
                return "test";
              }
              return def ?? "";
            }),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    applyApiTestConfig(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("POST /auth/whatsapp/request-code accepts valid payload", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/whatsapp/request-code")
      .send(validWhatsappRequest)
      .expect(HttpStatus.CREATED);
    expect(auth.requestWhatsappCode).toHaveBeenCalledWith(
      validWhatsappRequest.phone,
      validWhatsappRequest.countryCode,
    );
  });

  it("POST /auth/whatsapp/request-code rejects invalid phone", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/whatsapp/request-code")
      .send(invalidWhatsappRequest)
      .expect(HttpStatus.BAD_REQUEST);
    expect(auth.requestWhatsappCode).not.toHaveBeenCalled();
  });

  it("POST /auth/whatsapp/verify-code rejects missing code", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/whatsapp/verify-code")
      .send({ phone: "5551234567", countryCode: "+1" })
      .expect(HttpStatus.BAD_REQUEST);
    expect(auth.verifyWhatsappCode).not.toHaveBeenCalled();
  });

  it("POST /auth/whatsapp/verify-code returns isOnboarded false when registered", async () => {
    auth.verifyWhatsappCode.mockResolvedValue({
      registered: true,
      isOnboarded: false,
      userId: "user-1",
      accessToken: "access",
      refreshToken: "refresh",
    });
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/whatsapp/verify-code")
      .send({ phone: "5551234567", countryCode: "+1", code: "123456" })
      .expect(HttpStatus.CREATED);
    expect(res.body).toEqual({ registered: true, isOnboarded: false });
  });

  it("POST /auth/whatsapp/verify-code returns isOnboarded true when registered", async () => {
    auth.verifyWhatsappCode.mockResolvedValue({
      registered: true,
      isOnboarded: true,
      userId: "user-1",
      accessToken: "access",
      refreshToken: "refresh",
    });
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/whatsapp/verify-code")
      .send({ phone: "5551234567", countryCode: "+1", code: "123456" })
      .expect(HttpStatus.CREATED);
    expect(res.body).toEqual({ registered: true, isOnboarded: true });
  });

  it("POST /auth/register rejects invalid email", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        phoneVerificationToken: "token",
        firstName: "Jane",
        lastName: "Doe",
        email: "not-an-email",
        phone: "5551234567",
        countryCode: "+1",
      })
      .expect(HttpStatus.BAD_REQUEST);
    expect(auth.completeRegister).not.toHaveBeenCalled();
  });
});
