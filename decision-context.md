# Decision Context

## 2026-07-19 - Light Mode Text Contrast Pass

- Decision: Replace hardcoded dark-only utilities (`text-white/*`, `bg-white/*`, `border-white/*`, `text-[#6B7280]`) on Dashboard, Profile, Cards, Card Detail, Contacts, Import, and shared import options with semantic tokens (`text-muted-foreground`, `bg-muted`, `border-border`, `border-border-strong`, `bg-bg-hover`).
- Reason: Warm Brass hub UI looked correct in dark mode but tertiary labels/chips/dividers camouflaged or vanished in light mode.
- Notes: UI-only class swaps; no layout or API changes. CSS `.title-display` / `.label-section` already used tokens.
- Files: `dashboard-page.tsx`, `profile-page.tsx`, `cards-page.tsx`, `card-detail-page.tsx`, `contacts-page.tsx`, `import-page.tsx`, `contact-import-options.tsx`, `decision-context.md`.

## 2026-07-19 - Floating App Sidebar

- Decision: Rebuild the desktop sidebar as a floating rounded rail (inset from viewport, soft shadow, no hard edge border). Collapse uses an in-header `PanelLeftClose` when expanded and a circular edge chevron when collapsed (plus Workspace header `PanelLeft` control). Keep ContactBook nav, groups, and mobile drawer content unchanged.
- Reason: Edge-docked sidebar with a glitchy seam toggle felt unfinished next to Warm Brass pages; user references wanted a professional floating panel / icon-rail aesthetic.
- Notes: UI-only in `app-shell.tsx`. Content padding tracks sidebar width + inset via `--shell-pad`. Soft ring via shadow, not `border-r`.
- Files: `app-shell.tsx`, `decision-context.md`.
- Alternatives considered: Docked rail with only a seam toggle — rejected (looked glitchy). Changing nav labels/routes — out of scope.

## 2026-07-18 - Contacts + Import Warm Brass Revamp

- Decision: Align Contacts list and Import hub with the Warm Brass + React Bits language from Dashboard/Profile/Cards. Demote sample data to an inline chip; use SplitText headers, CountUp metrics, source pill chips, rounded table surface, and SpotlightCard import panels. Demote iCloud to a footer note in shared `ContactImportOptions`.
- Reason: Contacts and Import still used the older flat SaaS shell (full sample banner, plain titles, 4-up stat tiles) while sibling pages already shipped the brass hub pattern.
- Notes:
  - UI-only: no route/API/schema changes. Contact detail page left as a follow-up.
  - Reused existing SplitText, CountUp, SpotlightCard — no new dependencies.
  - Source filter on Contacts is pill chips; tag/group/search remain Selects. Table stays a data table (not a gallery).
  - Shared `ContactImportOptions` visual upgrade also applies to onboarding (intentional).
- Files: `contacts-page.tsx`, `import-page.tsx`, `contact-import-options.tsx`, `SpotlightCard.tsx` (h-full inner), `decision-context.md`.
- Alternatives considered: Turning Contacts into Spotlight row cards — rejected (list density). New React Bits deps — skipped (reuse existing).

## 2026-07-18 - Profile + Cards Identity Hub Revamp

- Decision: Rebuild Profile as an identity hub (hero + completeness + grouped tab sections) and Cards as a Spotlight gallery (type filters, always-visible Open/Share, no hover-flip). Light brass pass on Card Detail.
- Reason: Profile felt like a settings dump and Cards felt like a muted flip grid; both needed to match the shipped dashboard Warm Brass language for client delivery.
- Notes:
  - UI-only: no route/API/schema changes. Edit/create still use onboarding query params; Open stays `/dashboard/cards/:cardId`.
  - Shared `getProfileCompletion` / `getMissingProfileSections` extracted to `lib/profile-completion.ts` for Dashboard + Profile.
  - Sample data demoted to inline chips. Card Detail: no watermark/foil/teal shadows; brass chips and section surfaces.
- Files: `profile-page.tsx`, `cards-page.tsx`, `card-detail-page.tsx`, `lib/profile-completion.ts`, `dashboard-page.tsx` (import helper), `decision-context.md`.
- Alternatives considered: Keeping flip on Cards — rejected (touch-hostile, hid actions). New profile field editors — out of scope.

## 2026-07-18 - Dashboard Personal Hub Revamp

- Decision: Rebuild the dashboard as a personal sharing hub: greeting header, slim inline CountUp stats, SpotlightCard card grid, profile completion + Quick Share bottom row. Remove large stat boxes, full-width sample banner, Helpful tips, and Classic/Story mode switch.
- Reason: Dashboard was metrics-heavy with weak hierarchy; cards are the product centerpiece and need premium treatment with brass design system.
- Notes:
  - ReactBits: SpotlightCard + CountUp (via `motion`); lightweight SplitText without GSAP Club plugin.
  - Sample data is an inline chip under the greeting. QR is a placeholder mark; Share/Copy use existing card share helpers.
  - Data fetching, onboarding modals, and post-setup nudges preserved; nudge targets rewired to New card / Complete profile.
- Files: `dashboard-page.tsx`, `components/ui/SpotlightCard.tsx`, `CountUp.tsx`, `SplitText.tsx`, `package.json` (`motion`), `decision-context.md`.
- Alternatives considered: Full GSAP SplitText — skipped (Club plugin). Keeping Classic/Story modes — removed for a single clear hierarchy.

## 2026-07-18 - Warm Brass App Design System

- Decision: Overhaul authenticated-app visual tokens to Warm Brass (CardStack-inspired): page `#0C0D0F`, surface `#17181C`, accent `#C8B89A`, DM Sans headings + Inter body. Public marketing teal pages remain unchanged.
- Reason: Replace templated teal/mint SaaS look with a professional brass system while keeping routes, data, and public brand surfaces intact.
- Notes:
  - Tokens remapped in `styles.css` (`.dark` + brass-adapted light `:root`); helpers `accent-subtle`, `accent-border`, `sidebar`, etc.
  - Fonts: `@fontsource/dm-sans` + `@fontsource/inter` (Geist removed).
  - Components: button (no glow), badge, alert, card, sample notice, segmented tabs, app-shell sidebar, dashboard stats, card previews, card detail, logo/favicon theme color.
  - Featured cards use brass top border + accent-border; left foil ribbons and watermarks removed from list previews.
- Files: `styles.css`, `main.tsx`, `package.json`, `index.html`, `site.webmanifest`, `app-logo.svg`, `favicon.svg`, `app-shell.tsx`, `button.tsx`, `badge.tsx`, `card.tsx`, `alert.tsx`, `sample-data-notice.tsx`, `segmented-tabs.tsx`, `card-styles.ts`, `dashboard-page.tsx`, `cards-page.tsx`, `card-detail-page.tsx`, `decision-context.md`.
- Alternatives considered: Retinting public marketing pages — deferred (scope 1A). Forcing dark-only app theme — deferred; light mode kept as warm neutrals.

## 2026-07-18 - Contact Card Flip Fix And Professional Preview Layout

- Decision: Fix broken 3-D card flip stacking and restructure Cards/Dashboard contact card previews into a centered professional identity layout.
- Reason: Back faces were missing `card-face card-face-back`, so Open/Share and identity content rendered on top of the front detail grid. Users asked for no overlapping layers and a cleaner shareable-card structure aligned with the existing dark design system.
- Notes:
  - Flip CSS: `.card-flip-inner` now fills scene height; `.card-face-back` only applies the Y rotation (positioning comes from `.card-face`).
  - Front layout: brand + type badge header, centered avatar/name/role, two-column detail grid, footer meta. Giant watermark and corner ornament removed from list previews to stop visual collision.
  - Actions stay on the flip back only. Same treatment on Cards page and Dashboard so the bug cannot recur on either surface.
  - Card Detail page watermark treatment left unchanged.
- Files: `apps/web/src/styles.css`, `apps/web/src/pages/cards-page.tsx`, `apps/web/src/pages/dashboard-page.tsx`, `decision-context.md`.
- Alternatives considered: Dropping flip entirely for always-visible actions — rejected so interaction depth stays; adapting the light public-card reference 1:1 — rejected to keep ContactBook dark tokens.

## 2026-07-17 - Auth Bypass For Dashboard Viewing

- Decision: Comment out all auth-related routing, protected route checks, and session bootstrapping so the dashboard is directly accessible without authentication.
- Reason: User wants to view the full dashboard and internal working without going through WhatsApp OTP sign-in.
- Files affected: `apps/web/src/App.tsx`, `apps/web/src/components/protected-route.tsx`, `apps/web/src/pages/landing-page.tsx`, `apps/web/src/context/auth-context.tsx`
- Notes: All original auth code is commented out (not deleted) for easy restoration. Landing page "Get started" buttons now link to `/dashboard`. TypeScript lint passes cleanly.

## 2026-06-02 - Contact Detail Inline Tag And Group Creation

- Decision: Add inline create-and-assign controls inside the Contact Detail `Tags & groups` card for both tags and groups.
- Reason: Users naturally decide to label or group a contact while viewing that contact. Creating the tag/group and immediately assigning it avoids a separate management flow and keeps the contact as the center of action.
- Notes: New tags use `POST /v1/contacts/tags` followed by `PUT /v1/contacts/:id/tags`; new groups use `POST /v1/contacts/groups` followed by `PUT /v1/contacts/:id/groups`. Backend code and browser testing remain untouched.

## 2026-06-02 - Contacts Source Filter Availability

- Decision: Keep Contacts page source filter options static and limited to `All sources`, `Google`, and `vCard` until the backend provides Contacts-list source facets.
- Reason: The current backend does not expose source counts scoped to the Contacts list query. Import summary is too broad, and current-page inference is too narrow after filtering. Google and VCF are the currently supported source filters.
- Notes: Backend code and browser testing remain untouched. Replace this temporary static list with `GET /v1/contacts` source facets when available.

## 2026-06-02 - Contact Tags And Groups Frontend Integration

- Decision: Merge the latest `origin/main` backend contact-label contract into the UI branch and integrate tags/groups through server-side contact filters, contact list chips, sidebar group shortcuts, and contact detail assignment controls.
- Reason: The backend now owns contact tag/group CRUD and `tagIds`/`groupIds` AND filters. Keeping the list server-paginated preserves the current Contacts page performance and matches the new query contract, while contact detail assignment avoids dense inline row editing.
- Notes: Frontend source enums now follow the backend `GOOGLE`, `ICLOUD`, `VCARD`, and `CONTACTBOOK` values. Browser testing remains untouched.
- Alternatives considered: Fetch-all client filtering from `origin/main` was skipped because the current branch already uses backend pagination/sorting and the new backend filters are designed for ID-based server filtering.

## 2026-06-02 - Legal Body Immediate Visibility

- Decision: Remove reveal-animation gating from the post-hero body content on `/terms` and `/privacy` while keeping the hero reveal treatment.
- Reason: The legal body content is essential reading content and must render immediately. Long policy pages were vulnerable to appearing blank below the hero when `public-reveal` content stayed transparent.
- Notes: Styling, copy, routing, backend code, and browser testing remain unchanged.

## 2026-06-02 - Route Scroll Reset

- Decision: Add an app-level route scroll reset that moves the window to the top whenever the React Router pathname changes.
- Reason: Public footer links to `/privacy` and `/terms` were preserving the footer scroll position from the previous page, making the destination page appear at the bottom. Path-based reset restores normal page-navigation behavior while leaving same-page hash anchor navigation untouched.
- Notes: Frontend-only routing behavior update. Backend code and browser testing remain untouched.

## 2026-06-01 - Public Privacy And Terms Pages

- Decision: Add frontend-only public `/privacy` and `/terms` routes with generic interim legal content for ContactBook, and expose both links from the shared public footer across public pages.
- Reason: The landing experience needs accessible Privacy Policy and Terms and Conditions pages before final company-specific legal review. Footer placement keeps legal links consistently available without crowding the public page headers.
- Notes: Content uses ContactBook-specific product concepts from the attached deck, including controlled sharing, contact imports, profile details, essential auth cookies, and no current advertising tracking. The Terms governing law section remains generic pending confirmation. Backend code and browser testing remain untouched.

## 2026-05-28 - Dashboard CTA Spotlight Nudges

- Decision: Replace dashboard nudge modal cards with user-scoped spotlight coachmarks that dim the dashboard, highlight the existing Add card or top Profile stat Review profile CTA, and dismiss when the user clicks outside the highlighted CTA.
- Reason: The nudge should teach users where the native dashboard action lives instead of introducing a separate modal action surface.
- Notes: The post-onboarding `flow=setup` route is consumed with `replace: true`, and dismissal is kept only in the current React session. Backend code and browser testing remain untouched.
- Follow-up: The profile review nudge only appears in the Classic dashboard mode because its target is the top Profile stat card CTA.
- Follow-up: The spotlight callout uses a fully opaque card surface so content behind the overlay does not visually bleed through the nudge.
- Follow-up: Nudge eligibility now comes from consuming the `/dashboard?flow=setup` route after onboarding instead of localStorage, so normal profile edits and later dashboard visits do not replay the nudges.

## 2026-05-28 - Dashboard Post-Onboarding Nudges

- Decision: Add one-at-a-time dismissible dashboard coachmark nudges for adding another card and reviewing profile details, with the dashboard muted behind the visible nudge and background click dismissal handled during the post-onboarding dashboard session.
- Reason: After onboarding, users land on a populated dashboard but still need clear next actions. Overlay nudges focus attention without permanently taking space in the dashboard layout.
- Notes: The profile nudge uses review/edit language when the profile is already complete, and the 100% profile stat should use green/primary styling. Frontend-only change; backend code and browser testing remain untouched.

