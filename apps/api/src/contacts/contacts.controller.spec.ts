import { HttpStatus, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { mockJwtGuard } from "../../test/helpers/mock-jwt.guard";
import { applyApiTestConfig } from "../../test/helpers/supertest-app";
import { TEST_USER_ID } from "../../test/fixtures/profile-payloads";
import { PrismaService } from "../prisma/prisma.service";
import { ContactUpsertService } from "./contact-upsert.service";
import { ContactsController } from "./contacts.controller";
import { ContactsService } from "./contacts.service";
import { ContactsSyncService } from "./contacts-sync.service";
import { ContactLabelsService } from "./contact-labels.service";
import { VcardContactsImportService } from "./vcard-contacts-import.service";
import { OAuthTokenService } from "../oauth-tokens/oauth-token.service";

const importResult = {
  completedAt: new Date("2026-05-22T12:00:00.000Z"),
  created: 1,
  updated: 0,
  skipped: [],
};

describe("ContactsController (HTTP)", () => {
  let app: INestApplication;
  let contactsSync: { import: jest.Mock; sync: jest.Mock };
  let contacts: { listPaginated: jest.Mock; get: jest.Mock };
  let oauthTokenService: { upsertForUser: jest.Mock };
  const prisma = {
    integrationState: { upsert: jest.fn().mockResolvedValue({}) },
  };
  const contactUpsert = {
    upsertBatch: jest.fn().mockResolvedValue({
      added: 1,
      updated: 0,
      deleted: 0,
      duplicatesFound: 0,
    }),
  };
  const contactLabels = {
    applyVcfCategories: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    contactsSync = {
      import: jest.fn().mockResolvedValue(importResult),
      sync: jest.fn(),
    };
    contacts = {
      listPaginated: jest.fn(),
      get: jest.fn(),
    };
    oauthTokenService = {
      upsertForUser: jest.fn().mockResolvedValue({}),
    };
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [ContactsController],
      providers: [
        { provide: ContactsService, useValue: contacts },
        { provide: ContactsSyncService, useValue: contactsSync },
        VcardContactsImportService,
        { provide: OAuthTokenService, useValue: oauthTokenService },
        { provide: PrismaService, useValue: prisma },
        { provide: ContactUpsertService, useValue: contactUpsert },
        { provide: ContactLabelsService, useValue: contactLabels },
      ],
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

  it("GET /contacts/import/google returns import result", async () => {
    const res = await request(app.getHttpServer() as never)
      .get("/api/v1/contacts/import/google")
      .expect(HttpStatus.OK);

    expect(contactsSync.import).toHaveBeenCalledWith(TEST_USER_ID, "GOOGLE");
    expect(res.body).toMatchObject({
      created: 1,
      updated: 0,
      skipped: [],
    });
    expect((res.body as Record<string, unknown>).completedAt).toBeDefined();
  });

  it("POST /contacts/import/icloud stores credentials and imports contacts", async () => {
    const res = await request(app.getHttpServer() as never)
      .post("/api/v1/contacts/import/icloud")
      .send({
        appleId: "user@icloud.com",
        appSpecificPassword: "abcd-efgh-ijkl-mnop",
      })
      .expect(HttpStatus.CREATED);

    expect(oauthTokenService.upsertForUser).toHaveBeenCalledWith(
      TEST_USER_ID,
      "icloud",
      {
        accessToken: "user@icloud.com",
        refreshToken: "abcd-efgh-ijkl-mnop",
      },
    );
    expect(contactsSync.import).toHaveBeenCalledWith(TEST_USER_ID, "ICLOUD");
    expect(res.body).toMatchObject({
      created: 1,
      updated: 0,
      skipped: [],
    });
  });

  it("POST /contacts/import/icloud rejects invalid payload", async () => {
    await request(app.getHttpServer() as never)
      .post("/api/v1/contacts/import/icloud")
      .send({ appleId: "not-an-email" })
      .expect(HttpStatus.BAD_REQUEST);

    expect(oauthTokenService.upsertForUser).not.toHaveBeenCalled();
    expect(contactsSync.import).not.toHaveBeenCalled();
  });

  it("POST /contacts/import/vcf accepts multipart file", async () => {
    const vcfBody = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "UID:ctrl-1",
      "FN:Controller Test",
      "TEL:+15550001111",
      "END:VCARD",
    ].join("\r\n");

    const res = await request(app.getHttpServer() as never)
      .post("/api/v1/contacts/import/vcf")
      .attach("file", Buffer.from(vcfBody, "utf8"), {
        filename: "contacts.vcf",
        contentType: "text/vcard",
      })
      .expect(HttpStatus.CREATED);

    expect(contactUpsert.upsertBatch).toHaveBeenCalled();
    expect(res.body).toMatchObject({
      created: 1,
      updated: 0,
      skipped: [],
    });
    expect((res.body as Record<string, unknown>).completedAt).toBeDefined();
  });

  it("POST /contacts/import/vcf without file returns 400", async () => {
    await request(app.getHttpServer() as never)
      .post("/api/v1/contacts/import/vcf")
      .expect(HttpStatus.BAD_REQUEST);
    expect(contactUpsert.upsertBatch).not.toHaveBeenCalled();
  });

  it("legacy GET /contacts/import?source=GOOGLE is removed", async () => {
    await request(app.getHttpServer() as never)
      .get("/api/v1/contacts/import")
      .query({ source: "GOOGLE" })
      .expect(HttpStatus.BAD_REQUEST);
  });
});
