import { ApiProperty } from '@nestjs/swagger';
import { ContactResponseDto } from './contact-response.dto';

export class ImportContactsResponseDto {
  @ApiProperty({
    type: [ContactResponseDto],
    description: 'Phone numbers that were not already in your registry.',
  })
  created!: ContactResponseDto[];

  @ApiProperty({
    type: [ContactResponseDto],
    description:
      'Phone numbers already in your registry — displayName was refreshed from the import if provided.',
  })
  updated!: ContactResponseDto[];
}