## 2026-05-28 - Profile Record Card Differentiation

- Decision: Differentiate Profile record cards from shareable ContactBook cards by removing the vertical ribbon and giant watermark initials, replacing them with a subtle fine-line background pattern and a compact top accent rail.
- Reason: Profile records should feel like premium siblings to Dashboard/Cards surfaces, but not look exactly like shareable card previews.
- Notes: The Profile page keeps the same tabs, logo/photo media marks, and two-column detail lists. Cards page remains untouched. Backend code and browser testing remain untouched.

## 2026-05-27 - Profile Record List Details

- Decision: Render Profile record card details as a lightweight two-column list instead of separate boxed mini-cards for each field.
- Reason: Dashboard contact cards use compact list-like details inside one premium card surface; matching that pattern makes Profile cards feel lighter, denser, and more consistent.
- Notes: Card-level structure remains through the premium record card surface and section dividers. Backend code and browser testing remain untouched.

## 2026-05-27 - Premium Profile Record Cards

- Decision: Redesign Profile tab content as premium profile record cards that are visual siblings to Dashboard/Cards contact-card surfaces, and add Profile as a first-class sidebar navigation item.
- Reason: Profile should feel like the same high-quality ContactBook app as Dashboard while remaining a profile-management surface. Work and Business tabs can contain multiple record cards, each led by the saved company or business logo when available.
- Notes: Profile cards use the same dashboard-inspired ingredients: accent ribbon, soft token gradients, rounded metadata, media mark, and structured detail rows. Backend code and browser testing remain untouched.

## 2026-05-27 - Profile Logo Plain Image Presentation

- Decision: Remove the pill-shaped visual container from company and business logo images on the Profile page, leaving only a clean non-clickable image area.
- Reason: Logos should present as brand marks, not as images placed inside a separate pill-shaped UI surface.
- Notes: The surrounding detail row keeps the page's rounded system. Backend code and browser testing remain untouched.

## 2026-05-27 - Profile Logo Border Removal

- Decision: Remove the visible border from company and business logo tiles on the Profile page while keeping the rounded, non-clickable logo presentation.
- Reason: Logo images should read as clean brand marks instead of framed controls or file previews.
- Notes: Styling-only frontend update. Backend code and browser testing remain untouched.

## 2026-05-27 - Profile Page Rounded Pill System

- Decision: Extend the app's rounded circle and pill visual language to the Profile page through the profile avatar, edit action, connected tabs, icon capsules, group badges, empty states, logo tiles, and saved group panels.
- Reason: Dashboard, card, contact, and shell surfaces already use rounded actions, circular avatars, and pill-like metadata. The Profile page should feel visually consistent with those newer surfaces while keeping the main full-page card within the existing card radius system.
- Notes: Styling-only frontend update. Connected tabs, remembered active tab, non-clickable logos, backend code, and browser testing remain unchanged.

## 2026-05-27 - Profile Page Centered Key Tab Content

- Decision: Center the icon, label, and count content inside each connected Profile page tab key.
- Reason: Centered content makes the piano-key tab control feel balanced and clearly tab-like rather than like three row actions.
- Notes: Connected key layout, remembered active tab, and primary green active state remain unchanged. Frontend-only Profile page styling update; backend code and browser testing remain untouched.

## 2026-05-27 - Profile Page Connected Key Tabs

- Decision: Refine the Profile page tabs into a connected piano-key style control with no spacing between tab buttons.
- Reason: The connected shape better communicates that Personal, Work, and Business are mutually exclusive sections where only one tab can be active at a time.
- Notes: Active tab still uses the primary green token. Frontend-only Profile page styling update; backend code and browser testing remain untouched.

## 2026-05-27 - Profile Page Card Tabs Active State

- Decision: Replace the subtle segmented Profile page tabs with larger card-like section buttons and use the primary green token for the selected tab.
- Reason: The previous selected tab state was too understated and did not make the active Personal, Work, or Business section immediately obvious.
- Notes: This is a frontend-only Profile page styling update. Backend code and browser testing remain untouched.

## 2026-05-27 - Profile Page Tabbed Dossier

- Decision: Redesign the Profile page as one full-page card dossier with Personal, Work, and Business tabs that mirror the profile onboarding steps. Remember the selected tab across refreshes in localStorage, and render company/business logos as non-clickable logo tiles instead of link/button-style image actions.
- Reason: Profile details are easier to scan when grouped by the same mental model used during onboarding, and saved logos should feel like brand marks in the UI rather than files to open.
- Notes: This is a frontend-only Profile page update. Backend code and browser testing remain untouched.

## 2026-05-27 - Resumable Setup Starter Cards

- Decision: Make setup starter card creation resumable by card type: any existing `PERSONAL` card satisfies the personal starter, any existing `BUSINESS` card satisfies the business starter, and missing starter types are created as needed. Redirect `/onboarding/card` to `/dashboard` instead of opening the manual card modal.
- Reason: Remote dev backend creates a default `Personal` card during profile onboarding. Frontend setup must recognize that card as the personal starter and create the missing business starter; if profile onboarding is skipped, frontend should still create the missing starter types from the loaded identity.
- Notes: Manual card creation through dashboard/cards page CTAs remains unchanged. Backend code and browser testing remain untouched.

## 2026-05-27 - Dashboard Profile CTA Route

- Decision: Point dashboard profile review CTAs to `/profile` instead of `/dashboard/profile`.
- Reason: The app's routed Profile page lives at `/profile`, so dashboard stat and overview actions should navigate to that existing page instead of an unmatched dashboard subroute.
- Notes: Frontend routing/link fix only. Backend code and browser testing remain untouched.

## 2026-05-27 - Profile Logo Field Layout

- Decision: Rework the profile edit form logo areas so the company and business logo upload controls sit beside two rows of text-only inputs on wider screens, while stacking naturally on smaller screens.
- Reason: The logo upload control is taller than standard text inputs; pairing it with multiple neighboring fields makes the form rhythm intentional and better organized instead of leaving uneven grid height.
- Notes: Upload/delete behavior is unchanged. The company logo area fits five nearby work fields beside the uploader, and the business logo now lives in the More business fields section beside five advanced business fields. Logo upload cards stretch to align with the paired text-field block edges on wider screens, and the remove action sits below the upload target to prevent horizontal overlap. Frontend-only change; backend code and browser testing remain untouched.

## 2026-05-27 - Profile Page Public Logo Images

- Decision: Render saved company and business logo URLs as image previews on the Profile page, while keeping a text fallback for old non-URL logo values.
- Reason: The shared photo API returns public image URLs, so profile read surfaces should display the actual saved images directly instead of showing only clickable URL text.
- Notes: Profile header already displays `identity.profilePhoto`; this change adds equivalent visual handling for work `companyLogo` and business `businessLogo`. Frontend-only change; backend code and browser testing remain untouched.

## 2026-05-27 - Shared Photo Upload Cleanup

- Decision: Upload profile photos, company logos, and business logos through `POST /v1/photo`, store the returned public URL in the frontend profile form, and persist those URLs through the existing profile save payload.
- Reason: The backend now exposes one shared photo API for profile and general images, and the profile update API should remain the source of truth for whether a public image URL is attached to a profile.
- Notes: Removed or replaced saved image URLs are deleted with `DELETE /v1/photo` and body `{ url }` only after the profile save succeeds. Newly uploaded but unsaved image URLs are cleaned up if the user skips/cancels or replaces/removes them before saving. Saved URLs from `GET /v1/profile/me` are rendered directly as public images. Frontend-only change; backend code and browser testing remain untouched.

## 2026-05-27 - Production API Base Domain

- Decision: Update the frontend production `VITE_API_URL` to `https://api.getcontactbook.com/api`.
- Reason: Production frontend API calls should use the public ContactBook API domain while keeping the base URL at the API root, so request paths like `/v1/profile/me` compose to `/api/v1/profile/me` instead of the Swagger docs route.
- Notes: Local dev `.env.local` was also aligned to the same API root because Vite dev mode gives it priority over production env values. Frontend config only. Backend code and browser testing remain untouched.

## 2026-05-26 - Cookie-Tolerant Auth Profile Refresh

- Decision: Change auth `refreshUser` to refresh identity through `/v1/profile/me` before making any logout decision, and only mark the session unauthenticated on a confirmed 401.
- Reason: After profile photo upload, the frontend needs to refresh topbar identity, but local/API-domain cookies may be HTTP-only or otherwise unreadable through `document.cookie`. Treating a missing readable `cb_user_id` as logout incorrectly redirected active users to `/auth`.
- Notes: Non-auth profile refresh failures now leave the current auth state intact. Backend code and browser testing remain untouched.

## 2026-05-26 - Profile-Enriched Card Detail Sections

- Decision: Enrich the Card Detail page with frontend-composed profile sections for contact, images, business/work, personal, social, and financial information using the current profile API shape while leaving card API payloads unchanged.
- Reason: The backend card API currently supports the card shell, but the detail page can still preview a richer shareable card by combining that shell with saved profile data. This gives users a better sense of future contact cards without requiring backend changes.
- Notes: Personal cards may show financial entries only in masked form. Business cards do not show financial details. Custom/payment cards show curated profile-derived sections for now until the backend supports user-selected fields per card. Browser testing remains untouched.

## 2026-05-26 - Card Detail Header Simplification

- Decision: Remove the `Card details` badge, duplicate card-name heading, and explanatory preview paragraph from the Card Detail page header.
- Reason: The full-width card surface now carries the card identity and context, so the surrounding page header should stay minimal and action-focused.
- Notes: The redesigned full-width card detail surface, share action, metadata, and backend behavior remain unchanged. Browser testing remains untouched.

## 2026-05-26 - Full Width Card Detail Dossier

- Decision: Remove the separate Card record panel and the internal Live card panel from the Card Detail page, and redesign the page as one full-width premium card dossier containing identity, contact details, metadata chips, and share action inside a single surface.
- Reason: The separate backend record card exposed implementation details and made the detail page feel fragmented. Digital business card references favor clean, organized, share-first presentation inside one polished profile surface.
- Notes: The redesign keeps existing fetch, mock fallback, profile-derived display details, and share behavior. Metadata for type, created, and updated dates now lives inside the main card. Card names are allowed to wrap instead of truncating. Backend code and browser testing remain untouched.

## 2026-05-26 - Dashboard-Style Cards Page Previews

- Decision: Update Cards page previews to match the dashboard card design, including the physical-card surface, vertical ribbon, watermark initials, ContactBook eyebrow, structured detail grid, and compact Open/share actions.
- Reason: The dashboard card treatment is the preferred premium look, and the Cards page should present the same card objects with the same visual quality.
- Notes: Behavior remains unchanged: Cards page still uses the same backend card records, profile-derived display details, detail navigation, and share action. Backend code and browser testing remain untouched.

## 2026-05-26 - Vertical Card Preview Accent Ribbon

- Decision: Replace the horizontal top accent strip on Cards page and Card Detail page card previews with the same vertical left accent ribbon used on dashboard card previews, and remove explanatory preview copy from Card Detail.
- Reason: Shared card surfaces should use one premium physical-card treatment, and the frontend-composed preview explanation was product-internal copy that should not appear in production UI.
- Notes: The vertical ribbon uses shared `cardTypeStyles.foilClassName`, preserving Business, Personal, and Custom accent colors. Backend code and browser testing remain untouched.

## 2026-05-26 - Auth Page Session Detection

- Decision: Let `/auth` run the normal backend session/profile check instead of treating it as a cookie-gated public route.
- Reason: The frontend cannot always read API-domain cookies through `document.cookie`, especially when the local frontend points to a separate backend origin. Checking `/v1/profile/me` lets already logged-in users redirect from `/auth` to the dashboard correctly.
- Notes: Public marketing routes and the OAuth callback still avoid unnecessary session probing when no readable user cookie exists. Backend code and browser testing remain untouched.

## 2026-05-26 - App Logo Favicon And Page Metadata

- Decision: Add a modern ContactBook SVG logo, use it as the app shell logo and favicon, add web app manifest/social metadata, and set route-aware page titles from the router.
- Reason: The app needed production-grade browser metadata and a more distinctive brand mark that fits the living contact-card concept.
- Notes: The SVG mark uses ContactBook green with a contact card and connection motif. Page titles are generic per route, with detail pages titled Card Details and Contact Details. Backend code and browser testing remain untouched.

## 2026-05-26 - Clickable App Brand Lockup

- Decision: Make the app logo and ContactBook title in the shell brand area one clickable link to the dashboard.
- Reason: Users expect both the logo and product name to navigate home, and grouping them improves the click target without changing layout.
- Notes: The link keeps the existing visual treatment with added hover and focus states. Backend code and browser testing remain untouched.

## 2026-05-26 - Topbar Profile Photo Refresh

- Decision: Display the user's saved profile photo in the app topbar profile button and profile submenu, and refresh auth profile identity after profile photo upload/removal or profile save.
- Reason: The shell should reflect the user's current identity immediately after profile updates instead of waiting for a full session reload.
- Notes: Auth context `refreshUser` now refetches `/v1/profile/me` and safely falls back to cookie-only auth if the profile read fails. Backend code and browser testing remain untouched.

## 2026-05-26 - Error Boundary Auto Refresh

- Decision: Let the frontend error boundary automatically refresh the current page up to two times after an unexpected React crash, then fall back to the visible recovery UI.
- Reason: Some transient frontend failures may resolve after a reload, and users should not have to manually click refresh before the app attempts recovery.
- Notes: Retry counts are stored in sessionStorage per current pathname/search to avoid infinite loops. Manual refresh clears the retry counter. Backend code and browser testing remain untouched.

