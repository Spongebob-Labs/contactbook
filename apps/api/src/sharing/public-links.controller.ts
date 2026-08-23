import { Controller, Get, Header, Param } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ShareLinksService } from './share-links.service';

/**
 * The one controller in this app with no auth guard by design — this is
 * what a recipient's phone actually hits. Excluded from Swagger: it isn't
 * part of the "authenticated owner" API surface Swagger documents, and its
 * shape is deliberately minimal/stable for a plain fetch, not for API
 * exploration. See docs/architecture/lld.md §3 "Representative payloads"
 * for the documented shape instead.
 *
 * no-store on every response: architecture invariant #2 — nothing here may
 * ever be served from a cache. A CDN or browser caching this for even a
 * minute breaks "edit a field and the link updates immediately."
 */
@ApiExcludeController()
@Controller({ path: 'public/links', version: '1' })
export class PublicLinksController {
  constructor(private readonly shareLinks: ShareLinksService) {}

  @Get(':token')
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async resolve(@Param('token') token: string) {
    return this.shareLinks.resolvePublic(token);
  }
}
