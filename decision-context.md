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
