import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class CreateSensitiveFieldRequestDto {
  @ApiProperty()
  @IsUUID()
  profileFieldId!: string;
}
