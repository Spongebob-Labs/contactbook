import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

  @ApiProperty({
    example: 'https://cards.contactbook.app/c/4f8Kq2mR7xJp1sN0vLtQ9a',
    description:
      'This card’s own public URL — what its QR code encodes. Independent of any recipient: it exists before the card has ever been shared with anyone, and revoking one recipient’s link never affects it. Resolves through the same public endpoint as a per-recipient share link.',
  })
  publicUrl!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 'https://storage.googleapis.com/.../card-logos/.../logo.jpg',
    description:
      'Set only via POST /cards/:id/logo — never accepted on create/update. ' +
      'NULL until the owner uploads one.',
  })
  logoUrl!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'meridian',
    description: 'NULL means the owner never chose one.',
  })
  templateId!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'sapphire' })
  paletteId!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '#1B4F72',
    description: 'Overrides paletteId when set.',
  })
  groundHex!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'matte' })
  finish!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'none' })
  texture!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'subtle' })
  texturePresence!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '1x' })
  textureScale!: string | null;

  @ApiProperty({ type: [CardFieldResponseDto] })
  fields!: CardFieldResponseDto[];

  @ApiProperty({ example: '2026-08-23T18:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-23T18:00:00.000Z' })
  updatedAt!: Date;
}
