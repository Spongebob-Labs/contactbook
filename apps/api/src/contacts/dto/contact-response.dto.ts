import { ApiProperty } from '@nestjs/swagger';
import { ContactSource } from '@prisma/client';

export class ContactResponseDto {
  @ApiProperty({ example: '9c1a1b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c' })
  id!: string;

  @ApiProperty({ example: '+919876543210' })
  phoneE164!: string;

  @ApiProperty({ nullable: true, example: 'Priya' })
  displayName!: string | null;

  @ApiProperty({
    nullable: true,
    example: 'Met at DevFest, potential investor',
  })
  notes!: string | null;

  @ApiProperty({ enum: ContactSource, example: ContactSource.MANUAL })
  source!: ContactSource;

  @ApiProperty({
    nullable: true,
    example: null,
    description:
      'Set when this contact has texted STOP. Blocks future sends; existing links stay live.',
  })
  optedOutAt!: Date | null;

  @ApiProperty({ example: '2026-08-23T18:00:00.000Z' })
  createdAt!: Date;
}
