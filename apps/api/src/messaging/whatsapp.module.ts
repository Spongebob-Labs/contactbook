import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaModule } from "../prisma/prisma.module";
import { OpenWaProvider } from "./openwa.provider";
import { WhatsappMessagingService } from "./whatsapp-messaging.service";
import { WHATSAPP_PROVIDER } from "./whatsapp-provider";
import type { WhatsappProvider } from "./whatsapp-provider";
import {
  WHATSAPP_GATEWAY_SESSION_NOT_READY,
  WHATSAPP_DELIVERY_FAILED,
  WhatsappProviderError,
} from "./whatsapp-errors";

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: WHATSAPP_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>("WHATSAPP_PROVIDER", "openwa");
        if (provider !== "openwa")
          throw new Error(`Unsupported WHATSAPP_PROVIDER: ${provider}`);
        if (
          process.env.NODE_ENV === "test" &&
          !config.get<string>("OPENWA_BASE_URL")
        ) {
          return new UnavailableTestProvider();
        }
        return new OpenWaProvider(config);
      },
    },
    WhatsappMessagingService,
  ],
  exports: [WhatsappMessagingService, WHATSAPP_PROVIDER],
})
export class WhatsappModule {}

class UnavailableTestProvider implements WhatsappProvider {
  sendText(): Promise<never> {
    return Promise.reject(unavailableError());
  }

  sendOtp(): Promise<never> {
    return Promise.reject(unavailableError());
  }

  sendConnectionInvite(): Promise<never> {
    return Promise.reject(unavailableError());
  }

  handleInboundMessage(): null {
    return null;
  }

  getDeliveryStatus(): Promise<never> {
    return Promise.reject(unavailableError());
  }

  getReadiness(): Promise<{ ready: false; status: "unavailable" }> {
    return Promise.resolve({ ready: false, status: "unavailable" });
  }
}

function unavailableError(): WhatsappProviderError {
  return new WhatsappProviderError(
    WHATSAPP_GATEWAY_SESSION_NOT_READY,
    "WhatsApp provider is unavailable in this test.",
  );
}
