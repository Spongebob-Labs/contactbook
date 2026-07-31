import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateWhatsappTemplateDto {
  @ApiPropertyOptional({
    description:
      "New template body text. If changed (along with buttonTitle), a new Twilio Content " +
      "Template is created and submitted for WhatsApp re-approval. The DB entry's isActive " +
      "is set to false until the new template is approved and you activate it via isActive: true.",
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(1024)
  body?: string;

  @ApiPropertyOptional({
    description:
      "New URL button label. Triggers a new Twilio template creation if body is also provided.",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(25)
  buttonTitle?: string;

  @ApiPropertyOptional({
    description:
      "Activate or deactivate this template. Set to true once WhatsApp approves a newly " +
      "created or updated template.",
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      "Make this the default template for its use case + locale. Clears isDefault on any " +
      "existing default for the same use case + locale.",
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
