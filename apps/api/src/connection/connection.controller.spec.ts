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
  let connections: { createRequest: jest.Mock };

  beforeEach(async () => {
    connections = {
      createRequest: jest.fn().mockResolvedValue({
        id: "conn-1",
        status: "PENDING",
        requesterId: TEST_USER_ID,
        receiverId: "other-user",
        sharedCardId: validConnectionRequest.sharedCardId,
        hasSharedBack: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
    await request(app.getHttpServer())
      .post("/api/v1/connections/requests")
      .send(validConnectionRequest)
      .expect(HttpStatus.CREATED);
    expect(connections.createRequest).toHaveBeenCalledWith(
      TEST_USER_ID,
      validConnectionRequest,
    );
  });

  it("POST /connections/requests rejects invalid recipientPhone", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/connections/requests")
      .send(invalidConnectionRequest)
      .expect(HttpStatus.BAD_REQUEST);
    expect(connections.createRequest).not.toHaveBeenCalled();
  });
});
