import { ApiProperty } from "@nestjs/swagger";

export class ProfilePhotoResponseDto {
  @ApiProperty({
    description: "Public HTTPS URL of the uploaded image in GCS.",
  })
  url!: string;
}
