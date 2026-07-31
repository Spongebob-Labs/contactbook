import { HttpStatus, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { mockJwtGuard, testJwtUser } from "../../test/helpers/mock-jwt.guard";
import { applyApiTestConfig } from "../../test/helpers/supertest-app";
import { CardShareController } from "./card-share.controller";
import { CardShareService } from "./card-share.service";

const CARD_ID = "11111111-1111-4111-8111-111111111111";

describe("CardShareController (HTTP)", () => {
  let app: INestApplication;
  let cardShare: {
    createBatch: jest.Mock;
    listBatchesForCard: jest.Mock;
  };

  beforeEach(async () => {
    cardShare = {
      createBatch: jest.fn().mockResolvedValue({ id: "batch-1" }),
      listBatchesForCard: jest.fn().mockResolvedValue({
        items: [],
        page: 1,
        limit: 25,
        total: 0,
        totalPages: 0,
      }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [CardShareController],
      providers: [{ provide: CardShareService, useValue: cardShare }],
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

  it("POST /cards/:cardId/share accepts a valid payload and delegates to the service", async () => {
    const body = {
      recipients: [{ countryCode: "+1", phone: "4155551234" }],
    };
    await request(app.getHttpServer() as never)
      .post(`/api/v1/cards/${CARD_ID}/share`)
      .send(body)
      .expect(HttpStatus.CREATED);

    expect(cardShare.createBatch).toHaveBeenCalledWith(
      testJwtUser.sub,
      CARD_ID,
      body,
    );
  });

  it("POST /cards/:cardId/share rejects a non-UUID cardId", async () => {
    await request(app.getHttpServer() as never)
      .post("/api/v1/cards/not-a-uuid/share")
      .send({ recipients: [{ countryCode: "+1", phone: "4155551234" }] })
      .expect(HttpStatus.BAD_REQUEST);
    expect(cardShare.createBatch).not.toHaveBeenCalled();
  });

  it("POST /cards/:cardId/share rejects an empty recipients array", async () => {
    await request(app.getHttpServer() as never)
      .post(`/api/v1/cards/${CARD_ID}/share`)
      .send({ recipients: [] })
      .expect(HttpStatus.BAD_REQUEST);
    expect(cardShare.createBatch).not.toHaveBeenCalled();
  });

  it("POST /cards/:cardId/share rejects more than 50 recipients", async () => {
    const recipients = Array.from({ length: 51 }, (_, i) => ({
      countryCode: "+1",
      phone: `555000${i}`,
    }));
    await request(app.getHttpServer() as never)
      .post(`/api/v1/cards/${CARD_ID}/share`)
      .send({ recipients })
      .expect(HttpStatus.BAD_REQUEST);
    expect(cardShare.createBatch).not.toHaveBeenCalled();
  });

  it("POST /cards/:cardId/share rejects unknown extra fields (forbidNonWhitelisted)", async () => {
    await request(app.getHttpServer() as never)
      .post(`/api/v1/cards/${CARD_ID}/share`)
      .send({
        recipients: [{ countryCode: "+1", phone: "4155551234" }],
        notAField: true,
      })
      .expect(HttpStatus.BAD_REQUEST);
    expect(cardShare.createBatch).not.toHaveBeenCalled();
  });

  it("GET /cards/:cardId/shares delegates to the service with the current user", async () => {
    await request(app.getHttpServer() as never)
      .get(`/api/v1/cards/${CARD_ID}/shares`)
      .expect(HttpStatus.OK);
    expect(cardShare.listBatchesForCard).toHaveBeenCalledWith(
      testJwtUser.sub,
      CARD_ID,
      expect.objectContaining({ page: 1, limit: 25 }) as unknown,
    );
  });
});
