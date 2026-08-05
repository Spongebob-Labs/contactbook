import { ApiProperty } from "@nestjs/swagger";
import type { HealthStatus } from "@repo/types";

export class HealthResponseDto implements HealthStatus {
  @ApiProperty({ enum: ["ok", "degraded"] })
  status!: HealthStatus["status"];

  @ApiProperty({ example: "2026-01-01T00:00:00.000Z" })
  timestamp!: string;

  @ApiProperty({
    type: "object",
    properties: { ready: { type: "boolean" }, status: { type: "string" } },
  })
  whatsapp!: { ready: boolean; status: string };
}
