import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { mockJwtGuard } from "../../test/helpers/mock-jwt.guard";
import { applyApiTestConfig } from "../../test/helpers/supertest-app";
import { AppModule } from "../app.module";
import { GroupsService } from "./groups.service";
import { ContactsService } from "../contacts/contacts.service";
import { ContactsSyncService } from "../contacts/contacts-sync.service";
import { VcardContactsImportService } from "../contacts/vcard-contacts-import.service";
import { OAuthTokenService } from "../oauth-tokens/oauth-token.service";
import { TagsService } from "../tags/tags.service";

describe("GET /api/v1/contacts/groups route resolution", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtGuard)
      .overrideProvider(GroupsService)
      .useValue({
        list: jest
          .fn()
          .mockResolvedValue([
            { id: "11111111-1111-4111-8111-111111111111", name: "Work" },
          ]),
      })
      .overrideProvider(ContactsService)
      .useValue({
        listPaginated: jest.fn(),
        get: jest.fn(),
      })
      .overrideProvider(ContactsSyncService)
      .useValue({ import: jest.fn(), sync: jest.fn() })
      .overrideProvider(VcardContactsImportService)
      .useValue({ importFromFile: jest.fn() })
      .overrideProvider(OAuthTokenService)
      .useValue({ upsertForUser: jest.fn() })
      .overrideProvider(TagsService)
      .useValue({ list: jest.fn().mockResolvedValue([]) })
      .compile();

    app = moduleRef.createNestApplication();
    applyApiTestConfig(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns groups list instead of UUID validation error", async () => {
    const res = await request(app.getHttpServer()).get(
      "/api/v1/contacts/groups",
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Work",
        source: null,
        externalId: null,
      },
    ]);
  });

  it("returns tags list instead of UUID validation error", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/contacts/tags");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
