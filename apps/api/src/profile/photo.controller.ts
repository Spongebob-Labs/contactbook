import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { JwtUserPayload } from "../common/decorators/current-user.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { DeletePhotoDto } from "./dto/delete-photo.dto";
import { ProfilePhotoResponseDto } from "./dto/profile-photo-response.dto";
import { ProfilePhotoService } from "./profile-photo.service";

@ApiTags("Photo")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@Controller({ path: "photo", version: "1" })
export class PhotoController {
  constructor(private readonly profilePhoto: ProfilePhotoService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Upload image",
    description:
      "Stores any image in GCS and returns the public HTTPS URL. " +
      "Accepts image/jpeg, image/png, or image/webp up to 1 MB.",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: { type: "string", format: "binary" },
      },
    },
  })
  @ApiOkResponse({ type: ProfilePhotoResponseDto })
  uploadPhoto(
    @CurrentUser() user: JwtUserPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.profilePhoto.upload(user.sub, file);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Delete uploaded image",
    description:
      "Deletes an image from GCS given its URL in the request body. " +
      "The developer is responsible for cleaning up references to the URL in their database.",
  })
  @ApiOkResponse({ type: ProfilePhotoResponseDto })
  deletePhoto(@Body() dto: DeletePhotoDto) {
    return this.profilePhoto.remove(dto.url);
  }
}
