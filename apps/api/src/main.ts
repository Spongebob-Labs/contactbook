import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
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

  await app.listen(config.port, '0.0.0.0');

  logger.info('app.started', {
    port: config.port,
    env: config.appEnv,
    nodeEnv: config.nodeEnv,
    taskTransport: config.tasks.transport,
  });
}

void bootstrap().catch((err) => {
  // DI may not exist yet, so this cannot use AppLogger.
  console.error('Fatal error during bootstrap', err);
  process.exit(1);
});
