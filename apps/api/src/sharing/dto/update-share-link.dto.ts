import { ApiProperty } from '@nestjs/swagger';
import { ShareLinkStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateShareLinkDto {
  @ApiProperty({
    enum: ShareLinkStatus,
    example: ShareLinkStatus.REVOKED,
    description:
      'REVOKED immediately 410s the public link. Setting ACTIVE again restores the same token — it is never regenerated.',
  })
  @IsEnum(ShareLinkStatus)
  status!: ShareLinkStatus;
}
