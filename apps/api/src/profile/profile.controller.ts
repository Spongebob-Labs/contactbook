import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiErrorResponseDto } from '../common/errors/api-error-response.dto';
import { CreateProfileFieldDto } from './dto/create-profile-field.dto';
import { UpdateProfileFieldDto } from './dto/update-profile-field.dto';
import { ReorderProfileFieldsDto } from './dto/reorder-profile-fields.dto';
import { ListProfileFieldsQueryDto } from './dto/list-profile-fields-query.dto';
import { ProfileFieldResponseDto } from './dto/profile-field-response.dto';
import { PhotoResponseDto } from './dto/photo-response.dto';
import { ProfileService } from './profile.service';
import { MAX_PHOTO_BYTES } from './profile-photo-storage.service';

/**
 * Every route here acts on the CALLER's own profile — there is no "list
 * fields for user X" endpoint, and every service call is scoped by
 * req.user.id. Reading someone else's profile happens through the (separate,
 * not-yet-built) public share-link resolver, never through this controller.
 */
@ApiTags('profile')
@ApiBearerAuth('access-token')
@ApiCookieAuth('cb_access_token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'profile', version: '1' })
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get('fields')
  @ApiOperation({
    summary: 'List your profile fields',
    description:
      'Ordered by position. Archived fields are excluded unless includeArchived=true.',
  })
  @ApiResponse({ status: 200, type: [ProfileFieldResponseDto] })
  async list(@Req() req: Request, @Query() query: ListProfileFieldsQueryDto) {
    return this.profile.list(req.user!.id, query);
  }

  @Get('fields/:id')
  @ApiOperation({ summary: 'Get one profile field' })
  @ApiResponse({ status: 200, type: ProfileFieldResponseDto })
  @ApiResponse({
    status: 404,
    type: ApiErrorResponseDto,
    description: 'PROFILE_FIELD_NOT_FOUND',
  })
  async getOne(@Req() req: Request, @Param('id') id: string) {
    return this.profile.getOne(req.user!.id, id);
  }

  @Post('fields')
  @ApiOperation({
    summary: 'Add a profile field',
    description:
      'BANK_ACCOUNT, DIGITAL_WALLET, and CRYPTO_WALLET values are encrypted at rest ' +
      'automatically — nothing to opt into. PHOTO cannot be created here; use POST /profile/photo.',
  })
  @ApiResponse({ status: 201, type: ProfileFieldResponseDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorResponseDto,
    description: 'PHOTO_VIA_UPLOAD_ONLY or FIELD_ENCRYPTION_NOT_CONFIGURED.',
  })
  @HttpCode(201)
  async create(@Req() req: Request, @Body() dto: CreateProfileFieldDto) {
    return this.profile.create(req.user!.id, dto);
  }

  @Patch('fields/:id')
  @ApiOperation({
    summary: 'Update a profile field',
    description:
      'type is immutable — delete and recreate the field to change it.',
  })
  @ApiResponse({ status: 200, type: ProfileFieldResponseDto })
  @ApiResponse({
    status: 404,
    type: ApiErrorResponseDto,
    description: 'PROFILE_FIELD_NOT_FOUND',
  })
  @ApiResponse({
    status: 409,
    type: ApiErrorResponseDto,
    description: 'PHOTO_VIA_UPLOAD_ONLY',
  })
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateProfileFieldDto,
  ) {
    return this.profile.update(req.user!.id, id, dto);
  }

  @Delete('fields/:id')
  @ApiOperation({
    summary: 'Remove a profile field',
    description:
      'Soft delete — the field is archived, not hard-deleted, so any card history that ' +
      'referenced it stays displayable. Removing a PHOTO field also deletes its GCS object.',
  })
  @HttpCode(204)
  @ApiResponse({ status: 204, description: 'Archived.' })
  @ApiResponse({
    status: 404,
    type: ApiErrorResponseDto,
    description: 'PROFILE_FIELD_NOT_FOUND',
  })
  async remove(@Req() req: Request, @Param('id') id: string): Promise<void> {
    await this.profile.archive(req.user!.id, id);
  }

  @Put('fields/order')
  @ApiOperation({
    summary: 'Reorder profile fields',
    description:
      'All-or-nothing: if any id does not belong to you, none are reordered.',
  })
  @HttpCode(204)
  @ApiResponse({ status: 204, description: 'Reordered.' })
  @ApiResponse({
    status: 403,
    type: ApiErrorResponseDto,
    description: 'PROFILE_FIELD_NOT_OWNED',
  })
  async reorder(
    @Req() req: Request,
    @Body() dto: ReorderProfileFieldsDto,
  ): Promise<void> {
    await this.profile.reorder(req.user!.id, dto.orderedIds);
  }

  @Post('photo')
  @ApiOperation({
    summary: 'Upload or replace your profile photo',
    description: `JPEG, PNG, or WebP, up to ${MAX_PHOTO_BYTES / (1024 * 1024)} MB. Replacing an existing photo deletes the old one from storage.`,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 200, type: PhotoResponseDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorResponseDto,
    description: 'PHOTO_STORAGE_NOT_CONFIGURED',
  })
  @ApiResponse({
    status: 413,
    type: ApiErrorResponseDto,
    description: 'PHOTO_TOO_LARGE',
  })
  @ApiResponse({
    status: 415,
    type: ApiErrorResponseDto,
    description: 'PHOTO_TYPE_UNSUPPORTED',
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_PHOTO_BYTES } }),
  )
  async uploadPhoto(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.profile.upsertPhoto(req.user!.id, file);
  }

  @Delete('photo')
  @ApiOperation({ summary: 'Remove your profile photo' })
  @HttpCode(204)
  @ApiResponse({ status: 204, description: 'Removed.' })
  @ApiResponse({
    status: 404,
    type: ApiErrorResponseDto,
    description: 'PHOTO_NOT_FOUND',
  })
  async removePhoto(@Req() req: Request): Promise<void> {
    await this.profile.removePhoto(req.user!.id);
  }
}
