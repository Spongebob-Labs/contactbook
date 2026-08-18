import { ApiProperty } from "@nestjs/swagger";
import { IsObject } from "class-validator";

export class PublishCardDto {
  /**
   * Opaque, versioned card snapshot owned by the web client — the API stores
   * and serves it verbatim and never interprets it. That is deliberate: new
   * layouts, themes and block types ship without an API migration.
   *
   * The global ValidationPipe runs `whitelist` + `forbidNonWhitelisted`, but
   * those only apply to declared properties of this class. Without a nested
   * type to recurse into, the snapshot object passes through untouched.
   */
  @ApiProperty({
    type: "object",
    additionalProperties: true,
    description: "Versioned card snapshot, stored and served verbatim.",
  })
  @IsObject()
  snapshot!: Record<string, unknown>;
}
