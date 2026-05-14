import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { JwtUserPayload } from "../common/decorators/current-user.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ContactImportService } from "./contact-import.service";

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

  @Get(":id")
  @ApiOperation({ summary: "Get one imported contact" })
  get(
    @CurrentUser() user: JwtUserPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.imports.get(user.sub, id);
  }
}