## 2026-05-26 - Custom Contacts Sort Tooltips

- Decision: Replace native browser title tooltips on Contacts sortable headers with instant custom Tailwind tooltips and clearer sorting guidance.
- Reason: Native tooltips are delayed and visually inconsistent. Sortable table headers are less familiar than toolbar controls, so the tooltip should explain both the current ordering and what the next click will do.
- Notes: Tooltip text is visual-only while `aria-label` carries the same meaning for assistive technology. No new dependency was added. Backend code and browser testing remain untouched.

## 2026-05-26 - Contacts Clickable Cursor States

- Decision: Add explicit pointer cursor states to clickable Contacts page controls, including sort header buttons, button-styled links, selects, and pagination buttons.
- Reason: Some clickable controls did not visually switch the mouse cursor on hover, making their interactivity less obvious after moving sorting into column headers.
- Notes: Search input keeps its text cursor, and table rows already had pointer cursor styling. Backend code and browser testing remain untouched.

## 2026-05-26 - Contacts Sort Header Tooltips

- Decision: Add native tooltip text to Contacts page sortable column header buttons.
- Reason: Header sort arrows are compact, so hover text clarifies whether a column is unsorted, sorted ascending, or sorted descending and what the next click will do.
- Notes: No tooltip dependency was added because the app does not currently have a shared tooltip component. Backend code and browser testing remain untouched.

## 2026-05-26 - Contacts Header-Based Sorting

- Decision: Move Contacts page sort controls from separate toolbar inputs into the sortable table headers for Name, Source, and Updated.
- Reason: Sorting belongs to the column being sorted, and header arrows make the active ascending, descending, or unsorted state easier to understand while reducing toolbar clutter.
- Notes: The backend query contract remains unchanged with `sort` and `sortOrder`. Email and Phone remain non-sortable display columns. Browser testing remains untouched.

## 2026-05-26 - Seamless Contacts List Layout

- Decision: Keep the Contacts page title and Import contacts CTA, but remove the duplicated inner list title/description and the card shell around the contacts toolbar/table area.
- Reason: The page-level title already provides context, and flattening the list area makes Contacts feel seamless with the newer dashboard and card page layouts.
- Notes: Filters, search, table rows, empty state, pagination, contact loading, and backend behavior remain unchanged. Browser testing remains untouched.

## 2026-05-26 - Contacts Source Badge Colors

- Decision: Color-code the Contacts page Source column badges by contact source while keeping the rounded pill badge shape.
- Reason: Source badges were visually identical, which made the contact list harder to scan. Type-specific token-based colors make imported sources easier to distinguish without changing table behavior.
- Notes: Google uses primary green, iCloud uses secondary, VCF uses accent, CSV uses success, CalDAV uses warning, and manual stays neutral. Backend code and browser testing remain untouched.

## 2026-05-26 - Contacts And Import Rounded System

- Decision: Extend the circular and pill-shaped visual language to Contacts and Import surfaces, including action buttons, filters, search input, pagination controls, source/status badges, empty-state icons, import option cards, and import status rows.
- Reason: The dashboard, shell, cards, and card detail pages now use rounded brand styling, so Contacts and Import should feel part of the same product system instead of retaining older square controls.
- Notes: This is a styling-only frontend update. Contact loading, filtering, importing, Google sync, VCF upload behavior, backend code, and browser testing remain untouched.

## 2026-05-26 - Type-Colored Contact Card Badges

- Decision: Add shared type-specific badge classes to `card-styles` and apply them to card type badges inside the dashboard, Cards page, and Card Detail contact card UI.
- Reason: The Personal, Business, and Custom badges should visually match their card accents instead of using the same generic secondary badge background.
- Notes: Business badges use primary green, Personal badges use the softer secondary token, and Custom/Payment badges use the warm accent token. Backend code and browser testing remain untouched.

## 2026-05-26 - Brand Green Active Sidebar State

- Decision: Change the selected sidebar navigation pill from the secondary surface token to the primary green brand token with primary foreground text.
- Reason: The active navigation state should clearly match ContactBook's brand color and feel more intentional than the softer secondary highlight.
- Notes: Inactive sidebar items keep their muted pill styling. Backend code and browser testing remain untouched.

## 2026-05-26 - Distinct Card Type Accents

- Decision: Give Business, Personal, and Custom card previews distinct shared accent treatments: Business uses primary teal, Personal uses a softer secondary surface accent, and Custom/Payment keeps the warm accent token.
- Reason: Business and Personal cards previously shared the same primary accent, making them harder to distinguish at a glance. Personal briefly used the darker secondary foreground, but that felt too black against the soft card surface, so it now uses the calmer secondary token treatment.
- Notes: The styling remains centralized in `card-styles`, so dashboard, Cards page, and Card Detail page inherit the same type treatment. Backend code and browser testing remain untouched.

## 2026-05-26 - Cards Page Header Simplification

- Decision: Remove the small `Cards` badge from the Cards page header while keeping per-card type badges on individual card previews.
- Reason: The page title is already clear, and removing the extra label makes the header feel cleaner and less redundant.
- Notes: This is frontend-only and does not change card data, card actions, backend behavior, or browser-tested flows.

## 2026-05-26 - Shared Brand Token Card Styling

- Decision: Remove remaining arbitrary blue/purple/emerald card gradients from the shared card display data and centralize card type styling in a token-based `card-styles` helper used across dashboard, cards page, and card detail page.
- Reason: Card surfaces should use ContactBook's shadcn/Tailwind brand tokens consistently instead of mixing old generic gradient colors with the newer teal/mint/charcoal direction.
- Notes: Card display data now contains content only, while visual treatment comes from `cardTypeStyles`. Backend code and browser testing remain untouched.

## 2026-05-26 - Dashboard Pill Language

- Decision: Extend the rounded pill visual language into dashboard content controls, overview metrics, tip rows, and action buttons while preserving the premium physical-card shape for the contact card previews.
- Reason: The topbar, profile menu, and sidebar now use pill styling, so dashboard controls and supporting rows should feel consistent without making the core card designs look bubbly.
- Notes: The same pill treatment was also applied to Cards page and Card Detail page actions, metadata rows, empty states, and initials badges so card-related surfaces stay visually consistent. Uses existing shadcn/Tailwind tokens and rounded-full styling. Backend code and browser testing remain untouched.

## 2026-05-26 - Fused Dashboard Overview Panel

- Decision: Replace the separate Connections, Cards, and Profile stat cards with one fused ContactBook overview panel containing a relationship summary, compact metric rows, profile readiness visualization, and direct actions.
- Reason: The three separate stat tiles felt generic and fragmented. Combining related readiness metrics into one branded overview makes the dashboard more intuitive, less cluttered, and more custom to ContactBook.
- Notes: Navigation destinations and underlying data remain unchanged. After review, the classic stat cards remain the default because they are easier to scan, while the fused panel is preserved behind a compact Classic/Story switch in the app topbar for comparison. The selected dashboard mode is stored in browser localStorage under `contactbook:dashboard-mode` so the preference persists per browser. The panel uses existing shadcn/Tailwind tokens and CSS-only visual motifs. Backend code and browser testing remain untouched.

## 2026-05-26 - Dashboard Relationship Stat Tiles

- Decision: Redesign the dashboard Connections, Cards, and Profile stat cards as brand-token relationship tiles with stronger hierarchy, icon capsules, subtle token backgrounds, integrated text links, and a profile completion progress bar.
- Reason: The previous stat cards were functional but generic. The dashboard summary should feel more intuitive and visually aligned with the premium ContactBook card direction while preserving the same navigation and data.
- Notes: This remains frontend-only and uses existing shadcn/Tailwind tokens rather than new colors. Backend code and browser testing remain untouched.

## 2026-05-26 - Phase 1 Premium Physical Dashboard Card Treatment

- Decision: Restyle only the dashboard card previews with a premium physical-card illusion using ContactBook brand tokens: teal primary accents, mint/soft muted surfaces, charcoal foregrounds, and a restrained warm accent for custom/payment variants.
- Reason: The first premium attempt used off-brand blue-purple accents and still read like generic dashboard cards. The dashboard should make ContactBook cards feel custom, memorable, and premium while staying inside the shadcn/Tailwind token system.
- Notes: This is the Option 1 direction selected after design research. Backend behavior and card data composition remain unchanged. The dashboard cards section now sits directly on the page instead of inside an outer card wrapper so the premium card previews feel more seamless with the page. Cards page and card detail page are intentionally left for later phases. Backend code and browser testing remain untouched.

## 2026-05-26 - Phase 3 Card Detail Frontend-Composed Preview

- Decision: Revamp the card detail page into a richer full-card preview using the shared frontend display-details builder, while still fetching only the backend card shell and profile display context.
- Reason: Users should be able to inspect a newly created card as a complete shareable contact card even though backend card-specific fields are not available yet.
- Notes: The detail page displays a separate backend record panel for the supported card shell fields and keeps share actions pointed at the existing protected card detail URL. Backend code and browser testing remain untouched.

## 2026-05-26 - Phase 2 Cards Page Frontend-Composed Card UI

- Decision: Apply the frontend-composed shareable card presentation to the Cards page while keeping backend card records limited to `name`, `type`, and timestamps.
- Reason: The Cards page should show all cards as polished, scannable contact cards using the same display-details builder introduced on the dashboard, without waiting for richer backend card fields.
- Notes: The page now loads profile data only as display context and falls back to sample profile data if that read fails. Card creation remains routed through the existing dashboard modal and sends only supported fields. Card detail page remains for the next phase. Backend code and browser testing remain untouched.

## 2026-05-26 - Phase 1 Dashboard Frontend-Composed Card Previews

- Decision: Revamp only the dashboard card previews first, using a reusable frontend display-details builder that combines the backend card shell (`name`, `type`, timestamps) with profile-derived and type-specific fallback details.
- Reason: The backend currently supports card creation with only card name and type, but the home page should still preview cards as real shareable contact cards immediately after creation. Keeping the richer details frontend-composed lets the UI move forward without changing backend contracts.
- Notes: Newly created cards continue to send only `{ name, type }` to `/v1/cards`; the returned shell is inserted into dashboard state and rendered with generated details. Cards page and card detail page are intentionally left for later phases. Backend code and browser testing remain untouched.

## 2026-05-26 - Temporary Logo File Inputs For Profile Forms

- Decision: Replace company and business logo URL inputs in the profile onboarding/edit modal with image file inputs that save only the uploaded file name into the existing `companyLogo` and `businessLogo` string fields while showing a temporary local preview for the current form session.
- Reason: Users should choose a logo through an upload-style control now, but there is not yet a dedicated backend logo upload endpoint and backend code is out of scope. Sending only the filename preserves the current payload shape without storing large data URLs.
- Notes: The selected image preview uses a browser object URL and is revoked when replaced, removed, row-deleted, or when the modal unmounts. Existing saved logo strings display as filenames/values but cannot render an image preview after reload. Backend code and browser testing remain untouched.

## 2026-05-26 - Larger Dashboard Cards With Share Action

- Decision: Make dashboard card tiles larger and add a per-card share icon action that shares the existing protected card detail URL, using the Web Share API when available and clipboard copy as the fallback.
- Reason: The dashboard should make user-created cards feel more prominent and immediately shareable without introducing a new public card URL contract or backend work.
- Notes: The card tile was restructured so opening and sharing are separate controls instead of placing a button inside a link. This remains frontend-only. Backend code and browser testing remain untouched.

## 2026-05-25 - Phase 7 Public Photo Carousel And Remote Image Sources

- Decision: Add real-photo public page visuals using remote Pexels/Unsplash image URLs, a source manifest, and a reusable auto-advancing public image carousel with manual controls and reduced-motion support.
- Reason: The public pages should feel more custom-crafted and more directly related to ContactBook use cases: meeting people, sharing contact details, using phones, and replacing static business-card exchanges. Remote image URLs avoid adding large binary assets to the repository while the manifest keeps source and license context auditable.
- Notes: Images are non-AI stock-photo sources selected from Pexels/Unsplash pages marked free to use. Attribution is recorded in `apps/web/src/assets/public/image-sources.md` but not shown in the UI per product preference. Backend code and browser testing remain untouched.

## 2026-05-25 - Phase 6 Public Site Polish And Fallbacks

- Decision: Polish the public site foundation by making the public shell's default navigation use real public routes, adding official contact details to the shared footer, and separating unknown public-route fallback from unknown dashboard-route fallback.
- Reason: After adding Landing, About, and Contact, the public shell should no longer carry stale section defaults from the early landing draft. Public visitors should land back on the public home page for unknown URLs, while unknown dashboard URLs should continue returning authenticated users to the dashboard.
- Notes: This remains frontend-only. Footer contact details use the official deck phone, email, and ContactID. Backend code and browser testing remain untouched.

## 2026-05-25 - Phase 5 Public Contact Page

- Decision: Add a public `/contact` page using the shared fixed-light public shell, official ContactBook deck contact details, and direct contact actions for phone, email, website, and ContactID.
- Reason: The public site needs a dedicated contact destination, but adding a form would imply backend submission behavior that is not in scope. Direct official contact methods are production-safe and match the deck-provided content.
- Notes: Public navigation now points Contact links to `/contact`. The contact page uses the same deck-inspired curves, large faint typography, and reveal behavior as landing/about while avoiding box-heavy layout. Backend code and browser testing remain untouched.

## 2026-05-25 - Phase 4 Public About Page

