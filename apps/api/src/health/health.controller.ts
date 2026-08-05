import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { HealthResponseDto } from "./dto/health-response.dto";
import { WhatsappMessagingService } from "../messaging/whatsapp-messaging.service";

@ApiTags("Health")
@Controller({ path: "health", version: "1" })
export class HealthController {
  constructor(private readonly messaging: WhatsappMessagingService) {}

  @Get()
  @ApiOperation({ summary: "Service health check" })
  @ApiOkResponse({ type: HealthResponseDto })
  async getHealth(): Promise<HealthResponseDto> {
    const whatsapp = await this.messaging.getReadiness();
    return {
      status: whatsapp.ready ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      whatsapp,
    };
  }
}
