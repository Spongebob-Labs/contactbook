import { ApiProperty } from '@nestjs/swagger';

export class ConnectResultDto {
  @ApiProperty({ example: true })
  connected!: true;
}
