import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { LoggingMiddleware } from "./logging.middleware";
import { GcpJsonLogger } from "./gcp-json-logger.service";

@Module({
  providers: [GcpJsonLogger],
  exports: [GcpJsonLogger],
})
export class LoggerModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(LoggingMiddleware)
      .exclude("api/v1/health", "v1/health", "health")
      .forRoutes("*");
  }
}