- Decision: Add a public `/about` page using the shared public shell, deck-inspired typography/graphics, and official ContactBook themes around connectivity, meaningful relationships, mission, and vision.
- Reason: The public site needs a deeper brand story beyond the landing page while staying aligned with the official deck's theme and avoiding investor-specific pitch content.
- Notes: The original date-specific "By 2023" vision is modernized into current public wording that preserves the meaning without publishing stale timeline language. The About page remains frontend-only, fixed-light, and uses the reusable public reveal behavior. Backend code and browser testing remain untouched.

## 2026-05-25 - Phase 3B Continuous Hero Motion

- Decision: Add continuous, subtle hero motion to the public landing page using CSS keyframes for slow image pan/scale, looping connection-path drawing, staggered node pulsing, and gentle proof-point movement.
- Reason: The hero should feel alive and custom-crafted around the ContactBook connectivity concept, not only animate once on scroll. Keeping the movement slow and varied supports the premium editorial deck feeling without distracting from the headline or CTAs.
- Notes: Continuous motion is scoped to the hero. Scroll-triggered reveals remain for lower sections. `prefers-reduced-motion` disables the looping hero animation and preserves a static accessible version. Backend code and browser testing remain untouched.

## 2026-05-25 - Phase 3A Landing Typography Curves Graphics And Motion

- Decision: Refine the public landing page with deck-matching public fonts, fewer card boxes, curved section transitions, connection-path graphics, faint oversized brand/contact typography, circular contact nodes, and subtle scroll-triggered reveal animations.
- Reason: The first landing redesign still read too much like a boxed SaaS dashboard. The official deck uses a more editorial visual language with large typography, whitespace, contact/connectivity motifs, and soft teal/grey accents, so the public page should feel custom-crafted around the brand idea of staying connected.
- Notes: Public typography uses Times New Roman for display text and Arial for interface/body text, scoped to public pages only. Motion uses IntersectionObserver reveal classes and respects `prefers-reduced-motion`. Decorative graphics avoid generic blobs/orbs and are tied to contact paths, initials, and connectivity. Backend code and browser testing remain untouched.

## 2026-05-25 - Phase 3 Deck-Led Landing Page Redesign

- Decision: Redesign the public landing page around the official ContactBook deck message: "Never lose contact," "the address book that updates itself," connectivity, problems solved, how it works, why it works, use cases, and a contact CTA. Use the deck's city/connectivity image as the hero visual and apply the public fixed-light design tokens throughout.
- Reason: The public first impression should match the deck's theme and feeling while staying customer-facing. Investor-specific funding, valuation, shareholder-value, and old milestone content remains out of the public landing page because it is pitch-deck material and could distract or create review risk.
- Notes: The landing page remains frontend-only, uses the reusable public shell, and keeps About/Contact as later phases. Official copy is adapted where needed for clarity and modern public-site tone without changing the core meaning. Backend code and browser testing remain untouched.

## 2026-05-25 - Phase 2 Public Page Shell

- Decision: Introduce a reusable public page shell with shared header, footer, navigation, and a fixed-light `public-light-theme` CSS scope for marketing pages.
- Reason: Landing, About, and Contact should share the same public chrome and official deck-inspired light theme without depending on the user's app light/dark preference. Keeping this shell separate from the authenticated app shell lets the dashboard/auth/profile theme be updated later without mixing concerns.
- Notes: The landing page now uses the shared public shell, removes the public theme toggle, and keeps its existing main content for the next landing redesign phase. Public shell tokens cascade shadcn-compatible values locally so existing UI primitives remain usable. Backend code and browser testing remain untouched.

## 2026-05-25 - Phase 1 Public ContactBook Theme Tokens

- Decision: Add centralized public-page ContactBook brand tokens to the Tailwind v4 CSS theme while leaving the existing app-wide shadcn tokens and dark-mode app theme unchanged.
- Reason: The public landing/about/contact redesign should match the official deck palette first, but future client color changes should happen by editing token values in one place instead of changing individual page components. Logged-in app pages will keep their current changeable light/dark behavior until a later whole-app theme phase.
- Notes: Public tokens are fixed-light values based on the PPTX palette, including teal, mint, charcoal, grey, white, and light surface colors. Backend code and browser testing remain untouched.

## 2026-05-25 - Add Frontend VCF Import Flow

- Decision: Enable VCF/vCard file import in both the dashboard import page and the onboarding import modal, posting `.vcf` or `.vcard` files up to 50 MB to `POST /v1/contacts/import/vcf` with multipart field `file`.
- Reason: The backend replaced the old generic import endpoint with source-specific imports, and VCF is now an available user-facing contact import option.
- Notes: Keep Google behavior unchanged for this pass. iCloud remains unavailable, so onboarding treats Google plus VCF as the currently available import actions and shows a continue CTA after those actions are complete instead of auto-advancing. Failed VCF uploads must show safe UI feedback and leave the user in control. Backend code and browser testing remain untouched.

## 2026-05-25 - Make VCF Upload CTA Primary

- Decision: Use the primary button treatment for the VCF upload CTA in the shared import option card.
- Reason: VCF upload is now an available import action, so it should not read like a secondary or inactive option beside the other import CTAs.
- Notes: iCloud remains disabled with outline styling. The shared component updates both the dashboard import page and onboarding import modal. Backend code and browser testing remain untouched.

## 2026-05-25 - Plan Product Owner UI Simplification In Phases

- Decision: Implement the product owner feedback in gated frontend-only phases, stopping after each phase for user review before continuing. Use temporary production-safe copy and placeholder visual areas until deck language and approved media are provided.
- Reason: The requested changes affect first impressions, signup, onboarding complexity, card positioning, and dashboard focus. A phased approach keeps review risk low and makes it easier to validate the product direction before broader UI changes.
- Notes: Phase 1 audit found the main frontend touchpoints are `apps/web/src/pages/landing-page.tsx`, `auth-page.tsx`, `profile-onboarding-page.tsx`, `dashboard-page.tsx`, `cards-page.tsx`, `card-onboarding-page.tsx`, `card-detail-page.tsx`, `profile-page.tsx`, and supporting mock/type helpers if needed. Keep the product centered on individuals staying in contact rather than teams or organizations. Preserve automatic creation of two starter cards after onboarding instead of reintroducing the setup card creation wizard. Business logos will use URL entry for now because only profile photo upload endpoints are available. Hide financials from the visible user flow for this simplification pass while preserving safe backend-compatible payload behavior. Backend code and browser testing remain untouched.

## 2026-05-25 - Phase 2 Landing And Auth Simplification

- Decision: Reposition the public landing page around individuals maintaining personal relationships, using temporary production-safe copy and an in-product global relationship visual instead of final approved people imagery. Update the auth phone step so the country code selector and national number appear as one combined phone field while preserving the existing `countryCode` and normalized `phone` request body.
- Reason: Product owner feedback called out clutter, team-oriented language, and a separated country-code experience. This phase improves first impression and login ergonomics without changing backend contracts or waiting on final deck language/media.
- Notes: Keep the page clean, shadcn/Tailwind-based, and free of internal placeholder labels. Backend code and browser testing remain untouched.

## 2026-05-25 - Phase 3 Simplify Personal Onboarding

- Decision: Keep the personal onboarding data model and payload compatibility, but make the first personal step show only the essential contact-card fields first: profile photo, first name, last name, nickname, primary email, verified phone, and home address. Move lower-priority personal fields behind an explicit add-fields control. Make the profile photo area itself the upload target so users do not have to discover a small separate upload button.
- Reason: Product owner feedback described the first contact-card step as abrupt, cluttered, and intimidating. Progressive disclosure reduces first-run friction while preserving access to existing optional fields for users who need them.
- Notes: This remains frontend-only. Existing saved optional values can still be edited by opening the additional-fields section. Backend code and browser testing remain untouched.

## 2026-05-25 - Remove Person-Specific Placeholder And Sample Identity Text

- Decision: Replace person-specific or overly concrete form placeholders in the current signup/onboarding surfaces with neutral helper placeholders, and neutralize visible preview/mock profile identity values that referenced an individual contributor.
- Reason: Placeholder text should guide input without implying a real person's data, a specific locale, or internal sample content in production UI.
- Notes: Remaining `example.com`, `+1 555 010x`, search, and OTP placeholders are generic examples or standard reserved sample values. Backend code and browser testing remain untouched.

## 2026-05-25 - Phase 4 Simplify Work Business And Social Inputs

- Decision: Simplify work and business onboarding screens by showing only the product-owner-approved essentials first, moving secondary details behind add-fields controls, and removing the standalone socials step from the visible wizard. Keep social data in the existing `socials` payload shape by editing the first social row from the relevant personal/business sections.
- Reason: Users should not have to understand profile categories or maintain a separate socials page during onboarding. Integrating Facebook/Instagram-style personal links and LinkedIn/business web links beside the cards they belong to keeps the flow clearer without changing backend contracts.
- Notes: Business logo remains a URL field because only profile photo upload endpoints exist. Business description is stored as a custom business field. Existing hidden work/business/social values remain in form state and payloads for compatibility. Backend code and browser testing remain untouched.

## 2026-05-25 - Restrict Auth Phone Inputs To Dialing Characters

- Decision: Sanitize the auth phone step while users type or paste so country code accepts only `+` plus digits and the national phone field accepts digits only.
- Reason: The combined phone input should prevent accidental letters, spaces, and punctuation before submit while preserving the backend contract of separate `countryCode` and normalized `phone` values.
- Notes: Keep `inputMode="tel"` instead of `type="number"` because country codes need a plus sign and browser number inputs have inconsistent formatting behavior. Backend code and browser testing remain untouched.

## 2026-05-25 - Phase 5 Hide Financial Surfaces

- Decision: Remove financial/payment surfaces from the visible frontend flow for now: hide financial onboarding, hide financial profile summaries/details, and replace payment-card wording with neutral card wording. Preserve existing financial types, hydration, validation, and payload-building code so old data remains compatible and backend contracts are unchanged.
- Reason: Product owner feedback asked to omit financials to reduce user overwhelm and keep the app focused on personal/business contact cards.
- Notes: This is a visibility and copy change only. Dashboard setup detection now ignores hidden financial-only data so completion behavior reflects the visible profile surface. Backend code and browser testing remain untouched.

## 2026-05-25 - Phase 6 Refine Dashboard Around Cards Connections And Completion

- Decision: Reshape the dashboard into summary metrics for connections, cards, and profile completion; add compact visible card tiles; and replace the setup-style checklist with profile completion and lightweight sharing tips.
- Reason: Product owner feedback asked for a cleaner dashboard that highlights cards created by the user, connection count, profile completion status, and helpful guidance without overwhelming first-time users.
- Notes: Dashboard card tiles link to card details but keep full card management on the cards page. Profile completion is calculated from visible profile areas only and ignores hidden financial data. Backend code and browser testing remain untouched.

## 2026-05-25 - Phase 7 Clean Up Remaining Copy And Flow Mismatches

- Decision: Remove remaining standalone socials presentation from the profile page by showing Facebook/Instagram with personal details and LinkedIn/website with business details. Align the signed-in preview with the current three-step profile setup and make profile initialization checks ignore hidden financial-only data.
- Reason: Social links now belong to the relevant personal or business profile context, and hidden financial data should not affect visible onboarding state after financials were removed from the user flow.
- Notes: The underlying `socials` and `financial` payload shapes remain unchanged for backend compatibility. Backend code and browser testing remain untouched.

## 2026-05-25 - Remove Signed-In Redesign Preview Route

- Decision: Delete the obsolete signed-in redesign preview page and remove its `/dashboard/ui-preview/:screen?` route from the app.
- Reason: The preview was a temporary design artifact and now duplicates stale flow concepts after the real dashboard/profile/onboarding pages were updated.
- Notes: The dedicated theme preview route remains available. Backend code and browser testing remain untouched.

## 2026-05-25 - Tighten Google Import Connected State

- Decision: Stop treating existing Google contact rows, last sync timestamps, or sample fallback data as proof that Google is connected on the import page. The page now keeps the sync CTA gated behind explicit connection evidence, OAuth success, or a successful sync in the current flow.
- Reason: Imported contact history and live Google authorization are different states; showing `Sync contacts` before the user has connected Google is misleading.
- Notes: This is frontend-only and preserves the existing contacts list and import summary display. Backend code and browser testing remain untouched.

## 2026-05-25 - Preserve ContactBook Auth After Google OAuth Callback

- Decision: After Google provider tokens are linked successfully, explicitly mark the ContactBook frontend session as authenticated before cleaning up the temporary Supabase OAuth session and navigating back to the import page.
- Reason: `/auth/callback` is a public route, so the auth context can mark the app unauthenticated during the Google OAuth handoff even though the ContactBook backend session is still valid. The protected dashboard route then redirects to `/auth` after a successful link.
- Notes: This keeps Supabase OAuth scoped to Google token capture and leaves ContactBook WhatsApp/session cookies as the app auth source. Backend code and browser testing remain untouched.

## 2026-05-25 - Apply Approved Deck Language To Consumer Copy

- Decision: Use `ContactBook About Us v1.pdf` as the approved language source for consumer-facing copy, emphasizing `Never lose contact`, `the address book that updates itself`, outdated/incomplete/duplicated contact details, and the Connect/Control/Current/Concise/Complete/Secure value pillars.
- Reason: Product owner feedback said the deck contains the correct language and the temporary copy should be aligned to it.
- Notes: Corporate/investor sections from the deck remain out of the primary consumer UI for now so the product stays focused on individuals maintaining relationships. Backend code and browser testing remain untouched.

