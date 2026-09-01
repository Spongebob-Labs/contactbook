import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ShareCardDto {
  @ApiProperty({
    example: 'b7e1c2a3-1234-4f5a-8b6c-7d8e9f0a1b2c',
    description:
      'Must be one of your own Contact ids — add it first via POST /contacts or ' +
      'POST /contacts/import. A contact belonging to another user is rejected, not silently ' +
      'ignored.',
  })
  @IsUUID()
  contactId!: string;
}
