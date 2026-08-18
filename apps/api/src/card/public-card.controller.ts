import { Controller, Get, Param, Res, UseFilters } from "@nestjs/common";
import type { Response } from "express";
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CardService } from "./card.service";
import { ApiExceptionFilter } from "../common/filters/api-exception.filter";

/**
 * Unauthenticated read surface for published cards — this is what a stranger
 * hits after scanning a QR or opening a shared link.
 *
 * Deliberately has no `@UseGuards(JwtAuthGuard)`: guards in this codebase are
 * applied per controller, so a public controller is simply one without it.
 * Equally deliberately, it returns only the snapshot — never the owner id,
 * card name, type or sensitivity flag.
 */
@ApiTags("Public cards")
@UseFilters(ApiExceptionFilter)
@Controller({ path: "public/cards", version: "1" })
export class PublicCardController {
  constructor(private readonly cards: CardService) {}

  @Get(":slug")
  @ApiOperation({ summary: "Read a published card by its public slug" })
  @ApiOkResponse({
    description: "Published card snapshot",
    schema: {
      type: "object",
      properties: {
        slug: { type: "string", example: "vansh-work-k7qm9x2r" },
        snapshot: { type: "object", additionalProperties: true },
        publishedAt: { type: "string", format: "date-time", nullable: true },
      },
    },
  })
  @ApiNotFoundResponse({
    description:
      "Unknown slug, or a slug whose card is currently unpublished — the two are intentionally indistinguishable.",
  })
  async get(
    @Param("slug") slug: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const card = await this.cards.getPublishedBySlug(slug);

    // Short cache: a republish should show up quickly, but a card doing the
    // rounds at an event shouldn't hit the database once per scan.
    res.setHeader(
      "Cache-Control",
      "public, max-age=60, stale-while-revalidate=300",
    );

    return card;
  }
}
