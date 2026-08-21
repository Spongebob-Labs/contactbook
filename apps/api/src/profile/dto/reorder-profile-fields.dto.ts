import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsString } from 'class-validator';

export class ReorderProfileFieldsDto {
  @ApiProperty({
    type: [String],
    example: ['b2c1...', 'a4f0...'],
    description:
      'Field ids in the new display order. Every id must belong to the caller — ' +
      'ids belonging to another user are rejected, not silently skipped.',
  })
  @IsString({ each: true })
  @ArrayUnique()
  @ArrayMinSize(1)
  orderedIds!: string[];
}
