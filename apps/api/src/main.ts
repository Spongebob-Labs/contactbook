import { NestFactory } from "@nestjs/core";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { GcpJsonLogger } from "./common/logger/gcp-json-logger.service";

async function bootstrap(): Promise<void> {
  const logger = new GcpJsonLogger();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    logger,
  });

  // Published card snapshots inline the profile photo as a data URL, which
  // Express's 100kb JSON default rejects outright. Raising the ceiling only
  // permits larger bodies; parsing semantics (and rawBody capture for the
  // Twilio webhooks) are unchanged.
  app.useBodyParser("json", { limit: "2mb" });

  const allowedOrigins = (
    process.env.CORS_ORIGIN ??
    [
      "https://contactbookten.vercel.app",
      "https://www.getcontactbook.com",
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:8000",
      "http://127.0.0.1:5173",
      "http://192.168.1.18:5173",
    ].join(",")
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.setGlobalPrefix("api");
  app.enableVersioning({
    type: VersioningType.URI,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("ContactBook API")
    .setDescription(
      "HTTP API for ContactBook: sync professional and personal contacts via web and WhatsApp.",
    )
    .setVersion("1.0")
    .addServer("http://localhost:8080", "Local")
    .addServer("http://34.147.177.94:8080", "VM Dev")
    .addServer("https://uat.api.getcontactbook.com", "UAT")
    .addServer("https://api.getcontactbook.com", "Production")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT access token from ContactBook auth endpoints.",
      },
      "access-token",
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig, {
    deepScanRoutes: true,
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey}_${methodKey}`,
  });

  SwaggerModule.setup("api/docs", app, swaggerDocument, {
    customSiteTitle: "ContactBook API",
    jsonDocumentUrl: "/api/openapi.json",
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: "alpha",
      operationsSorter: "alpha",
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(
    process.env.PORT ?? (process.env.NODE_ENV === "production" ? 8080 : 8001),
  );
  await app.listen(port, "0.0.0.0");
}

bootstrap().catch((error: unknown) => {
  const logger = new GcpJsonLogger();
  logger.error("Failed to bootstrap application", error);
  process.exit(1);
});
