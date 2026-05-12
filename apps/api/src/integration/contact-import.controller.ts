import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { JwtUserPayload } from "../common/decorators/current-user.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Prisma } from "@prisma/client";
import { ContactImportService } from "./contact-import.service";
import { PatchContactImportDto } from "./dto/patch-contact-import.dto";

@ApiTags("Integrations / Contact imports")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard)
@Controller({ path: "integrations/contact-imports", version: "1" })
export class ContactImportController {
  constructor(private readonly imports: ContactImportService) {}

  @Get()
  @ApiOperation({ summary: "List imported contacts" })
  list(@CurrentUser() user: JwtUserPayload) {
    return this.imports.list(user.sub);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update userOverrides for merge on next sync" })
  patch(
    @CurrentUser() user: JwtUserPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PatchContactImportDto,
  ) {
    return this.imports.patchOverrides(
      user.sub,
      id,
      dto.userOverrides as Prisma.JsonValue,
    );
  }
}
