import { ApiProperty } from "@nestjs/swagger";
import { ContactDetailDto } from "./contact-response.dto";

export class ContactListResponseDto {
  @ApiProperty({ type: [ContactDetailDto] })
  items!: ContactDetailDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty({
    description: "Total contacts matching the current filters and search.",
  })
  total!: number;

  @ApiProperty()
  totalPages!: number;
}
