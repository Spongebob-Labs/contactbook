# Endpoint → page map

Which screen triggers which call, and on what action. All 36 operations from
`https://apistaging.getcontactbook.com/api/docs`.

Every call goes through the same-origin proxy at **`/api/cb/<path>`** →
`https://apistaging.getcontactbook.com/api/v1/<path>`. The proxy passes method, path, query, body,
status and response bytes through **verbatim** — what Swagger returns is what the Network tab
shows. Filter the Network tab on `api/cb` to see only API traffic.

---

## auth (5)

| Method | Path | Page | Triggered by |
| --- | --- | --- | --- |
| POST | `/auth/otp/request` | `/signin/phone` | Pressing **Send code** |
| POST | `/auth/otp/request` | `/signin/otp` | Pressing **Resend code** |
| POST | `/auth/otp/verify` | `/signin/otp` | Pressing **Verify** |
| POST | `/auth/refresh` | any | `proxy.ts`, automatically, when the access token is stale |
| POST | `/auth/logout` | any | Signing out |
| POST | `/auth/me` | every `(app)` screen | On load — supplies the user id, which `/profile/me` does not carry |

`POST /auth/otp/verify` is the only call that creates a session. The proxy lifts the API's
refresh token out of its `Set-Cookie` and re-homes it as a first-party cookie; the response body
reaching the browser is unchanged.

## profile (14)

| Method | Path | Page | Triggered by |
| --- | --- | --- | --- |
| GET | `/profile/me` | `/profile`, all `(app)` | On load |
| POST | `/profile/onboarding` | `/signup/email` | Pressing **Continue** — sends firstName + lastName + email together |
| GET | `/profile/fields` | `/profile`, `/cards/*` | On load |
| POST | `/profile/fields` | `/profile`, `/profile/groups/[id]` | **Add field** in a section |
| GET | `/profile/fields/{id}` | — | **Not used.** The list read carries every field, so fetching one by id has no caller |
| PATCH | `/profile/fields/{id}` | `/profile`, group editor, builder | Saving a field's label or value |
| DELETE | `/profile/fields/{id}` | `/profile/groups/[id]` | **Delete** on a field row (after confirm) |
| PUT | `/profile/fields/order` | `/profile/groups/[id]` | Moving a field up or down. ⚠ Sends the **whole** profile's order — `position` is global, not per-group |
| GET | `/profile/groups` | `/profile`, `/cards/*` | On load |
| POST | `/profile/groups` | `/profile` | **Add a job, business, social profile or account** |
| PATCH | `/profile/groups/{id}` | `/profile/groups/[id]` | **Rename group** |
| DELETE | `/profile/groups/{id}` | `/profile/groups/[id]` | **Remove group** (after confirm) |
| POST | `/profile/photo` | `/profile` | **Add / Change photo** — `multipart/form-data` |
| DELETE | `/profile/photo` | `/profile` | **Remove photo** |

## contacts (5)

| Method | Path | Page | Triggered by |
| --- | --- | --- | --- |
| GET | `/contacts` | `/contacts`, `/cards/[id]` | On load (the card page needs it for the share picker) |
| POST | `/contacts` | `/contacts` | **Add contact**. Upserts on `(you, phoneE164)` |
| GET | `/contacts/{id}` | `/contacts/[contactId]` | On load |
| PATCH | `/contacts/{id}` | `/contacts/[contactId]` | **Save** on the name / note form |
| POST | `/contacts/import` | `/contacts` | **Import** — one call for the whole paste |

⚠ There is no `DELETE /contacts/{id}` in the API, so the registry has no remove action.

## cards (7)

| Method | Path | Page | Triggered by |
| --- | --- | --- | --- |
| GET | `/cards` | `/cards`, `/profile/groups/[id]` | On load (the group editor needs it for the delete blast radius) |
| POST | `/cards` | `/cards/new` | **Create card** — then immediately `PUT /cards/{id}/fields`, because a new card starts empty |
| GET | `/cards/{id}` | `/cards/[cardId]`, `/cards/[cardId]/edit` | On load |
| PATCH | `/cards/{id}` | `/cards/[cardId]/edit` | **Save changes** (name + kind) |
| DELETE | `/cards/{id}` | `/cards/[cardId]` | **Delete card** (after confirm). ⚠ Also revokes every active share link on it |
| PUT | `/cards/{id}/fields` | `/cards/[cardId]/edit`, `/cards/new` | **Save** / **Create**. ⚠ REPLACES the whole set |
| POST | `/cards/{id}/share` | `/cards/[cardId]` | **Send** in the Share dialog, after picking a contact |

## share-links (2)

| Method | Path | Page | Triggered by |
| --- | --- | --- | --- |
| GET | `/share-links` | `/cards/[cardId]`, `/contacts`, `/contacts/[contactId]` | On load |
| PATCH | `/share-links/{id}` | `/cards/[cardId]` | **Revoke** (after confirm) or **Restore** on a share row |

## whatsapp-templates (3)

| Method | Path | Page | Triggered by |
| --- | --- | --- | --- |
| GET | `/templates` | — | No screen |
| POST | `/templates` | — | No screen |
| PATCH | `/templates/{id}` | — | No screen |

These register a Twilio `contentSid` that already exists in Twilio and verify nothing against it —
an operator task, not a user flow. They matter for one reason: `POST /cards/{id}/share` cannot
send a WhatsApp message until an approved `CARD_SHARE` template is registered. Until then that
call returns `CARD_SHARE_TEMPLATE_NOT_CONFIGURED` — **and still mints a live link**, which the UI
hands over to copy rather than reporting as a failure.

---

## public (1) — live, but **not in Swagger**

| Method | Path | Page | Triggered by |
| --- | --- | --- | --- |
| GET | `/public/links/{token}` | `/c/[token]` | On load. **Unauthenticated** — a stranger tapping the WhatsApp link |

This is the other half of `POST /cards/{id}/share`: that mints a link ending `/c/{token}`, and this
turns the token back into a card. It does not appear in `GET /api/docs-json`, so it has to be known
about rather than discovered — see `docs/INTEGRATION.md` ask #1.

**The full share journey, end to end:**

1. `/cards/[cardId]` → **Share** → pick a contact → `POST /cards/{cardId}/share` with
   `{"contactId": "…"}`
2. The API returns `ShareLinkResponseDto`, whose `url` ends `/c/{token}`, and enqueues the WhatsApp
   send
3. The recipient taps it → `/c/{token}` → `GET /public/links/{token}`
4. The page renders the owner's card — their fields, their design — through the **same**
   `resolveCard` + `<CardPage>` the owner sees, mobile-first, with **Save to contacts** (a `.vcf`)
   and **Message on WhatsApp**

## Endpoints with no API behind them

| Wanted | Used by | Status |
| --- | --- | --- |
| A `PATCH` for name / email | `/profile` identity block | **Ask #5.** Onboarding sets them once and 409s after, so the block is read-only |
