import { ApiProperty } from '@nestjs/swagger';

export class PhotoResponseDto {
  @ApiProperty({ example: '9c1a1b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c' })
  id!: string;

  @ApiProperty({
    example:
      'https://storage.googleapis.com/contactbook-profile-photos/9c1a.../a1b2....jpg',
  })
  url!: string;
}
