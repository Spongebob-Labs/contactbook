import { ApiProperty } from "@nestjs/swagger";

export class DeliveryBreakdownDto {
  @ApiProperty({ description: "Recipients not yet dispatched to WhatsApp." })
  pending!: number;

  @ApiProperty({ description: "Recipients handed off to Twilio." })
  dispatched!: number;

  @ApiProperty({ description: "Recipients who received the message." })
  delivered!: number;

  @ApiProperty({ description: "Recipients who read the message." })
  read!: number;

  @ApiProperty({ description: "Recipients where dispatch permanently failed." })
  failed!: number;
}

export class TopContactDto {
  @ApiProperty({ nullable: true, description: "Contact id if linked, null for unsynced numbers." })
  contactId!: string | null;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ example: "+91" })
  countryCode!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty({ description: "Total share messages sent to this contact." })
  timesSharedWith!: number;

  @ApiProperty({ description: "ISO timestamp of the most recent share to this contact." })
  lastSharedAt!: string;
}

export class TopCardDto {
  @ApiProperty({ nullable: true, description: "Card id, null if the card was deleted." })
  cardId!: string | null;

  @ApiProperty()
  cardName!: string;

  @ApiProperty({ example: "BUSINESS" })
  cardType!: string;

  @ApiProperty({ description: "Number of share batches sent using this card." })
  timesShared!: number;

  @ApiProperty({ description: "Total individual recipients reached by this card." })
  recipientCount!: number;
}

export class DashboardStatsDto {
  @ApiProperty({ description: "Total cards created by the user." })
  totalCards!: number;

  @ApiProperty({ description: "Total non-deleted contacts." })
  totalContacts!: number;

  @ApiProperty({ description: "Total WhatsApp share batches sent." })
  totalShareBatches!: number;

  @ApiProperty({ description: "Total individual recipient sends across all batches." })
  totalRecipientsReached!: number;

  @ApiProperty({ type: DeliveryBreakdownDto })
  deliveryBreakdown!: DeliveryBreakdownDto;

  @ApiProperty({ type: [TopContactDto], description: "Up to 5 contacts most frequently shared with." })
  topContacts!: TopContactDto[];

  @ApiProperty({ type: [TopCardDto], description: "Up to 5 cards most frequently shared." })
  topCards!: TopCardDto[];

  @ApiProperty({ description: "Share batches created in the last 7 days." })
  sharesLast7Days!: number;

  @ApiProperty({ description: "Share batches created in the last 30 days." })
  sharesLast30Days!: number;

  @ApiProperty({ description: "New contacts added in the last 30 days." })
  contactsAddedLast30Days!: number;

  @ApiProperty({ description: "New cards created in the last 30 days." })
  newCardsLast30Days!: number;
}
