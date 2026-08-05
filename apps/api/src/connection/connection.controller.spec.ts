import { HttpStatus, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { mockJwtGuard } from "../../test/helpers/mock-jwt.guard";
import { applyApiTestConfig } from "../../test/helpers/supertest-app";
import {
  invalidConnectionRequest,
  TEST_USER_ID,
  validConnectionRequest,
} from "../../test/fixtures/profile-payloads";
import { ConnectionController } from "./connection.controller";
import { ConnectionService } from "./connection.service";

describe("ConnectionController (HTTP)", () => {
  let app: INestApplication;
  let connections: { createRequest: jest.Mock; resendRequest: jest.Mock };

  beforeEach(async () => {
    connections = {
      createRequest: jest.fn().mockResolvedValue({
        type: "connection",
        connection: {
          id: "conn-1",
          status: "PENDING",
          requesterId: TEST_USER_ID,
          receiverId: "other-user",
          requesterSharedCardId: null,
          receiverSharedCardId: null,
          hasSharedBack: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        delivery: {
          ledgerId: "ledger-1",
          providerMessageId: "wa-1",
          status: "sent",
        },
      }),
      resendRequest: jest.fn().mockResolvedValue({
        ledgerId: "ledger-2",
        providerMessageId: "wa-2",
        status: "delivered",
      }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ConnectionController],
      providers: [{ provide: ConnectionService, useValue: connections }],
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

  it("POST /connections/requests accepts valid payload", async () => {
    const res = await request(app.getHttpServer() as never)
      .post("/api/v1/connections/requests")
      .send(validConnectionRequest)
      .expect(HttpStatus.CREATED);
    expect(connections.createRequest).toHaveBeenCalledWith(
      TEST_USER_ID,
      validConnectionRequest,
    );
    expect((res.body as Record<string, unknown>).type).toBe("connection");
    expect(
      (res.body as { delivery: { providerMessageId: string } }).delivery
        .providerMessageId,
    ).toBe("wa-1");
  });

  it("POST /connections/requests/:id/resend uses the authenticated requester", async () => {
    await request(app.getHttpServer() as never)
      .post("/api/v1/connections/requests/conn-1/resend")
      .expect(HttpStatus.CREATED);
    expect(connections.resendRequest).toHaveBeenCalledWith(
      TEST_USER_ID,
      "conn-1",
    );
  });

  it("POST /connections/requests rejects invalid recipientPhone", async () => {
    await request(app.getHttpServer() as never)
      .post("/api/v1/connections/requests")
      .send(invalidConnectionRequest)
      .expect(HttpStatus.BAD_REQUEST);
    expect(connections.createRequest).not.toHaveBeenCalled();
  });
});
