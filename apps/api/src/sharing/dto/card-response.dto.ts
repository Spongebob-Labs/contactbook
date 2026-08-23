import { ApiProperty } from '@nestjs/swagger';
import { CardKind, FieldCategory, FieldType } from '@prisma/client';

export class CardFieldResponseDto {
  @ApiProperty({ example: 'b7e1c2a3-1234-4f5a-8b6c-7d8e9f0a1b2c' })
  fieldId!: string;

  @ApiProperty({ enum: FieldCategory, example: FieldCategory.WORK })
  category!: FieldCategory;

  @ApiProperty({ enum: FieldType, example: FieldType.PHONE })
  type!: FieldType;

  @ApiProperty({
    example: 'Reach me here',
    description:
      'labelOverride if set on this card, otherwise the field’s own label.',
  })
  label!: string;

  @ApiProperty({
    example: '+14155550142',
    description:
      'Decrypted plaintext for financial types, same as the field editor — this is your own view of what you are about to share.',
  })
  value!: string;

  @ApiProperty({ example: true })
  visible!: boolean;

  @ApiProperty({ example: 0 })
  position!: number;
}

export class CardResponseDto {
  @ApiProperty({ example: '9c1a1b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c' })
  id!: string;

  @ApiProperty({ example: 'Work' })
  name!: string;

  @ApiProperty({ enum: CardKind, example: CardKind.WORK })
  kind!: CardKind;

  @ApiProperty({ type: [CardFieldResponseDto] })
  fields!: CardFieldResponseDto[];

  @ApiProperty({ example: '2026-08-23T18:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-23T18:00:00.000Z' })
  updatedAt!: Date;
}
