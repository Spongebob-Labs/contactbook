import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class CryptoWalletPayloadDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  network!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  address!: string;
}
