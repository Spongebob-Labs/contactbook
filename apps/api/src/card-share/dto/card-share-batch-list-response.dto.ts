import { ApiProperty } from "@nestjs/swagger";
import { CardShareBatchResponseDto } from "./card-share-batch-response.dto";

export class CardShareBatchListResponseDto {
  @ApiProperty({ type: () => [CardShareBatchResponseDto] })
  items!: CardShareBatchResponseDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}
