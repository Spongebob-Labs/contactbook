# Backend — card appearance: two things left

Thanks for the `GET /public/links/{token}` columns. Frontend is integrated and merged — a card
with a saved design now renders that design for the recipient.

Two things still block the feature end to end.

## 1. Two enum values don't match our vocabulary

Your example sends:

```json
"finish": "matte",  "textureScale": "1x"
```

Neither exists on our side. We drop unknown values and fall back to the default look, so nothing
crashes — but those two axes silently won't render. The full accepted vocabulary:

| Column | Accepted values |
|---|---|
| `templateId` | `meridian` · `marigold` |
| `paletteId` | `onyx` · `sapphire` · `emerald` · `oxblood` · `rust` · `amber` · `clay` · `pistachio` · `periwinkle` |
| `groundHex` | `#RRGGBB` (6 hex digits, `#` required) |
| `finish` | `flat` · `gradient` · `mesh` |
| `texture` | `none` · `grain` · `grid` · `dots` · `topo` |
| `texturePresence` | `subtle` · `medium` · `strong` |
| `textureScale` | `fine` · `regular` · `large` |

`matte` → closest is `flat`. `1x` → closest is `regular`.

Plain `text` columns are fine; we validate on read. `NULL` on any axis means "not chosen" and we
fall back per-axis, so partial designs work — a card that picked only a colour keeps its
template's finish.

## 2. The owner still can't save a design

The public endpoint now *reads* appearance, but nothing can *write* it:

- `CreateCardDto` — still `{ name, kind }`
- `UpdateCardDto` — still `{ name, kind }`
- `CardResponseDto` — still `{ id, name, kind, fields, createdAt, updatedAt }`

So the columns are read-only in practice. `forbidNonWhitelisted` 400s anything extra we send,
and the owner's own card page can't show their saved design back to them either.

Same seven fields, all optional, on those three DTOs and we can close this.

## Also worth a look — not blocking

`GET /public/links/{token}` returns the owner as `{ "owner": { "name": … } }`, while the card
object uses `name` for the *card's* label. Same key, two meanings, one level apart. It works —
we handle it — but `fullName` on the owner object would remove a real footgun.

## Deploy status

As of this writing `apistaging.getcontactbook.com` does **not** yet return the appearance keys —
a live token still comes back with `card: { name, kind, updatedAt }` only. Looks unshipped to
staging. Our code handles both shapes, so deploying is safe whenever you're ready.
