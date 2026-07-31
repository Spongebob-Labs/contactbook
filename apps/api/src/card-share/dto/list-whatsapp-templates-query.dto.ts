import { ApiPropertyOptional } from "@nestjs/swagger";
import { WhatsappTemplateUseCase } from "@prisma/client";
import { IsEnum, IsOptional } from "class-validator";

export class ListWhatsappTemplatesQueryDto {
  @ApiPropertyOptional({
    enum: WhatsappTemplateUseCase,
    default: WhatsappTemplateUseCase.CARD_SHARE,
  })
  @IsOptional()
  @IsEnum(WhatsappTemplateUseCase)
  useCase: WhatsappTemplateUseCase = WhatsappTemplateUseCase.CARD_SHARE;
}
