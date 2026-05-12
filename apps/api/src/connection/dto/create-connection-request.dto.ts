import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsISO8601, IsOptional, IsUUID } from "class-validator";

export class CreateConnectionRequestDto {
  @ApiProperty()
  @IsEmail()
  recipientEmail!: string;

  @ApiProperty()
  @IsUUID()
  initiatorSharedCardId!: string;

  @ApiPropertyOptional({ description: "ISO datetime when share access ends" })
  @IsOptional()
  @IsISO8601()
  shareExpiresAt?: string;
}
