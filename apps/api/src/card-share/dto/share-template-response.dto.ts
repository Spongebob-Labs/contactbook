import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * A template as shown in the user-facing share picker. Content mirrors Twilio exactly
 * (kept fresh by the sync service) so the preview the user sees is what gets sent.
 * Deliberately omits contentSid and internal sync/approval state.
 */
export class ShareTemplateResponseDto {
  @ApiProperty({
    description: "Pass this as templateKey when creating a share.",
    example: "card_share_classic_en",
  })
  key!: string;

  @ApiProperty({ example: "en" })
  locale!: string;

  @ApiProperty({
    description:
      "Template body with WhatsApp variables: {{1}} sender name, {{2}} card name, {{3}} note.",
  })
  body!: string;

  @ApiProperty({ description: "Label on the message's URL button." })
  buttonTitle!: string;

  @ApiPropertyOptional({
    description: "Static header image shown above the message body, if any.",
    nullable: true,
  })
  headerImageUrl!: string | null;

  @ApiProperty({
    description: "When this content was last verified against Twilio.",
    nullable: true,
  })
  syncedAt!: Date | null;

  @ApiPropertyOptional({
    description:
      "Only on POST (creation) responses: WhatsApp approval state. The template joins " +
      "the picker automatically once this reaches APPROVED (mirrored by the sync cron).",
  })
  approvalStatus?: string;
}
