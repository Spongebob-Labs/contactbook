import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { AppLogger } from './common/logging/app-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Twilio signature verification needs the unparsed body. Retrofitting this
    // later is painful, so it is on from the first commit.
    rawBody: true,
    bufferLogs: true,
  });

  const config = app.get(AppConfigService);
  const logger = app.get(AppLogger);
  app.useLogger(logger);

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({ origin: config.corsOrigins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableShutdownHooks();

  if (config.swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('ContactBook API')
        .setDescription(
          'Every error response uses one envelope: {statusCode, code, message, requestId, details?}. ' +
            'Branch on `code`, not on `message` — see docs/architecture/lld.md §3.',
        )
        .setVersion('1.0')
        .addBearerAuth(
          { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          'access-token',
        )
        .addCookieAuth('cb_access_token', {
          type: 'apiKey',
          in: 'cookie',
          description:
            'Set automatically by POST /auth/otp/verify. This is how the browser dashboard authenticates.',
        })
        .build(),
    );
    // Nest also serves the raw document at `${path}-json` automatically —
    // useful for generating a typed client.
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(config.port, '0.0.0.0');

  logger.info('app.started', {
    port: config.port,
    env: config.appEnv,
    nodeEnv: config.nodeEnv,
    taskTransport: config.tasks.transport,
    swaggerEnabled: config.swaggerEnabled,
  });
}

void bootstrap().catch((err) => {
  // DI may not exist yet, so this cannot use AppLogger.
  console.error('Fatal error during bootstrap', err);
  process.exit(1);
});