## 2026-05-22 - Auto-Create Starter Cards During Setup

- Decision: After setup profile onboarding saves, automatically create two starter card shells from the entered identity: a personal card named from first and last name, and a business card named with a `- Work` suffix. Skip the manual create-card modal in setup flow while keeping manual card creation unchanged elsewhere.
- Reason: The current card API stores card `name` and `type` only, so the safest production behavior is to create useful starter shells immediately without implying that profile fields are mapped into card contents.
- Notes: The frontend checks existing live cards by normalized name and type before creating to avoid duplicates when setup is revisited. If starter card creation fails, profile onboarding still completes and the user sees a friendly retry-later message. Backend code and browser testing remain untouched.

## 2026-05-22 - Return To Cards Page After Card Creation

- Decision: When card creation is launched from the cards page, include `returnTo=/dashboard/cards` and redirect back to that page after a successful create. Keep setup/onboarding card creation returning to the dashboard.
- Reason: Users creating a card from the card list expect to land back in that list, while onboarding should still continue through the setup dashboard flow.
- Notes: This is frontend-only and preserves the shared card creation modal.

## 2026-05-22 - Remove Card Detail Metadata Panel

- Decision: Remove the right-side metadata panel from the card detail page and replace developer-oriented API copy with product-facing card detail copy.
- Reason: Card detail should focus on the user-facing card preview rather than exposing implementation metadata such as IDs and API field labels.
- Notes: This is frontend-only and does not change card data fetching or card creation behavior.

## 2026-05-22 - Add Safe Read-Only Mock Fallbacks

- Decision: Add frontend-only sample data fallbacks for read-only page data when live reads fail, with a visible sample-data notice on affected pages, while leaving mutations/auth/sync/upload/delete actions dependent on the live server.
- Reason: The app should remain navigable and understandable when the server is unavailable, but it must not imply that writes or integrations succeeded without a real backend response.
- Notes: Dashboard, contacts, contact detail, cards, card detail, profile, and import status can show clearly labeled sample data. User-facing errors now use simple non-technical messages while detailed errors are logged to the console. Public home/auth routes skip unnecessary profile bootstrapping when there is no session cookie, and the error boundary includes a Go home action. Backend code and browser testing remain untouched.

## 2026-05-22 - Adopt Paginated Contacts API In Frontend

- Decision: Update contacts-related frontend reads for the new `GET /v1/contacts` response shape `{ items, page, limit, total, totalPages }`, and move the Contacts page table to server-side search, source filtering, sorting, and pagination using TanStack Table for row/column rendering.
- Reason: The backend now paginates and searches contacts directly, so the frontend should stop fetching all contacts and applying table controls locally.
- Notes: Contacts page search is debounced, page size is capped to the backend-supported 100 rows, dashboard/import callers now read `items` plus `total`, and the global-looking Contacts page last-sync label was removed because a paginated page should not imply a complete sync summary. Backend code and browser testing remain untouched.

## 2026-05-22 - Use Dedicated Profile Photo Upload Endpoints

- Decision: Merge latest `origin/dev` into `feat/ui-creation` to bring PR 28's profile photo backend endpoints, then update the frontend profile photo control to upload JPEG, PNG, or WebP files up to 1 MB via `POST /v1/profile/me/photo` and delete via `DELETE /v1/profile/me/photo`.
- Reason: The backend now stores profile photos in GCS and only accepts managed profile photo URLs in `identity.profilePhoto`, so the frontend should stop converting images to base64 data URLs inside the profile save payload.
- Notes: Replacing a photo uses the same upload endpoint and relies on the backend to remove the previous object. Backend files changed only through the `origin/dev` fast-forward merge; manual edits are frontend-only. Browser testing remains skipped per project instruction.

## 2026-05-21 - Mirror WhatsApp OTP Request Validation

- Decision: Update the auth phone form validation and phone helper to mirror `POST /v1/auth/whatsapp/request-code` constraints: country code must be `+` plus 1-4 digits and the normalized national phone must be 4-15 digits.
- Reason: The frontend previously allowed loosely validated phone input and used a stricter local minimum than the backend, so users could see avoidable API errors or inconsistent validation behavior.
- Notes: The phone field still accepts formatted input, then strips non-digits and leading zeros before validation/submission. Backend code and browser testing remain untouched.

## 2026-05-21 - Dedupe Dashboard Refresh API Calls

- Decision: Add in-memory GET request deduping/caching to the frontend API helper and have `AppShell` read the profile menu identity from `AuthProvider` instead of fetching `/v1/profile/me` separately.
- Reason: Dashboard refresh triggered overlapping profile requests from auth bootstrapping, the shell, dashboard overview, and sometimes onboarding modals; React dev StrictMode can double those effects and make the network panel show many duplicate calls.
- Notes: Successful GET responses are reused until a non-GET mutation clears the cache. Dashboard still fetches the full profile for overview state. Backend code and browser testing remain untouched.

## 2026-05-21 - Separate First-Time Profile POST Payload

- Decision: Add a dedicated first-time onboarding payload for `POST /v1/profile/onboarding` that sends the loaded registration identity, omits blank generated IDs, and filters default-only repeatable rows.
- Reason: The onboarding endpoint requires identity fields to match registration and creates new profile groups/fields itself; sending edited identity values or default tag-only rows can fail the POST or create empty groups.
- Notes: After a successful first-time POST, edited identity fields are persisted with a follow-up `PATCH /v1/profile/me`. Later profile edits continue using the normal PATCH payload. Backend code and browser testing remain untouched.

## 2026-05-21 - Make Year Of Birth Derived Read-Only

- Decision: Keep Year of birth visible in the profile onboarding/edit form as a read-only value derived from Date of birth, and stop sending `personal.yearOfBirth` in the profile save payload.
- Reason: The backend derives `yearOfBirth` from the saved `dateOfBirth` field and ignores it as an independently editable top-level personal value.
- Notes: Hydration still falls back to the API-returned `yearOfBirth`, but changing or clearing Date of birth updates the displayed year locally. Backend code and browser testing remain untouched.

## 2026-05-21 - Display Complete Profile GET Fields

- Decision: Expand the frontend profile page to display all onboarding fields available from `GET /v1/profile/me`, including personal scalar fields, broader work/business fields, top-level social fields, and custom fallback values.
- Reason: The profile page previously showed only a subset of saved onboarding data, so fields like date of birth, mobile, landline, work contact details, and business metadata could be saved but not visible.
- Notes: The display reads normalized top-level response keys first and then falls back to `custom` keys for compatibility with existing saved records. Backend code and browser testing remain untouched.

## 2026-05-21 - Omit Blank Profile IDs On Save

- Decision: Change the frontend profile save payload to omit empty `groupId` and `fieldId` values instead of sending `null`, and omit blank personal scalar/custom values until a personal group exists.
- Reason: The profile PATCH backend treats `null` values inside `personal` as clear-field instructions. On a new personal section, `personal.groupId: null` or blank personal values serialized as `null` can make the backend return before creating the personal group, so personal form values are not saved.
- Notes: Existing personal groups still send `null` for cleared fields so edit-time clearing behavior is preserved. Backend code and browser testing remain untouched.

## 2026-05-21 - Send Supported Personal Fields Top-Level

- Decision: Change the frontend profile payload so backend-supported personal fields are sent as top-level `personal` properties, while extra personal fields remain in `personal.custom`.
- Reason: The deployed PATCH response accepted other sections but returned an empty personal section when all personal scalar fields were nested under `custom`.
- Notes: This is frontend-only and keeps hydration reading both top-level and custom values for compatibility with older saved data.

## 2026-05-21 - Mirror Profile Backend Validation In Form

- Decision: Add frontend validation for profile onboarding/edit fields that mirrors the backend DTO limits, including identity requirements, profile photo payload length, personal postal address lengths, row label lengths, and financial field lengths.
- Reason: Users should see field-level errors before submit instead of receiving a backend 400 after filling the form.
- Notes: The profile modal now shows an error count, displays inline errors after blur, and disables Save until the form satisfies the mirrored constraints. Backend code and browser testing remain untouched.

## 2026-05-21 - Broaden Profile Onboarding Hydration

- Decision: Update the profile onboarding modal mapper to hydrate fields from both normalized top-level `/v1/profile/me` response keys and the `custom` keys used by the current frontend save payload.
- Reason: Saved profile data can come back in different shapes depending on field category and backend flattening, especially social links that may be returned as top-level keys instead of nested custom values.
- Notes: The change is frontend-only, covers personal, work, business, social, address fallback, and existing financial direct-field hydration, and keeps browser testing skipped per project instruction.

## 2026-05-20 - Send Complete Profile Onboarding Shell

- Decision: Build a dedicated frontend payload for `POST /v1/profile/onboarding` that always includes identity, personal, work, business, socials, and financial shells, with empty arrays for empty repeatable sections.
- Reason: The live onboarding API expects a complete first-time setup shape even when users skip optional details; sending `{}` can reach the API and fail with a server error.
- Notes: Normal `PATCH /v1/profile/me` remains compact. The onboarding identity uses the loaded registration values so the backend identity-match guard can pass before any edited identity values are patched separately. Optional shell fields use `null` instead of empty strings.

## 2026-05-20 - Avoid Invalid Empty Profile Fields

- Decision: Send the complete deployed-API-allowed profile payload for profile onboarding and profile patch saves, using `null` for empty optional values and excluding backend-rejected response-only fields.
- Reason: The deployed backend rejects top-level work/business detail fields and financial `isSensitive`, so the frontend must keep those values inside accepted fields while still letting users save partial details.
- Notes: Work and business scalar/address values are sent under `custom`, `profileOnboardingCompletedAt` and financial `isSensitive` are excluded, and both `POST /v1/profile/onboarding` and `PATCH /v1/profile/me` share the same frontend payload builder.

## 2026-05-20 - Resolve PR 21 Profile Onboarding Merge Conflict

- Decision: Merge `origin/dev` into `feat/ui-creation` and resolve the profile onboarding conflict by keeping repeatable profile groups, editable identity fields, optional financial rows, and the latest first-time profile initialization path.
- Reason: PR 21 needed to preserve both branches' user-facing behavior: the feature branch's richer profile form and `dev`'s updated signup setup flow.
- Notes: Backend files came from `origin/dev` through the merge only; conflict edits were limited to frontend profile onboarding and this decision log. Browser testing remains skipped per project instructions.

## 2026-05-20 - Complete Array-Aware Financial Profile Display

- Decision: Update the profile page financial display to prefer `fieldId` keys for repeated financial rows and show optional bank routing fields.
- Reason: Financial rows are field-backed array entries, so `fieldId` is the most stable React key when available, and the live API exposes IBAN, SWIFT/BIC, and routing number values that should be visible when saved.
- Notes: Backend code remains untouched. This is display-only and does not change profile form payload behavior.

## 2026-05-20 - Keep One Visible Row In Repeatable Profile Groups

- Decision: Disable the remove button when a repeatable profile group has only one visible row.
- Reason: The onboarding/edit wizard should keep a stable input surface for array-backed sections, so users clear the last row manually instead of deleting the entire UI for that section.
- Notes: Backend code remains untouched. Payload behavior is unchanged because backend will make partially filled financial row fields optional.

## 2026-05-20 - Support Repeatable Profile Wizard Groups

- Decision: Refactor the shared profile onboarding/edit wizard to support multiple work, business, social, bank account, digital wallet, and crypto wallet rows with add/remove controls.
- Reason: The current profile create/update API accepts arrays for these profile groups, so the UI should let users maintain more than one entry instead of only editing the first saved row.
- Notes: Keep backend code untouched. Keep validation required only for identity fields in the UI; optional repeated rows are omitted when blank, and row labels are shown as `Label` at the end of each group instead of `Group tag`.

## 2026-05-20 - Add Editable Identity Fields To Profile Wizard

- Decision: Show first name, last name, phone number, and email in step 1 of the profile onboarding/edit wizard. Keep first name, last name, and email editable, while rendering phone number as a read-only muted input.
- Reason: Users need to review and correct core registration identity details from the same profile form used after signup and from the edit profile button, but phone number should remain locked because it is the verified account identifier.
- Notes: Backend code remains untouched. For first-time onboarding, section setup still uses `POST /v1/profile/onboarding`; editable identity changes are persisted with `PATCH /v1/profile/me` so the onboarding endpoint's identity-match guard is respected.

## 2026-05-20 - Send Personal Scalars As Custom Profile Fields

- Decision: Keep the personal onboarding UI fields but send mobile, landline, email, date/year of birth, current location, and relationship status under `personal.custom` instead of top-level `personal` keys.
- Reason: The live profile onboarding API rejects those top-level personal properties and currently only accepts `tag`, `postalAddress`, and `custom` for the personal section.
- Notes: Hydration still reads legacy top-level personal values when present, then falls back to `personal.custom`. Empty custom values are omitted from outgoing payloads.

## 2026-05-20 - Make Bank Identity Fields Optional In Profile Form

- Decision: Treat bank name, account holder, and account number as optional in the frontend profile onboarding/edit form and payload.
- Reason: The live profile API does not require those bank account fields, so the form should allow users to save partial bank details instead of blocking on frontend-only validation.
- Notes: Backend code remains untouched. A bank account is still only sent when the user enters at least one non-currency bank detail, so the default `INR` value alone does not create a blank bank record.

## 2026-05-20 - Render Theme Preview Without App Shell Chrome

