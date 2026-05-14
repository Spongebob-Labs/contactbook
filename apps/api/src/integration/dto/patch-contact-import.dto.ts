import { ApiProperty } from "@nestjs/swagger";
import { IsObject } from "class-validator";

export class PatchContactImportDto {
  @ApiProperty({
    description: "Arbitrary override payload; use locks/values for displayName",
    type: "object",
    additionalProperties: true,
  })
  @IsObject()
  userOverrides!: Record<string, unknown>;
}
