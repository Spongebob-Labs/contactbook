import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardTotalsDto {
  @ApiProperty({ example: 9, description: 'Non-archived cards.' })
  cards!: number;

  @ApiProperty({ example: 8 })
  contacts!: number;

  @ApiProperty({ example: 35, description: 'Non-archived ProfileFields.' })
  fields!: number;

  @ApiProperty({
    example: 12,
    description:
      'DISTINCT contacts holding at least one ACTIVE ShareLink — not the ' +
      'contact count, and not the link count. One person holding three cards is one person.',
  })
  peopleReached!: number;

  @ApiProperty({
    example: 8,
    description:
      'DISTINCT contacts who have opened at least one ACTIVE link. The ' +
      'people-shaped counterpart to neverOpened, which counts LINKS — one ' +
      'person may hold three links and have opened only one, so neither is ' +
      'derivable from the other. Computed from the same single pass as ' +
      'peopleReached, so it can never exceed it.',
  })
  peopleOpened!: number;

  @ApiProperty({
    example: 47,
    description:
      'viewCount summed over ACTIVE links only — a revoked link’s opens are history.',
  })
  totalOpens!: number;

  @ApiProperty({
    example: 3,
    description: 'ACTIVE links with viewCount = 0.',
  })
  neverOpened!: number;

  @ApiPropertyOptional({
    nullable: true,
    example: 5,
    description:
      'DISTINCT contacts behind on at least one ACTIVE card — always a subset of, never ' +
      'greater than, peopleReached. null (never 0) when there is nothing to compute this ' +
      'from — e.g. no cards yet. Rendered differently on purpose: "we don\'t know" is not ' +
      'the same claim as "nobody is behind."',
  })
  behind!: number | null;
}

export class CardReachItemDto {
  @ApiProperty({ example: '9c1a1b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c' })
  cardId!: string;

  @ApiProperty({ example: 'Work' })
  cardName!: string;

  @ApiProperty({
    example: 12,
    description: 'Summed viewCount across this card’s ACTIVE links.',
  })
  opens!: number;

  @ApiProperty({
    example: 3,
    description: 'ACTIVE links on this card.',
  })
  recipients!: number;
}

export class AttentionItemDto {
  @ApiProperty({
    enum: ['no-fields', 'behind', 'never-opened', 'never-shared'],
    example: 'behind',
  })
  kind!: 'no-fields' | 'behind' | 'never-opened' | 'never-shared';

  @ApiProperty({ example: '9c1a1b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c' })
  cardId!: string;

  @ApiProperty({ example: 'Work' })
  cardName!: string;

  @ApiProperty({
    example: 2,
    description:
      'Meaning depends on kind: recipients behind (behind), recipients who never opened ' +
      '(never-opened), or 0 as a fixed marker for the binary kinds (no-fields, never-shared).',
  })
  count!: number;
}

export class SharingActivityBucketDto {
  @ApiProperty({
    example: '2026-06-29',
    description: 'Monday (UTC) of this bucket’s week.',
  })
  weekStart!: string;

  @ApiProperty({
    example: 0,
    description:
      'ShareLinks CREATED in this week, across all this owner’s cards, regardless of ' +
      'current status. This measures link creation, not opens — see the card-appearance ' +
      'spec §4.3 for why an opens-over-time chart doesn’t exist yet.',
  })
  count!: number;
}

export class DashboardGroupDto {
  @ApiProperty({ example: 'b7e1c2a3-1234-4f5a-8b6c-7d8e9f0a1b2c' })
  id!: string;

  @ApiProperty({
    example: 'Work',
    description:
      'The group’s own tag, or a title-cased fallback of its category when untagged.',
  })
  name!: string;

  @ApiProperty({
    example: 4,
    description:
      'Non-archived fields in this group. Empty groups are included, not filtered out.',
  })
  fieldCount!: number;
}

export class DashboardResponseDto {
  @ApiProperty({ type: DashboardTotalsDto })
  totals!: DashboardTotalsDto;

  @ApiProperty({
    type: [CardReachItemDto],
    description:
      'One row per non-archived card, including cards with zero opens/recipients.',
  })
  cardReach!: CardReachItemDto[];

  @ApiProperty({
    type: [AttentionItemDto],
    description:
      'Grouped by kind in priority order (no-fields, behind, never-opened, never-shared), ' +
      'worst (highest count) first within each kind.',
  })
  attention!: AttentionItemDto[];

  @ApiProperty({
    type: [SharingActivityBucketDto],
    description:
      '12 weekly buckets, oldest first, ending with the current week.',
  })
  sharingActivity!: SharingActivityBucketDto[];

  @ApiProperty({
    type: [DashboardGroupDto],
    description: 'Every non-archived group, including empty ones.',
  })
  groups!: DashboardGroupDto[];
}
