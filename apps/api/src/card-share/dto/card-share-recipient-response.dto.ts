import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CardShareDispatchStatus, WhatsappMessageStatus } from "@prisma/client";

export class CardShareRecipientResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  countryCode!: string;

  @ApiProperty()
  phone!: string;

  @ApiPropertyOptional({ nullable: true })
  contactId!: string | null;

  @ApiProperty({ enum: CardShareDispatchStatus })
  dispatchStatus!: CardShareDispatchStatus;

  @ApiPropertyOptional({ enum: WhatsappMessageStatus, nullable: true })
  deliveryStatus!: WhatsappMessageStatus | null;

  @ApiPropertyOptional({ nullable: true })
  lastDispatchError!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sentAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  deliveredAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  readAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  failedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}
