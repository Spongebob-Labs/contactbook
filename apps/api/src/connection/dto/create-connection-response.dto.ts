import { ApiProperty } from "@nestjs/swagger";
import {
  ConnectionInviteRecipientKind,
  ConnectionInviteStatus,
  ConnectionStatus,
} from "@prisma/client";

export class ConnectionResponseDto {
  @ApiProperty({ enum: ["connection"] })
  type!: "connection";

  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ConnectionStatus })
  status!: ConnectionStatus;

  @ApiProperty()
  requesterId!: string;

  @ApiProperty()
  receiverId!: string;

  @ApiProperty({ nullable: true })
  requesterSharedCardId!: string | null;

  @ApiProperty({ nullable: true })
  receiverSharedCardId!: string | null;

  @ApiProperty()
  hasSharedBack!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class ConnectionInviteResponseDto {
  @ApiProperty({ enum: ["invite"] })
  type!: "invite";

  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ConnectionInviteRecipientKind })
  recipientKind!: ConnectionInviteRecipientKind;

  @ApiProperty({ nullable: true })
  recipientContactId!: string | null;

  @ApiProperty()
  recipientCountryCode!: string;

  @ApiProperty()
  recipientPhone!: string;

  @ApiProperty({ enum: ConnectionInviteStatus })
  status!: ConnectionInviteStatus;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty()
  createdAt!: Date;
}
