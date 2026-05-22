import { ApiProperty } from "@nestjs/swagger";

export class ProfilePhotoResponseDto {
  @ApiProperty({
    description: "Public HTTPS URL of the profile photo in GCS.",
    nullable: true,
  })
  profilePhoto!: string | null;
}
