import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { HealthResponseDto } from "./dto/health-response.dto";

@ApiTags("Health")
@Controller({ path: "health", version: "1" })
export class HealthController {
  @Get()
  @ApiOperation({ summary: "Service health check" })
  @ApiOkResponse({ type: HealthResponseDto })
  getHealth(): HealthResponseDto {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
