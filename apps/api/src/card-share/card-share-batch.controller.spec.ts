import { HttpStatus, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { mockJwtGuard, testJwtUser } from "../../test/helpers/mock-jwt.guard";
import { applyApiTestConfig } from "../../test/helpers/supertest-app";
import { CardShareBatchController } from "./card-share-batch.controller";
import { CardShareService } from "./card-share.service";

const BATCH_ID = "11111111-1111-4111-8111-111111111111";
const RECIPIENT_ID = "22222222-2222-4222-8222-222222222222";

describe("CardShareBatchController (HTTP)", () => {
  let app: INestApplication;
  let cardShare: { getBatch: jest.Mock; resendRecipient: jest.Mock };

  beforeEach(async () => {
    cardShare = {
      getBatch: jest.fn().mockResolvedValue({ id: BATCH_ID }),
      resendRecipient: jest.fn().mockResolvedValue({ id: RECIPIENT_ID }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [CardShareBatchController],
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

  it("GET /card-shares/:batchId delegates to the service with the current user", async () => {
    await request(app.getHttpServer() as never)
      .get(`/api/v1/card-shares/${BATCH_ID}`)
      .expect(HttpStatus.OK);
    expect(cardShare.getBatch).toHaveBeenCalledWith(testJwtUser.sub, BATCH_ID);
  });

  it("GET /card-shares/:batchId rejects a non-UUID batchId", async () => {
    await request(app.getHttpServer() as never)
      .get("/api/v1/card-shares/not-a-uuid")
      .expect(HttpStatus.BAD_REQUEST);
    expect(cardShare.getBatch).not.toHaveBeenCalled();
  });

  it("POST /card-shares/:batchId/recipients/:recipientId/resend delegates to the service", async () => {
    await request(app.getHttpServer() as never)
      .post(`/api/v1/card-shares/${BATCH_ID}/recipients/${RECIPIENT_ID}/resend`)
      .expect(HttpStatus.CREATED);
    expect(cardShare.resendRecipient).toHaveBeenCalledWith(
      testJwtUser.sub,
      BATCH_ID,
      RECIPIENT_ID,
    );
  });
});
