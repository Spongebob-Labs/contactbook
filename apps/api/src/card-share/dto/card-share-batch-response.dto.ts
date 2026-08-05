import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CardType } from "@prisma/client";
import { CardShareRecipientResponseDto } from "./card-share-recipient-response.dto";

export class CardShareBatchResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  cardId!: string | null;

  @ApiProperty()
  cardName!: string;

  @ApiProperty({ enum: CardType })
  cardType!: CardType;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: () => [CardShareRecipientResponseDto] })
  recipients!: CardShareRecipientResponseDto[];
}
