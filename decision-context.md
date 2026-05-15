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
