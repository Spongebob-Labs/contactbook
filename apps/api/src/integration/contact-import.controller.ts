import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
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
  @ApiOkResponse({
    description: "List of imported contacts",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          source: { type: "string", example: "GOOGLE" },
          externalId: { type: "string", nullable: true },
          firstName: { type: "string", nullable: true },
          lastName: { type: "string", nullable: true },
          mainPhone: { type: "string", nullable: true },
          mainEmail: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
    },
  })
  list(@CurrentUser() user: JwtUserPayload) {
    return this.imports.list(user.sub);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get one imported contact" })
  @ApiOkResponse({
    description: "Imported contact details",
    schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        userId: { type: "string" },
        source: { type: "string", example: "GOOGLE" },
        externalId: { type: "string", nullable: true },
        firstName: { type: "string", nullable: true },
        lastName: { type: "string", nullable: true },
        mainPhone: { type: "string", nullable: true },
        mainEmail: { type: "string", nullable: true },
        createdAt: { type: "string", format: "date-time" },
      },
    },
  })
  get(
    @CurrentUser() user: JwtUserPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.imports.get(user.sub, id);
  }
}