- Decision: Remove `AppShell` from `/dashboard/theme-preview` so the design preview renders as a standalone full-page mock interface.
- Reason: The authenticated app shell sidebar and topbar visually duplicated the preview's internal shell and made it harder to evaluate the proposed ContactBook UI direction.
- Notes: The route remains protected under `/dashboard/theme-preview`; only the visual wrapper was removed. Production dashboard, backend code, and global theme tokens remain unchanged.

## 2026-05-20 - Prototype Private Contact Memory UI On Theme Preview

- Decision: Redesign only `/dashboard/theme-preview` as a warm, personal ContactBook UI preview using mock data.
- Reason: The user wants to evaluate the private contact memory direction before changing the production dashboard, app shell, or global shadcn theme tokens.
- Notes: Keep backend code untouched, avoid browser testing, preserve existing production routes and handlers, and use the preview to explore warm paper/oat/cream surfaces, deep fern actions, onboarding cards, WhatsApp preview, and a prioritized setup journey.

## 2026-05-20 - Prototype Material-Inspired Theme On Static Signed-In Route

- Decision: Add a protected static preview route at `/dashboard/theme-preview` before changing the working signed-in pages or global theme.
- Reason: The user wants to evaluate a shadcn-professional UI direction with Material 3-inspired tokens before applying it to production flows.
- Notes: The preview must use mock data only, keep backend code untouched, avoid browser testing, preserve the current teal/green brand direction, and explore richer secondary, tertiary, surface, outline, success, warning, and destructive roles locally first.

## 2026-05-19 - Add Signed-In UI Redesign Preview

- Decision: Add a frontend-only signed-in preview route for the proposed setup-console redesign before replacing production dashboard/import/profile screens.
- Reason: The user wants to see the exact coded UI, not an approximate generated image, and asked to approve changes only after seeing a plan first.
- Notes: The preview must use mock data, existing React/Tailwind/shadcn-style components, avoid backend changes, leave the public landing page untouched, and not require browser testing.

## 2026-05-14 - Clone Repository Into Current Folder

- Decision: Cloned `https://github.com/Spongebob-Labs/contactbook` directly into `/Users/rishabhgoyal/Desktop/code/contactbook`.
- Reason: The user requested cloning into the current folder, and the folder was empty before cloning.
- Notes: The repository is checked out on `main` and tracks `origin/main`.

## 2026-05-14 - Create UI Feature Branch From Dev

- Decision: Created `feat/ui-creation` from the current `dev` branch.
- Reason: The user wants UI creation work isolated from `dev` for a production-grade implementation and review.
- Notes: The branch is local only at creation time and has not been pushed yet.

## 2026-05-14 - Sync UI Branch With Latest Dev

- Decision: Fast-forwarded `feat/ui-creation` to latest `origin/dev`.
- Reason: The backend auth and Google import contracts changed on `dev`, and frontend planning should target the current API shape.
- Notes: The updated backend sends session credentials in exposed `X-Contactbook-*` response headers and still expects Bearer tokens on protected routes.

## 2026-05-14 - Adopt Backend HttpOnly Session Cookie Contract

- Decision: Pulled latest `origin/dev` where backend auth now sets `cb_access_token` and `cb_refresh_token` as httpOnly cookies, plus readable `cb_user_id`.
- Reason: The frontend should avoid storing raw JWTs in browser-accessible storage and should call protected APIs with credentialed requests.
- Notes: Protected API auth reads `cb_access_token` from cookies first and still supports Bearer tokens for API clients. Refresh reads `cb_refresh_token` cookie first and `POST /api/v1/auth/logout` clears/revokes the session.

## 2026-05-15 - Replace Web Boilerplate With Vite Frontend

- Decision: Replace the existing Next.js web boilerplate with a fresh React + Vite + TypeScript frontend on port `5173`.
- Reason: The product is an authenticated client-side contact book dashboard and does not need SSR for the MVP. Vite keeps the frontend simpler while preserving production-grade routing, code splitting, and build checks.
- Notes: Reuse only useful helpers such as country dialing data and phone normalization. Backend calls should use `credentials: "include"` with httpOnly ContactBook session cookies.

## 2026-05-15 - Use Supabase Browser OAuth For Google Linking

- Decision: Initiate Google OAuth from the frontend through Supabase, then call `POST /api/v1/integrations/google/link-provider` with provider tokens after the FE callback exchanges the auth code.
- Reason: Backend confirmed the intended Google flow is frontend-owned Supabase OAuth, not the API-owned Google callback route.
- Notes: The frontend will use `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and redirect to `/auth/callback?next=/dashboard/import`.

## 2026-05-15 - Remove Stale Next.js Frontend References

- Decision: Remove leftover empty Next.js directories and update repository documentation/config references to the current Vite React frontend.
- Reason: `apps/web` is now a Vite app on port `5173`; keeping Next.js wording, `NEXT_PUBLIC_*` env names, and port `3002` references would mislead local setup and reviews.
- Notes: The current Vite frontend remains in place. API CORS defaults now include Vite dev origins on `localhost:5173` and `127.0.0.1:5173`.

## 2026-05-15 - Align Registration Payload With Live API Docs

- Decision: Update the frontend registration form and request body to send top-level `firstName` and `lastName` instead of a single `name` field.
- Reason: The live backend OpenAPI document for `POST /api/v1/auth/register` requires `phoneVerificationToken`, `firstName`, `lastName`, `phone`, `countryCode`, and `email`.
- Notes: This is a frontend-only contract alignment. No backend files were changed.

## 2026-05-15 - Decouple Route Auth From Readable User Cookie

- Decision: Add a frontend route-authenticated state that can be marked after successful OTP login or registration, while keeping `userId` populated from `cb_user_id` only when that cookie is readable.
- Reason: The backend can successfully set session cookies while the browser route guard still sees no readable `cb_user_id`, causing an immediate redirect back to `/auth`.
- Notes: API security still depends on backend cookies. The frontend flag only controls client-side route gating after a successful auth response.

## 2026-05-15 - Add Skippable Full Profile Onboarding

- Decision: Route newly registered users to a skippable `/onboarding/profile` flow that captures identity, personal, work, business, social, and financial profile details.
- Reason: Registration only collects compulsory identity fields. A separate onboarding flow lets the product demo the broader ContactBook profile model without blocking account creation.
- Notes: The frontend saves optional sections through the documented `field-groups` and `fields` APIs, creating groups only for sections with entered data. Financial rows are labeled sensitive.

## 2026-05-15 - Add Profile Menu And Profile Detail Page

- Decision: Add a top-bar profile menu with user details, profile navigation, edit-profile navigation, and logout, plus a `/profile` page backed by `GET /api/v1/profile/me`.
- Reason: Authenticated users need a persistent account control surface and a place to review the profile data collected during onboarding.
- Notes: Editing routes to the existing profile builder because the current nested profile response does not expose individual field IDs needed for safe inline patch updates.

## 2026-05-15 - Centralize Account Controls In Top Bar

- Decision: Remove signed-in details and logout controls from the sidebar bottom after adding the top-bar profile menu.
- Reason: Account actions now have a dedicated location, so keeping them in the sidebar duplicates controls and distracts from navigation.
- Notes: Sidebar remains focused on workspace navigation only.

## 2026-05-15 - Simplify Profile Menu Actions

- Decision: Rename the profile menu's "View profile" action to "Profile" and remove the separate "Edit profile" action.
- Reason: The profile page already owns the edit entry point, so the top-bar menu should stay compact and avoid duplicate profile actions.
- Notes: Users can still edit from `/profile` via the page-level edit button.

## 2026-05-15 - Remove Redundant Topbar Context Copy

- Decision: Remove the "Contact workspace" and "Profile and imports" text block from the topbar left side.
- Reason: The sidebar already provides workspace and navigation context, while the topbar is now focused on mobile navigation and account controls.
- Notes: The mobile menu button remains on the left and theme/profile controls remain on the right.

## 2026-05-15 - Remove Sidebar Vertical Divider

- Decision: Remove the hard right border from the sidebar container.
- Reason: The divider created an unwanted vertical cut after the logo area and made the top chrome feel visually split.
- Notes: The sidebar header keeps its bottom border for local structure.

## 2026-05-15 - Unify Top Chrome Background

- Decision: Match the sidebar logo strip background to the main topbar background treatment.
- Reason: The topbar should feel full-width and continuous instead of reading as separate left and right surfaces.
- Notes: The vertical divider stays removed while both top strips keep their shared bottom border.

## 2026-05-15 - Add Public Landing Page Separate From Auth

- Decision: Make `/` a publicly accessible marketing landing page and keep sign-in/sign-up on the separate `/auth` route.
- Reason: Marketing needs a measurable public funnel while the product authentication flow remains focused on account access.
- Notes: The landing page should use ContactBook as the product name with a refreshed visual style, primary `Get started` CTA, secondary `Sign in` CTA, and no pricing or testimonial sections in the first pass.

## 2026-05-15 - Use API-Owned Google OAuth For Imports

- Decision: Change the imports page Google connection flow to request an API-generated Google OAuth URL and let the API callback store Google tokens before redirecting back to the web import page.
- Reason: Google contact import is a backend-owned integration that needs durable OAuth tokens for People API sync, so the token exchange and refresh path should use the same Google OAuth client configured on the API.
- Notes: The frontend remains responsible for starting the flow from `/dashboard/import`; the API redirects back to `WEB_APP_URL` with `google=connected` or `google=error`.

## 2026-05-15 - Force Google Account Selection During Import Linking

- Decision: Add `select_account` to the Google OAuth prompt used by the API-owned import connection flow.
- Reason: Google can otherwise reuse the active Gmail session and link the wrong account for contact import.
- Notes: The OAuth flow still requests consent and offline access so the API can store refreshable Google tokens for People API sync.

## 2026-05-15 - Bootstrap Frontend Auth From Existing Protected API

- Decision: Have the frontend initialize route auth by calling existing protected API data instead of relying only on the readable `cb_user_id` cookie.
- Reason: The web app can run on a different origin from the API, so JavaScript cannot reliably read the API-owned `cb_user_id` cookie after page reloads or Google OAuth redirects even when credentialed API calls still work.
- Notes: This avoids backend changes by using the existing `GET /profile/me` request as the session validation check.

## 2026-05-18 - Refresh Import Page After Failed Google Browser Back

- Decision: Track when Google import OAuth is started and force a clean reload if the import page is restored from browser back/forward cache while that flow is still pending.
- Reason: Failed Google OAuth can leave the browser on an external Google error page; using the back button can restore stale React state instead of re-running the import page cleanly.
- Notes: The reload guard is frontend-only, scoped to `/dashboard/import`, and clears itself on known `google=connected` or `google=error` returns.

## 2026-05-18 - Move Google Import OAuth Back To Frontend Supabase Flow

- Decision: Start Google import linking from the frontend with Supabase `signInWithOAuth`, exchange the callback code in the frontend route, then call the backend only once through `POST /v1/integrations/google/link-provider`.
- Reason: The latest backend on `origin/main` removed the API-owned Google `oauth-url` and `callback` endpoints while keeping encrypted provider-token persistence behind `link-provider`.
- Notes: The frontend requests offline Google access with contacts, calendar, and profile scopes, requires a Supabase `provider_refresh_token` before linking, and signs out the temporary Supabase session after the backend stores credentials.

## 2026-05-18 - Convert Profile Onboarding To Modal Wizard

- Decision: Present profile onboarding as an always-open modal-style wizard on the onboarding route instead of a full-page form/sidebar layout.
- Reason: The user requested a multi-step modal, and keeping it route-owned preserves existing skip/save navigation without introducing a dismissible empty page state.
- Notes: The existing onboarding form state, validation, and frontend API save flow remain unchanged; only the presentation changes.

## 2026-05-18 - Add Safe Google OAuth Callback Failure Reasons

- Decision: Preserve non-secret Google OAuth callback failure reasons in the frontend redirect URL during import linking.
- Reason: The generic `google=error` state hides whether the failure happened during code exchange, provider token extraction, or backend token persistence.
- Notes: Reasons must not include provider tokens, JWTs, or raw backend payloads; they are only coarse diagnostic labels for development and support.

## 2026-05-18 - Use Supabase PKCE Flow For Google Import OAuth

- Decision: Configure the browser Supabase client with `flowType: "pkce"` for Google import linking.
- Reason: The frontend callback exchanges an authorization `code` with `exchangeCodeForSession`, so the OAuth start must use Supabase's PKCE flow rather than an implicit response.
- Notes: This is frontend-only and keeps `detectSessionInUrl` disabled because `/auth/callback` owns the code exchange explicitly.

## 2026-05-18 - Auto-Sync Google Contacts After Successful Link

- Decision: Automatically run the existing Google contact sync after returning from a successful Google OAuth link.
- Reason: Users expect contacts to appear after connecting Google; previously connection only stored OAuth credentials and required a separate manual sync click.
- Notes: Auto-sync is gated by the pending OAuth session marker so refreshing `/dashboard/import?google=connected` does not repeatedly sync contacts.

## 2026-05-18 - Redirect Auth Route For Existing Sessions

- Decision: Redirect authenticated users away from `/auth` after the frontend session bootstrap confirms an active backend session.
- Reason: Signed-in users should not see the sign-in/register page when directly visiting `/auth`.
- Notes: The auth page waits for the shared auth context loading state to finish, then redirects to the original protected route when present or `/dashboard` by default.

## 2026-05-18 - Add Post-Onboarding Contact Import Choice

- Decision: Route users from profile onboarding into an import-choice screen with Google active and iCloud/VCF shown as disabled coming-soon options.
- Reason: Users should be prompted to bring contacts in immediately after signup/profile setup, while unsupported import methods should be visible without implying they are functional.
- Notes: This is frontend-only. Google uses the existing OAuth flow and iCloud/VCF do not call backend endpoints until contracts exist.

## 2026-05-18 - Use Consolidated Profile Onboarding API

- Decision: Save profile onboarding through the new nested `POST /v1/profile/onboarding` API, falling back to `PATCH /v1/profile/me` for photo-only onboarding.
- Reason: Backend simplified profile setup into major profile APIs and removed the need for frontend field-group/field orchestration.
- Notes: The onboarding UI remains unchanged; the frontend now maps form state into the same nested shape returned by `GET /v1/profile/me`.

## 2026-05-18 - Simplify Auth Phone Entry

- Decision: Replace the login country selector with a direct country calling code input plus a separate phone number input.
- Reason: The login page only needs the backend `countryCode` and `phone` values, and the user requested not to ask for country.
- Notes: This is frontend-only. The auth requests still send `{ phone, countryCode }`, and the auth panel now uses explicit bottom padding below the card.

## 2026-05-18 - Use Country Code Combobox On Auth

- Decision: Change the auth country code field from free text to a searchable combobox of de-duplicated dialing codes.
- Reason: The user requested a shadcn-style combobox for country code selection while still not asking for country name.
- Notes: The combobox remains frontend-only and continues to submit the selected dialing code as `countryCode`.

## 2026-05-18 - Show Countries In Auth Code Dropdown

- Decision: Display country names beside dialing codes in the auth country code dropdown while keeping the selected input value as the code only.
- Reason: Country names make shared dialing codes easier to identify without reintroducing a separate country field.
- Notes: Duplicate dialing codes can appear for different countries in the dropdown, but auth requests still submit only the selected `dial` value as `countryCode`.

## 2026-05-18 - Unify Auth Combobox Focus Ring

- Decision: Move the auth country code combobox focus ring from the inner input to the full input/button wrapper.
- Reason: The previous focus highlight ended before the dropdown button, making the active state look visually cut off.
- Notes: The combobox filter now also matches combined labels such as `Canada +1` so selected display text still returns the expected dropdown row.

## 2026-05-18 - Refine Auth Form Spacing

- Decision: Increase and normalize login form spacing by using explicit card padding, larger form gaps, and flex-column labels.
- Reason: The auth form spacing was visually uneven, and inline labels made label/control spacing unreliable.
- Notes: This is frontend-only and keeps the existing auth request payloads unchanged.

## 2026-05-18 - Fold Identity Upload Into Personal Onboarding

- Decision: Remove the standalone Identity onboarding step and move profile photo capture into the Personal step as an image upload control.
- Reason: The user requested removing step one and replacing pasted image URL entry with an upload experience.
- Notes: Backend upload/storage was not added. The selected image is read client-side into the existing `identity.profilePhoto` string field with a 1 MB guard.

## 2026-05-18 - Simplify Onboarding Step Presentation

- Decision: Remove step icons and duplicate section headings/subtitles from the onboarding wizard content.
- Reason: The outer wizard header already provides the active step title and description, and the stepper should be lighter.
- Notes: The wizard now has five steps: Personal, Work, Business, Socials, and Financial.

## 2026-05-18 - Make Onboarding Stepper Text Only

- Decision: Remove the remaining completed-step check icon from the onboarding step navigation.
- Reason: The user requested the stepper show only the step names.
- Notes: Active state remains communicated through border/background styling.

## 2026-05-18 - Center Onboarding Modal In Shell Viewport

- Decision: Adjust the onboarding wrapper to center the modal within the available shell viewport using balanced page padding.
- Reason: The previous shortened height calculation made the modal feel off-center relative to the whole screen.
- Notes: The modal keeps its max width, max height, and internal scroll behavior.

## 2026-05-18 - Remove Onboarding Step Box Navigation

- Decision: Remove the step box navigation and draft-count line below the onboarding heading/subtitle.
- Reason: The user wanted the step boxes removed from the UI.
- Notes: Users still move through onboarding with the footer Back and Next buttons, while the top badge shows the current step number.

## 2026-05-18 - Center Onboarding Modal Against Viewport

- Decision: Render the onboarding modal in a fixed full-viewport overlay instead of centering it inside the app shell content column.
- Reason: The shell sidebar made the modal appear shifted right when it was centered only within the main content area.
- Notes: The modal keeps internal scrolling and now uses a subtle backdrop over the app chrome.

## 2026-05-18 - Compact Onboarding Form Density

- Decision: Reduce onboarding modal padding, input heights, field gaps, panel padding, and use three-column field grids on wide screens.
- Reason: The user wanted more of each onboarding step visible without needing modal scrolling.
- Notes: Compact sizing is scoped to the onboarding modal; internal scrolling remains as a fallback for smaller screens or dense steps.

## 2026-05-18 - Present Import Onboarding As Modal

- Decision: Convert `/onboarding/import` into a fixed viewport-centered modal overlay and add a compact mode for import option cards.
- Reason: The user wanted the import contacts wizard to match the modal-style onboarding experience.
- Notes: Google OAuth behavior, skip navigation, and disabled iCloud/VCF options remain unchanged.

## 2026-05-18 - Feature Google Import In Modal Layout

- Decision: Widen the import onboarding modal and add a featured Google layout where Google spans the full first row and iCloud/VCF split the second row.
- Reason: The user wanted the Google option full width and the remaining two options as half-width stacked rows beneath it.
- Notes: The featured layout is opt-in for onboarding import and does not change the default import options grid elsewhere.

## 2026-05-18 - Narrow Import Onboarding Modal

- Decision: Reduce the import onboarding modal max width while preserving the featured Google layout.
- Reason: The user wanted the modal overall width decreased after the featured layout change.
- Notes: Google remains full-width above the half-width iCloud and VCF cards.

## 2026-05-18 - Further Narrow Import Onboarding Modal

- Decision: Reduce the import onboarding modal max width to `max-w-4xl`.
- Reason: The user wanted the modal overall width decreased further.
- Notes: The featured Google row and half-width iCloud/VCF row remain unchanged.

## 2026-05-18 - Align Google Import OAuth Redirect With Working Supabase Flow

- Decision: Use a plain `/auth/callback` Supabase redirect for Google import OAuth, store the post-callback destination in session storage, and pass Google scopes through `queryParams.scope`.
- Reason: The sibling `alooofone` project successfully uses the same Supabase OAuth pattern with a simple callback URL, while ContactBook's callback query string can require stricter Supabase redirect allow-list entries.
- Notes: Contacts import keeps `https://www.googleapis.com/auth/contacts.readonly`, preserves calendar/profile scopes, and now reports Supabase callback `error` values as a coarse `oauth_error` reason.

