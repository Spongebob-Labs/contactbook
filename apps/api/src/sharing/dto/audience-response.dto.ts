import { ApiProperty } from '@nestjs/swagger';
import { AudienceRecipientDto } from './audience-recipient.dto';

export class AudienceResponseDto {
  @ApiProperty({ example: 2 })
  currentVersion!: number;

  @ApiProperty({
    type: [AudienceRecipientDto],
    description:
      'Active ShareLinks only — a revoked or never-shared contact has no link to notify.',
  })
  recipients!: AudienceRecipientDto[];
}
