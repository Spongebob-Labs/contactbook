# ContactBook API Integration Plan

**Date:** 2026-07-27 (updated 2026-08-02)  
**Status:** Waves A–D landed (auth, card share/VCF, contacts shapes, templates CRUD, connections)  
**Approach:** Domain waves with a shared API spine (Approach 1)

### Waves A–C (2026-08-02) — current runtime

- API host: `https://api.getcontactbook.com` — FE uses absolute `VITE_API_URL=https://api.getcontactbook.com/api` (never relative `/api` / localhost in Network)
- Register body: `phoneVerificationToken` + `firstName` + `lastName` + `email` only (phone bound in JWT)
- Auth session: Bearer from verify/refresh + cookies; absolute live API base
- Cards: always `POST /cards` then re-fetch; field-mappings API; theme/template client presentation only
- Card share: WhatsApp share dialog → `POST /cards/:id/share`; shares list + resend; server `POST /cards/:id/vcard` with local fallback
- Contacts: list normalizer for `contacts` + 0-based `page`; import summary accepts `sources[]`
- WhatsApp templates: `/dashboard/whatsapp-templates` (list / create / activate / default / delete)
- Connections: `/dashboard/connections` (list / send by phone / optional card / resend pending)
- Still deferred: accept/decline/share-back REST (409 by design), Travel (removed from API docs), Connections-by-contact picker

---

## 1. Understanding summary

- **What:** Integrate the live ContactBook API into the web dashboard so Auth, Dashboard, Profile, Cards, Contacts, and Import are real end-to-end (not mock-backed).
- **Why:** Delivery depends on correct API wiring; auth bypass and silent mock fallbacks currently hide breakage.
- **Who:** Authenticated ContactBook users on the web app (demo/delivery against integration host).
- **Key constraints:**
  - API host: `https://api.getcontactbook.com` (compose FE base as `…/api` + `/v1/...`; earlier push used host A `34.147…`)
  - Real WhatsApp OTP auth before other domains
  - Vite dev proxy for cookie sessions
  - Fail loud — no silent mock fallbacks on dashboard surfaces
  - Cards: server shell + field-mappings; theme/template client-only
  - Field-mappings blocked until live `fieldId`s exist (probe → BE if needed)
- **Non-goals (this push):** Connections, Travel, Health, WhatsApp-only accept/decline/share-back, Bearer-first auth rewrite, inventing card theme APIs on the backend.

---

## 2. Assumptions

1. Host A is the contract and runtime for this push (not prod/UAT unless later promoted).
2. Client paths stay `/v1/...` against base `…/api`.
3. FE auth: Twilio `POST /auth/otp/whatsapp/send` → `POST /auth/otp/whatsapp/verify` → `/auth/register` when unregistered. Outdated OpenWA `request-code` / `verify-code` are not used by the web app.
4. Product scope = Dashboard + Profile + Cards + Contacts + Import only.
5. Cards presentation (theme/template) stays in client storage keyed by server `cardId`.
6. Google OAuth path is locked only after probing host A OpenAPI (expect Supabase → `link-provider`).
7. Import includes Google + VCF + iCloud; iCloud 501 fails loud (does not fake success).
8. Contacts include tag/group rename/delete and notes `PATCH`.
9. Profile includes photo on `/profile` and `DELETE /profile/me/groups`.
10. NFRs: demo-scale; cookie-via-proxy; one 401 refresh retry; FE owns clients/UI; BE owns host gaps (`fieldId`, CORS if proxy insufficient, 501s).

---

## 3. Current state snapshot (pre-implementation)

| Domain | Status | Notes |
|--------|--------|-------|
| Auth (WhatsApp OTP) | PARTIAL | Wired but routes/session bypassed for UI viewing |
| Profile | PARTIAL | GET/PATCH/onboarding; no group DELETE; mock fallback |
| Photo | PARTIAL | Onboarding only |
| Contacts | PARTIAL | List/detail/tags/groups assign; no notes PATCH; no tag/group rename/delete; mock fallback |
| Import | PARTIAL | Google sync + VCF; iCloud coming soon; Google OAuth callback disabled |
| Cards | UI_ONLY_MOCK | `USE_LOCAL_CARDS`; shape mismatch vs API + field-mappings |
| Connections / Travel / Health | NO_UI | Out of scope |

**Branch blockers:** auth bypass, production `VITE_API_URL` in local `.env`, silent mocks, local cards flag.

---

## 4. Decision log

| Decision | Alternatives considered | Why chosen |
|----------|-------------------------|------------|
| Env = host A (`34.147.177.94:8080`) | UAT / prod / localhost | User-designated integration source of truth |
| Real auth first | Bypass / Bearer hack | Gate for every other endpoint |
| Delivery order Auth → Profile → Contacts → Import → Cards | Cards-first / Contacts-first | Harden partial wires before card rewrite |
| Fail loud | Dev mock toggle / silent fallback | Prevent false “working” UI |
| Scope = dashboard surfaces only | Full API catalog | Necessary product paths |
| Cards: shell + mappings; theme local | Wait on BE presentation / simplify maker | Ship without theme API |
| Field IDs: probe then BE | Skip mappings / wait blindly | Validate live contract |
| Import Google + VCF + iCloud | Google+VCF only | User required all three |
| Google OAuth: probe then lock | Force Supabase or BE oauth | Match live host |
| Vite proxy for cookies | Direct CORS / Bearer | Least session friction |
| Contacts full hygiene | Harden-only / notes-only | Demo cleanup + notes |
| Profile: photo on `/profile` + group delete | Shallower profile | Core surface completeness |
| NFR defaults (demo-scale) | Custom tighter NFRs | Enough discipline without platform work |
| Approach 1 (domain waves + spine) | Full inventory gate / parallel domains | Auth choke point; clear checkpoints |

