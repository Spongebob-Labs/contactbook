import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { WhatsappTemplateUseCase } from "@prisma/client";

export class WhatsappTemplateResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  key!: string;

  @ApiProperty({ enum: WhatsappTemplateUseCase })
  useCase!: WhatsappTemplateUseCase;

  @ApiProperty()
  locale!: string;

  @ApiProperty()
  bodyPreview!: string;

  @ApiProperty()
  contentSid!: string;

  @ApiProperty()
  isDefault!: boolean;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional({
    description:
      "Live approval status fetched from Twilio. Only present on single-template GET.",
    enum: ["approved", "pending", "received", "rejected", "unknown"],
  })
  approvalStatus?: string;

  @ApiPropertyOptional({
    description: "Meta rejection reason, if approvalStatus is rejected.",
  })
  rejectionReason?: string;
}