## 2026-05-19 - Tolerate Missing Contact Import Status

- Decision: Render imported contacts with a `PENDING` fallback when the API response omits `status`.
- Reason: Production import data can contain rows without a status value, and the import page should not crash while rendering incomplete contact import records.
- Notes: The frontend type now marks import `status` as optional; processed rows still use the success badge and all other statuses use the warning badge.

## 2026-05-19 - Align Import UI With Dev Contact Import API

- Decision: Merge `origin/dev` into `feat/ui-creation` and update the Vite import page to read `firstName`, `lastName`, `mainPhone`, `mainEmail`, `source`, and `createdAt` from contact import rows.
- Reason: The deployed backend and `origin/dev` now return the simplified contact import model instead of the older `displayNameSnapshot`, `status`, `rawPerson`, and sync timestamp fields.
- Notes: The import table now shows contact name, primary phone/email, source, and imported date using frontend fallbacks for missing contact fields.

## 2026-05-19 - Move Import UI To Relational Contacts API

- Decision: Merge the latest `origin/dev` relational contacts backend and update the import page to read summary data from `GET /v1/contacts/import` and Google contacts from `GET /v1/contacts?source=GOOGLE`.
- Reason: The old `GET /v1/integrations/contact-imports` endpoint was removed after Google sync began upserting normalized relational contact records.
- Notes: The sync toast now uses `processedCount` from `GET /v1/integrations/google/sync`, and the table reads `displayName`, `primaryEmail`, `primaryPhone`, `source`, and timestamps from contact records.

## 2026-05-19 - Prefill Profile Onboarding For Edits

- Decision: Hydrate `/onboarding/profile` from `GET /v1/profile/me` before rendering editable fields.
- Reason: The profile page routes existing users to the onboarding form for edits, so previously saved profile sections should appear in the form instead of starting from blank defaults.
- Notes: The current UI supports one work, business, socials, bank, wallet, and crypto row, so the form preloads the first item from each corresponding profile array.

## 2026-05-19 - Hide Google Connect CTA After Import Link

- Decision: Hide the Google authenticate/connect card on the dashboard import page once Google is connected, keeping the sync button as the primary action.
- Reason: Users who have already linked Google should not see a repeated authenticate CTA because the next expected action is syncing contacts.
- Notes: The frontend treats a Google summary row with `hasSyncToken` as the persisted connected/synced signal and also marks the page connected immediately after a successful `google=connected` callback.

## 2026-05-19 - Persist Google Import Connected State

- Decision: Store a frontend Google-connected marker after a successful import OAuth callback and hydrate the import page from that marker plus backend import evidence.
- Reason: A linked Google account can exist before the backend has a sync cursor, so relying only on `hasSyncToken` can leave a stale authenticate CTA visible.
- Notes: Sync failures that indicate expired or revoked Google authorization clear the marker so the reconnect path can return when it is actually needed.

## 2026-05-19 - Remove Google Auth CTA From Import Page

- Decision: Remove the Google connect/authenticate card from `/dashboard/import` entirely and keep that page focused on syncing and reviewing imported contacts.
- Reason: The import page should not show duplicate Google authentication entry points after users reach the operational import workflow.
- Notes: Google authentication remains available through the import onboarding/choice flow, while `/dashboard/import` keeps the sync action as the primary control.

## 2026-05-19 - Keep Non-Google Import Options Visible

- Decision: Show iCloud and VCF import option cards on `/dashboard/import` while hiding only the Google card.
- Reason: Completing Google import should not remove visibility of other import methods users may want later.
- Notes: `ContactImportOptions` now supports filtering out Google so onboarding can keep the full source picker and the dashboard import page can show only pending non-Google options.

## 2026-05-19 - Use Future-Action Labels For Locked Imports

- Decision: Replace unavailable wording on locked iCloud and VCF import buttons with the intended future actions, `Connect now` and `Upload`.
- Reason: Disabled coming-soon cards should preview the action users will eventually take without exposing internal implementation states like connector availability.
- Notes: The buttons remain disabled and show a lock icon, while the existing `Coming soon` badges continue to communicate feature status.

## 2026-05-19 - Add Mock-Backed Contacts Directory Page

- Decision: Add a frontend-only `/dashboard/contacts` page backed by mock data shaped like the current `GET /v1/contacts` `ContactDetailDto[]` response.
- Reason: The contacts directory can be built and reviewed before the final API wiring while keeping the page contract-compatible with the backend response.
- Notes: The page uses TanStack Table for filtering, sorting, and pagination state, shadcn-style combobox filters, and a responsive card view that becomes the default presentation on mobile.

## 2026-05-19 - Add First Card Prompt After Import Onboarding

- Decision: Add `/onboarding/card` as the next onboarding step after profile completion and import choice, using the existing `POST /v1/cards` API.
- Reason: A first ContactBook card is the next meaningful setup action once a user has created a profile and either imported contacts or skipped import.
- Notes: The card step stays skippable, Google onboarding redirects to it only after the existing auto-sync succeeds, and no backend code changes are required.

## 2026-05-19 - Show ContactBook Cards On Dashboard

- Decision: Load `GET /v1/cards` on the dashboard and display the user's ContactBook cards in a dedicated card section.
- Reason: After users create a first card during onboarding, the dashboard should immediately reflect that core product object instead of only showing setup prompts.
- Notes: The dashboard shows loading, error, empty, and populated card states, with an empty state opening the dashboard card onboarding modal.

## 2026-05-19 - Make Dashboard Own Onboarding Modals

- Decision: Move profile, import, and first-card onboarding into dashboard-owned modal steps keyed by `/dashboard?onboarding=profile|import|card`.
- Reason: Authenticated users should remain anchored on the dashboard while completing setup instead of moving through standalone onboarding routes.
- Notes: Legacy `/onboarding/profile`, `/onboarding/import`, and `/onboarding/card` paths now redirect to the matching dashboard modal for compatibility.

## 2026-05-19 - Return Profile Edits To Profile Page

- Decision: Open profile editing as `/dashboard?onboarding=profile&returnTo=/profile` when launched from the profile page.
- Reason: Users editing from their profile should return to that profile view after saving or skipping, while signup/dashboard onboarding should continue through the setup steps.
- Notes: Dashboard only honors safe internal `returnTo` paths and otherwise advances profile onboarding to the import step.

## 2026-05-19 - Patch Existing Profiles From Onboarding Modal

- Decision: Have the profile onboarding modal use `PATCH /v1/profile/me` when existing profile groups are already present, while keeping `POST /v1/profile/onboarding` for first-time setup.
- Reason: The backend intentionally returns `409 Profile already initialized` for repeat calls to the first-time onboarding endpoint.
- Notes: The frontend also retries once with `PATCH /v1/profile/me` if first-time initialization races into a 409 response.

## 2026-05-19 - Use Contacts Sync Endpoint

- Decision: Change Google contact sync from `/v1/integrations/google/sync` to `/v1/contacts/sync`.
- Reason: Backend confirmed the integrations Google sync endpoint will be removed and replaced by the contacts sync endpoint.
- Notes: `GET /v1/contacts/import` was already in use for the import summary/list contract. The remote backend deployment may lag this frontend change until the backend GitHub deployment issue is resolved.

