import { NestFactory } from "@nestjs/core";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  const allowedOrigins = (
    process.env.CORS_ORIGIN ??
    [
      "https://contactbookten.vercel.app",
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
    .addServer("http://localhost:8001", "Local")
    .addServer(
      "https://contactbook-api-449864809731.europe-west1.run.app",
      "Production",
    )
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
  console.error("Failed to bootstrap application", error);
  process.exit(1);
});
