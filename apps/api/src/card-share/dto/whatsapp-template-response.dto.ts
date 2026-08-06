import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  WhatsappTemplateApprovalStatus,
  WhatsappTemplateSyncStatus,
  WhatsappTemplateUseCase,
} from "@prisma/client";

export class WhatsappTemplateResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  key!: string;

  @ApiProperty({ enum: WhatsappTemplateUseCase })
  useCase!: WhatsappTemplateUseCase;

  @ApiProperty()
  locale!: string;

  @ApiProperty({
    description:
      "Mirror of the template body on Twilio, kept in sync so previews match sends exactly.",
  })
  bodyPreview!: string;

  @ApiProperty({ description: "Mirror of the URL button label on Twilio." })
  buttonTitle!: string;

  @ApiPropertyOptional({
    description: "Static header image baked into the template, if any.",
    nullable: true,
  })
  headerImageUrl!: string | null;

  @ApiProperty()
  contentSid!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({
    description:
      "WhatsApp approval status mirrored from Twilio by the sync service.",
    enum: WhatsappTemplateApprovalStatus,
  })
  approvalStatus!: WhatsappTemplateApprovalStatus;

  @ApiPropertyOptional({
    description: "Meta rejection reason, if approvalStatus is REJECTED.",
    nullable: true,
  })
  rejectionReason!: string | null;

  @ApiProperty({
    description: "Outcome of the last DB<->Twilio reconciliation.",
    enum: WhatsappTemplateSyncStatus,
  })
  syncStatus!: WhatsappTemplateSyncStatus;

  @ApiPropertyOptional({
    description:
      "When the template was last successfully reconciled against Twilio.",
    nullable: true,
  })
  syncedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}
