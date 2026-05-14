import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class ShareBackDto {
  @ApiProperty()
  @IsUUID()
  recipientSharedCardId!: string;
}
