import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class DigitalWalletPayloadDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  platform!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  handleOrLink!: string;
}
