# `opengraph-image.tsx` was removed here, deliberately

It generated the link-preview image for `/c/[slug]` by resolving a **fixture** card whose `slug`
matched the URL. That was fine while the whole app ran on fixtures. It is not fine now:

- the page itself no longer serves fixture data, so the preview and the page would disagree;
- worse, a link pasted into WhatsApp or Slack would render *somebody else's fixture card* as the
  preview for a stranger's link — misleading content, published outward, from a route that is
  otherwise honest about not being live.

Rebuilding it needs the same thing the page needs: the public-card endpoint
(`docs/INTEGRATION.md` **ask #1**). The image has to draw the real card, and only that endpoint
can say what the real card is.

When ask #1 ships, restore this file using `fetchPublicCard` in `src/lib/api/public-card.ts` as
the data source — the same call the page uses, so the preview and the page cannot diverge again.
The original implementation is in git history if the layout is worth recovering.
