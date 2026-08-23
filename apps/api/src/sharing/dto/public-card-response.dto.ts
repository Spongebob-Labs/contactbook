import { ApiProperty } from '@nestjs/swagger';
import { CardKind, FieldType } from '@prisma/client';

// No ids anywhere in this file, deliberately — see docs/architecture/lld.md
// §3 "Representative payloads": the recipient gets display data and nothing
// that could be used to probe the API (no owner uuid, no card uuid, no
// field uuid). Never spread a Prisma row into this shape.

export class PublicOwnerDto {
  @ApiProperty({
    nullable: true,
    example: 'Ada Lovelace',
    description:
      'firstName + lastName, or null if the owner has not onboarded yet.',
  })
  name!: string | null;

  @ApiProperty({
    nullable: true,
    example: 'https://storage.googleapis.com/.../photo.jpg',
  })
  photoUrl!: string | null;
}

export class PublicCardMetaDto {
  @ApiProperty({ example: 'Work' })
  name!: string;

  @ApiProperty({ enum: CardKind, example: CardKind.WORK })
  kind!: CardKind;

  @ApiProperty({
    example: '2026-08-23T18:00:00.000Z',
    description:
      'When the card’s field selection was last changed — not when any individual field value changed.',
  })
  updatedAt!: Date;
}

export class PublicFieldDto {
  @ApiProperty({ enum: FieldType, example: FieldType.PHONE })
  type!: FieldType;

  @ApiProperty({ example: 'Work mobile' })
  label!: string;

  @ApiProperty({
    example: '+14155550142',
    description:
      'Live current value, decrypted for financial types — resolved at request time, never cached.',
  })
  value!: string;
}

export class PublicCardResponseDto {
  @ApiProperty({ type: PublicOwnerDto })
  owner!: PublicOwnerDto;

  @ApiProperty({ type: PublicCardMetaDto })
  card!: PublicCardMetaDto;

  @ApiProperty({ type: [PublicFieldDto] })
  fields!: PublicFieldDto[];
}
