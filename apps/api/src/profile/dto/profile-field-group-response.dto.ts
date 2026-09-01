import { ApiProperty } from '@nestjs/swagger';
import { FieldGroupCategory } from '@prisma/client';
import { ProfileFieldResponseDto } from './profile-field-response.dto';

export class ProfileFieldGroupResponseDto {
  @ApiProperty({ example: 'b7e1c2a3-...' })
  id!: string;

  @ApiProperty({ enum: FieldGroupCategory, example: FieldGroupCategory.WORK })
  category!: FieldGroupCategory;

  @ApiProperty({ required: false, nullable: true, example: 'Acme Corp' })
  tag!: string | null;

  @ApiProperty({ example: 0 })
  position!: number;

  @ApiProperty({ type: [ProfileFieldResponseDto] })
  fields!: ProfileFieldResponseDto[];
}
