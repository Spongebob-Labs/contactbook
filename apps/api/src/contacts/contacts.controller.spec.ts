import {
  HttpStatus,
  INestApplication,
  NotImplementedException,
} from "@nestjs/common";
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
import { VcardContactsImportService } from "./vcard-contacts-import.service";

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

  beforeEach(async () => {
    contactsSync = {
      import: jest.fn().mockResolvedValue(importResult),
      sync: jest.fn(),
    };
    contacts = {
      listPaginated: jest.fn(),
      get: jest.fn(),
    };
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [ContactsController],
      providers: [
        { provide: ContactsService, useValue: contacts },
        { provide: ContactsSyncService, useValue: contactsSync },
        VcardContactsImportService,
        { provide: PrismaService, useValue: prisma },
        { provide: ContactUpsertService, useValue: contactUpsert },
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
    expect(res.body.completedAt).toBeDefined();
  });

  it("POST /contacts/import/icloud returns 501", async () => {
    contactsSync.import.mockRejectedValue(
      new NotImplementedException("iCloud not ready"),
    );
    await request(app.getHttpServer() as never)
      .post("/api/v1/contacts/import/icloud")
      .expect(HttpStatus.NOT_IMPLEMENTED);
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
    expect(res.body.completedAt).toBeDefined();
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
