# Decision Context

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
