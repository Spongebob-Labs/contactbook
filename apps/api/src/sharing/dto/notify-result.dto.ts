import { ApiProperty } from '@nestjs/swagger';

export class NotifyResultDto {
  @ApiProperty({ example: '9c1a1b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c' })
  shareLinkId!: string;

  @ApiProperty({ example: '9c1a1b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c' })
  outboxMessageId!: string;

  @ApiProperty({
    enum: ['ENQUEUED'],
    example: 'ENQUEUED',
    description:
      'The send is queued, not confirmed delivered — it fails cleanly with ' +
      'CARD_UPDATE_TEMPLATE_NOT_CONFIGURED until a CARD_UPDATE WhatsAppTemplate is approved.',
  })
  status!: 'ENQUEUED';
}