## 2026-05-19 - Align Sync Method With Live API Docs

- Decision: Call Google contact sync as `GET /v1/contacts/sync?source=GOOGLE`.
- Reason: Live OpenAPI documents `GET /api/v1/contacts/sync` with required `source=GOOGLE|ICLOUD`; POST returns `Cannot POST /api/v1/contacts/sync?source=GOOGLE`.
- Notes: Passive pages should not call `GET /v1/contacts/import`; use contacts list responses for display status and reserve provider endpoints for explicit import/sync actions.

## 2026-05-19 - Avoid Passive Import Endpoint Calls

- Decision: Stop using `GET /v1/contacts/import` for page-load status and derive frontend import summaries from `GET /v1/contacts` or `GET /v1/contacts?source=GOOGLE`.
- Reason: Live OpenAPI requires `source` on `/api/v1/contacts/import` and describes it as a provider import operation, so calling it without `source` returns `Validation failed (enum string is expected)` and calling it on passive page loads could unintentionally trigger imports.
- Notes: Explicit Google sync still uses `GET /v1/contacts/sync?source=GOOGLE`; passive counts use active/deleted contact records and the latest contact `updatedAt` as the visible last activity timestamp.

## 2026-05-19 - Close Card Onboarding After Creation

- Decision: After card creation, return the created card from the onboarding modal, optimistically add it to dashboard state, and replace the URL with `/dashboard`.
- Reason: The modal is query-param controlled, so leaving setup query state around can make it reappear even after a successful card create.
- Notes: The dashboard still refreshes cards from `GET /v1/cards` after the optimistic update.

## 2026-05-19 - Move Contact Details To Dedicated Page

- Decision: Replace the contacts side pane with a dedicated `/dashboard/contacts/:contactId` detail page and keep the contacts index as a full-width table.
- Reason: The user requested contact details on a new page, a cleaner table layout, and controls in the table header.
- Notes: Live OpenAPI only supports `source` on `GET /v1/contacts`, so search, sort, and pagination are client-side for now; the detail page uses `GET /v1/contacts/:id`.

## 2026-05-19 - Use Contact Rows As Detail Links

- Decision: Make each contacts table row navigate to `/dashboard/contacts/:contactId` and remove the separate View action button.
- Reason: The user requested row clicks to be enough for opening contact details.
- Notes: Rows support keyboard activation with Enter and Space in addition to pointer clicks.

## 2026-05-20 - Simplify Signup Onboarding And Contact Details

- Decision: Stop routing signup setup users into the card creation modal after the import step.
- Reason: The user wants new signups to avoid the create-card modal during onboarding; cards remain available from manual card creation paths.
- Notes: Setup-mode import skip and Google connect completion now return to `/dashboard`.

- Decision: Remove internal identifiers from the contact detail page, including External id and Source metadata.
- Reason: Imported identifiers are not useful user-facing contact details and make the page feel noisy.
- Notes: The page still shows primary contact fields, organizations, addresses, URLs, notes, source badge, and created/updated dates.

## 2026-05-19 - Add Cards Index And Detail Pages

- Decision: Add `/dashboard/cards` for listing ContactBook cards and `/dashboard/cards/:cardId` for a basic card detail view.
- Reason: Cards are becoming a first-class product area and need a dedicated route beyond the dashboard summary.
- Notes: The pages use existing `GET /v1/cards` and `GET /v1/cards/{cardId}` APIs, keep card creation routed through the existing onboarding modal, and do not require backend changes.

## 2026-05-19 - Preserve Signup Onboarding Redirect

- Decision: Track the intended post-registration redirect as `/dashboard?onboarding=profile` before marking the auth context authenticated.
- Reason: Marking the user authenticated can re-render the auth route and trigger its generic authenticated redirect to `/dashboard`, dropping the onboarding query before the dashboard modal opens.
- Notes: Existing-user login still follows the original protected-route destination, while new signups keep the dashboard-owned onboarding modal flow.

## 2026-05-19 - Make Dashboard Reflect Setup Progress

- Decision: Load profile and import summary state on the dashboard and use it with card state to choose contextual hero copy, checklist status, and stats.
- Reason: After a user skips profile setup, imports Google contacts, and creates a card, the dashboard should no longer present first-run onboarding CTAs as the primary workspace message.
- Notes: Profile completion remains optional; imported contacts or created cards are enough to switch the dashboard into an active workspace state.

## 2026-05-19 - Separate Setup Flow From Profile Action

- Decision: Mark first-run profile onboarding links with `flow=setup` and treat plain dashboard profile onboarding as a standalone action.
- Reason: Skipping profile from the dashboard should close the modal, while skipping profile during signup setup should continue to import contacts.
- Notes: Signup and legacy `/onboarding/profile` redirects now include `flow=setup`; profile edit and dashboard profile actions stay local unless `returnTo` is present.

## 2026-05-19 - Make Card Wizard Copy Context-Aware

- Decision: Add setup/create modes to the card modal so first-card language appears only during first-run setup.
- Reason: Reusing the card modal from dashboard and cards pages should not tell users they are creating their first card after they already have cards.
- Notes: Setup import links encode `flow=setup` before the Google OAuth callback, while regular dashboard card creation uses generic card copy.

## 2026-05-19 - Derive Import Auth State From Backend

- Decision: Stop using the browser-wide `contactbook:google-connected` localStorage marker as source of truth for Google import UI.
- Reason: Multiple ContactBook accounts in the same browser can otherwise inherit stale Google-connected UI from another user.
- Notes: Import status now comes from `GET /v1/contacts/import` plus `GET /v1/contacts?source=GOOGLE`; logout clears stale ContactBook OAuth/import keys and signs out any temporary Supabase OAuth session.

## 2026-05-19 - Move Synced Contacts To Contacts Page

- Decision: Replace mock contacts with `GET /v1/contacts` on `/dashboard/contacts` and remove the duplicated imported-contact list from `/dashboard/import`.
- Reason: The import page should own provider connection and sync status, while the contacts page should be the canonical synced-contact directory.
- Notes: Contacts now uses a Google Contacts-inspired layout with left counts, central searchable list, and a right detail panel; Import links to Contacts with a CTA.

## 2026-05-19 - Simplify Contacts Directory Copy

- Decision: Remove "synced" explanatory copy from the contacts table and import directory CTA.
- Reason: The contacts directory should present user records plainly without repeating source or synchronization mechanics in table-level copy.
- Notes: Empty and import-directory states now refer to contacts/importing contacts directly while keeping the existing navigation to Import and Contacts pages.

## 2026-05-19 - Place Contacts Directory With Import Options

- Decision: Show the Contacts directory card beside the iCloud and VCF import option cards once Google is connected.
- Reason: After Google is connected, the Google sign-in card is hidden, leaving the import option row as the right place for the directory shortcut.
- Notes: The directory card remains hidden before Google connection and keeps its existing contacts count, error state, and View contacts CTA.

## 2026-05-19 - Replace Dashboard Card List With CTA

- Decision: Remove individual ContactBook card previews from the dashboard and keep a single CTA to `/dashboard/cards`.
- Reason: The cards page is now the dedicated place for reviewing and managing cards, while the dashboard should stay focused on summary and navigation.
- Notes: Dashboard card loading remains only for progress counts and setup state; card record display, empty state, and card-list error UI were removed from the home screen.

## 2026-05-19 - Pair Dashboard Stats With Page Links

- Decision: Show only imported contact and card summary stats on the dashboard, each with a direct link to its dedicated page.
- Reason: Keeping the statistic and navigation together makes the home screen easier to scan and removes the separate profile stat and cards CTA block.
- Notes: Imported contacts link to `/dashboard/import`, cards link to `/dashboard/cards`, and profile progress remains represented in the Today checklist.

## 2026-05-19 - Link Contact Stat To Contacts Page

- Decision: Point the imported contacts dashboard CTA to `/dashboard/contacts`.
- Reason: The contacts page is the canonical place to inspect contact records, while import remains focused on connection and sync controls.
- Notes: The stat keeps the imported contact count and now uses `View contacts` as its action label.

## 2026-05-19 - Redesign Active Dashboard Hero

- Decision: Replace the active workspace hero copy and button row with a compact workspace overview and two action tiles for Contacts and Cards.
- Reason: Once setup has started, the dashboard should prioritize fast operational navigation over broad introductory messaging.
- Notes: Inactive setup states keep their onboarding CTAs, while active users see direct links to `/dashboard/contacts` and `/dashboard/cards`.

## 2026-05-19 - Remove Dashboard Hero Card

- Decision: Remove the dashboard workspace hero card and move summary stat cards to the top of the page.
- Reason: The dashboard already has direct stat cards with links, so the hero duplicated navigation and pushed the primary metrics down.
- Notes: The Today checklist remains below the stats, and overview data still feeds summary counts and checklist state.

## 2026-07-18 - Design System v2 (Glass Shell + Tokens)

- Decision: Ship a refined app design system before client feature work (live card generation, import progress, knowledge base, WhatsApp handoff).
- Reason: Current UI was mid-maturity and not client-deliverable; references (HeyDrop-style cards, mobile profile CTA stack, current dark dashboard) call for softer glass surfaces, larger radii, clearer elevation, and a collapsible shell.
- Notes: Tokens in `styles.css` now include glass/surface/elevation, ambient app background, Plus Jakarta Sans + Fraunces loaded; AppShell gains desktop collapse + glass chrome; Button/Card/Input/Select/Badge/Alert refined; dashboard and cards list use fixed oklch-safe surface gradients (removed broken `hsl(var(--…))`); card *product* redesign and new features remain gated pending explicit approval.
- Files: `apps/web/src/styles.css`, `apps/web/index.html`, `apps/web/src/components/app-shell.tsx`, `apps/web/src/components/ui/*`, `apps/web/src/lib/card-styles.ts`, `apps/web/src/pages/dashboard-page.tsx`, `apps/web/src/pages/cards-page.tsx`.

## 2026-07-18 - Compact Profile Workspace Layout

- Decision: Redesign Profile as a dense workspace view and extract reusable UI primitives (`SegmentedTabs`, `DetailGrid`/`RecordPanel`) for the same density pattern elsewhere.
- Reason: Profile was oversized (hero identity, min-h-16 tabs, min-h-20rem record cards, duplicated titles), so little data was visible above the fold.
- Notes: Compact identity strip, slim tabs, single glass panel, field grids without marketing-card chrome; dashboard Classic/Story now uses shared `SegmentedTabs`. Card product redesign and client feature work remain gated.
- Files: `apps/web/src/pages/profile-page.tsx`, `apps/web/src/components/ui/segmented-tabs.tsx`, `apps/web/src/components/ui/detail-fields.tsx`, `apps/web/src/pages/dashboard-page.tsx`.

## 2026-07-18 - Adopt Geist Sans

- Decision: Replace Plus Jakarta Sans with Geist Variable (`@fontsource-variable/geist`) as the app sans/display font.
- Reason: User requested a more refined professional typeface for the product UI.
- Notes: JetBrains Mono kept for mono; public marketing theme fonts unchanged; theme-preview Fraunces remains local to that page.
- Files: `apps/web/package.json`, `apps/web/src/main.tsx`, `apps/web/src/styles.css`, `apps/web/index.html`.

## 2026-07-18 - Design System v3 (Floating Sidebar, Flat Palette, 3-D Card Flip)

- Decision: Comprehensive UI revamp removing AI-like gradients, replacing the bordered panel sidebar with a transparent floating sidebar, and adding a 3-D hover-flip to all contact cards.
- Reason: Client requires a professional, natural, elegant look (HeyDrop-style). Previous surface gradients looked AI-generated; sidebar was static and visually heavy; cards lacked interaction depth.
- Notes:
  - `styles.css`: removed `surface-gradient*` utilities and the second warm-accent radial from `--app-ambient`; added `card-flip-scene / card-flip-inner / card-face / card-face-back` CSS for native 3-D flip on `hover: hover` devices.
  - `app-shell.tsx`: sidebar is now transparent (no background/border); nav items float freely; a `position: fixed` mini toggle button (`h-6 w-6` rounded-full) hovers at the exact right edge of the sidebar area; header is `bg-background/80 backdrop-blur-xl` without glass-panel chrome.
  - `card-styles.ts`: `faceClassName` changed from `surface-gradient*` → `bg-card` across all four card types.
  - `dashboard-page.tsx`: `DashboardStatCard` → `bg-card`; `DashboardOverviewPanel` → `bg-card`; `DashboardContactCard` wrapped in `card-flip-scene/card-flip-inner` with `CardBackFace` (avatar + Open card + Share card).
  - `cards-page.tsx`: `CardsPageContactCard` same flip treatment with `CardsPageCardBack`.
  - `import-page.tsx`: replaced oversized hero card with compact section-heading + stat strip grid + import options.
  - `contact-import-options.tsx`: `rounded-[28px]` → `rounded-2xl`, custom shadows → `elevation-soft`, button `rounded-full` → `rounded-xl`.
  - `table.tsx`: lighter hover `bg-foreground/[0.03]`, tighter column header style.
  - `contacts-page.tsx`: button `rounded-full` → `rounded-xl` on search, pagination, and CTA buttons.
- Files: `styles.css`, `app-shell.tsx`, `card-styles.ts`, `dashboard-page.tsx`, `cards-page.tsx`, `import-page.tsx`, `contact-import-options.tsx`, `table.tsx`, `contacts-page.tsx`.
- Checks: `tsc --noEmit` + `pnpm lint` both pass cleanly.

