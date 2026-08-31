import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

export class NotifyCardDto {
  @ApiProperty({
    type: [String],
    example: ['9c1a1b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c'],
    description:
      'ShareLink ids to notify — from GET /cards/:id/audience. Each must be an ACTIVE link ' +
      'on this card; anything else is rejected, not silently skipped.',
  })
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  shareLinkIds!: string[];
}
