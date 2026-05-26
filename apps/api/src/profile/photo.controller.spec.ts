import { HttpStatus, INestApplication } from "@nestjs/common";
import request from "supertest";
import { createProfileControllerTestModule } from "../../test/helpers/create-profile-test-module";
import { applyApiTestConfig } from "../../test/helpers/supertest-app";
import { TEST_USER_ID } from "../../test/fixtures/profile-payloads";

describe("PhotoController (HTTP)", () => {
  let app: INestApplication;
  let profilePhoto: { upload: jest.Mock; remove: jest.Mock };

  beforeEach(async () => {
    profilePhoto = {
      upload: jest.fn().mockResolvedValue({
        url: "https://storage.example.com/p.jpg",
      }),
      remove: jest.fn().mockResolvedValue({
        url: "https://storage.example.com/p.jpg",
      }),
    };

    const moduleRef = await createProfileControllerTestModule({
      profilePhoto,
    });
    app = moduleRef.createNestApplication();
    applyApiTestConfig(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("POST /photo forwards multipart file to upload service", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    await request(app.getHttpServer() as never)
      .post("/api/v1/photo")
      .attach("file", png, { filename: "photo.png", contentType: "image/png" })
      .expect(HttpStatus.OK)
      .expect((res) => {
        expect(res.body).toEqual({ url: "https://storage.example.com/p.jpg" });
      });

    expect(profilePhoto.upload).toHaveBeenCalledWith(
      TEST_USER_ID,
      expect.objectContaining({ mimetype: "image/png" }),
    );
  });

  it("DELETE /photo accepts target URL in JSON body and calls remove service", async () => {
    const targetUrl = "https://storage.example.com/profiles/user-1/photo.jpg";
    await request(app.getHttpServer() as never)
      .delete("/api/v1/photo")
      .send({ url: targetUrl })
      .expect(HttpStatus.OK)
      .expect((res) => {
        expect(res.body).toEqual({ url: "https://storage.example.com/p.jpg" });
      });

    expect(profilePhoto.remove).toHaveBeenCalledWith(targetUrl);
  });

  it("DELETE /photo rejects missing or invalid URL with 400", async () => {
    await request(app.getHttpServer() as never)
      .delete("/api/v1/photo")
      .send({})
      .expect(HttpStatus.BAD_REQUEST);

    await request(app.getHttpServer() as never)
      .delete("/api/v1/photo")
      .send({ url: "not-a-valid-url" })
      .expect(HttpStatus.BAD_REQUEST);

    expect(profilePhoto.remove).not.toHaveBeenCalled();
  });
});