---

## 5. Final design

### §1 API spine (Wave 0)

- Point integration env at host A; avoid production API for day-to-day work.
- Vite proxy: browser → same-origin `/api` → `http://34.147.177.94:8080`.
- Keep `credentials: "include"` and existing 401 → refresh → retry.
- Re-enable `/auth` (and `/auth/callback` when Google path confirmed).
- Restore real `AuthProvider` + `ProtectedRoute` (remove fake viewer).
- Auth: `/otp/whatsapp/send` → `/otp/whatsapp/verify` → dashboard when registered; `/register` only when unregistered. Do not use outdated `request-code` / `verify-code`.
- Remove silent mock fallbacks from authenticated dashboard surfaces.

**Exit:** Login/logout + authenticated `GET /profile/me` work (or real errors); no silent mocks.

### §2 Profile wave

- Probe live profile/photo/groups-delete contracts; note `fieldId` exposure.
- Wire `/profile` GET/PATCH, photo upload/delete, `DELETE /profile/me/groups` on section remove.
- Onboarding via `POST /profile/onboarding`; dashboard banner from live profile.

**Exit:** View/edit profile, photo, onboarding, group delete live; fieldId findings recorded for Cards.

### §3 Contacts wave

- Probe list/detail/patch/tags/groups CRUD + assignment routes.
- Extend `contacts-api.ts`; remove mock list/detail fallbacks.
- List: pagination/search/filters live.
- Detail: notes via `PATCH /contacts/:id`; tags/groups assign + rename/delete hygiene.

**Exit:** Full contacts hygiene against host A, fail loud.

### §4 Import / Google wave

- Probe OpenAPI for Google link path (`link-provider` vs `oauth-url`); lock one.
- Wire summary, Google sync/full import, VCF, iCloud form (replace coming soon).
- Optional disconnect if UI needs it.
- iCloud 501 → clear error, not fake success.

**Exit:** Summary + Google + VCF + iCloud attempts hit host A with real UI states.

### §5 Cards wave

- Server: cards CRUD + field-mappings.
- Client: theme/template keyed by `cardId`.
- Disable `USE_LOCAL_CARDS` as source of truth; optional local→server migrate (confirm at implement).
- Field picker persists mappings only when `fieldId`s exist; otherwise shell-only with explicit pending state.

**Exit:** Create/list/open/rename/delete live; presentation survives refresh; mappings round-trip if IDs available.

### §6 Verification & risks

- Per wave: lint/typecheck; manual smoke via proxied app; Network tab must not hit prod or mocks on happy paths.
- BE ticket list for gaps (`fieldId`, iCloud, oauth, cookie flags).
- **Done:** Auth real; Profile/Contacts/Import/Cards per above; Connections/Travel/Health still out; `decision-context.md` updated.

| Risk | Mitigation |
|------|------------|
| Cookies fail behind proxy | Fix proxy rewrite; escalate cookie/CORS to BE |
| No fieldIds | Shell-first Cards; BE enrichment |
| iCloud incomplete | Fail loud; don’t block Google/VCF |
| Doc ≠ live API | Host A OpenAPI wins per wave probe |
| Local card data loss | Explicit migrate or clear UX |

**Explicit non-work:** No backend code without separate approval; no Connections/Travel; no browser E2E unless requested.

---

## 6. Implementation wave checklist

- [x] Wave 0 — API spine (proxy, env, auth, fail-loud)
- [x] Wave 1 — Profile (+ photo, group delete, fieldId probe notes)
- [x] Wave 2 — Contacts (full hygiene)
- [x] Wave 3 — Import (Google path lock, VCF, iCloud)
- [x] Wave 4 — Cards (shell → mappings helpers; theme/template client-only)
- [x] Docs — update `decision-context.md` as waves land; keep this plan current

**Probe notes (2026-07-27 host A):**
- Google OAuth: `POST /integrations/google/link-provider` + `DELETE .../disconnect` only (Supabase FE path).
- Profile `fieldId`: present on financial row DTOs in OpenAPI; identity/personal/work flattened without IDs → card field-mappings for non-financial await BE enrichment.
- Health: WhatsApp reported `degraded`/`failed` on probe — OTP may fail until provider is up.

---

## 7. Open items to resolve during probes

1. Does live `GET /profile/me` expose non-financial `fieldId`s (or a fields catalog)?
2. Exact Google OAuth routes on host A?
3. Is iCloud fully implemented on host A?
4. Any cookie path/domain tweaks still required with the Vite proxy?
5. Undocumented live endpoints that the markdown reference omitted?
