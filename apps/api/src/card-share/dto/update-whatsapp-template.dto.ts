import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateWhatsappTemplateDto {
  @ApiPropertyOptional({
    description:
      "New template body text. Any content change (body, buttonTitle, headerImageUrl) " +
      "creates a new Twilio Content Template, submits it for WhatsApp re-approval, and " +
      "swaps the contentSid. Sends are blocked by the approval gate until Meta approves.",
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(1024)
  body?: string;

  @ApiPropertyOptional({
    description: "New URL button label. Content change — triggers re-approval.",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(25)
  buttonTitle?: string;

  @ApiPropertyOptional({
    description:
      "New static header image URL (HTTPS). Content change — triggers re-approval.",
  })
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_tld: true })
  headerImageUrl?: string;

  @ApiPropertyOptional({
    description:
      "Admin kill-switch. Deactivated templates are hidden from the picker and blocked " +
      "at send time regardless of approval status.",
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
