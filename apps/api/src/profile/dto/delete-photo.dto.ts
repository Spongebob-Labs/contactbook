import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { IsProfilePhotoUrl } from "../validators/is-profile-photo-url.validator";

export class DeletePhotoDto {
  @ApiProperty({
    description: "Public HTTPS URL of the photo to delete.",
    example:
      "https://storage.googleapis.com/my-bucket/profiles/user-1/photo.jpg",
  })
  @IsString()
  @IsNotEmpty()
  @IsProfilePhotoUrl()
  url!: string;
}
