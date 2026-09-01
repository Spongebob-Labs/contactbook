import { ApiProperty } from '@nestjs/swagger';
import { FieldCategory, FieldType } from '@prisma/client';

export class ProfileFieldResponseDto {
  @ApiProperty({ example: '9c1a1b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c' })
  id!: string;

  @ApiProperty({ enum: FieldCategory, example: FieldCategory.WORK })
  category!: FieldCategory;

  @ApiProperty({ enum: FieldType, example: FieldType.PHONE })
  type!: FieldType;

  @ApiProperty({ example: 'Work mobile' })
  label!: string;

  @ApiProperty({
    example: '+14155550142',
    description:
      'Always the plaintext value — decrypted server-side for financial types before this ' +
      'response is built. Never logged: see common/logging/redact.ts.',
  })
  value!: string;

  @ApiProperty({ example: 0 })
  position!: number;

  @ApiProperty({
    required: false,
    nullable: true,
    example: null,
    description:
      'Set when this field belongs to one instance of a repeatable thing (a specific job, bank account, etc).',
  })
  groupId!: string | null;

  @ApiProperty({ example: '2026-08-21T18:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-21T18:00:00.000Z' })
  updatedAt!: Date;
}
