# contactbook

A pnpm monorepo.

- **`apps/web`** — [Next.js](https://nextjs.org) 16 (App Router, React 19, Tailwind CSS 4)
- **`apps/api`** — [NestJS](https://nestjs.com) 11 (Prisma + PostgreSQL)
- **`packages/types`** — shared TypeScript types (`@repo/types`)
- **`packages/utils`** — shared utilities (`@repo/utils`)

## Prerequisites

- Node.js >= 20
- pnpm >= 10
- PostgreSQL (for the API)

## Setup

```bash
pnpm install
cp apps/api/.env.example apps/api/.env        # set DATABASE_URL
cp apps/web/.env.example apps/web/.env.local  # set NEXT_PUBLIC_API_URL
pnpm --filter api prisma:generate
```

## Develop

```bash
pnpm dev          # run web + api in parallel
pnpm dev:web      # Next.js  -> http://localhost:3000
pnpm dev:api      # NestJS   -> http://localhost:8000/api
```

## Common scripts

| Command | Description |
| --- | --- |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Lint all workspaces |
| `pnpm test` | Run all tests |
| `pnpm prisma:migrate` | Run a Prisma dev migration (api) |
| `pnpm prisma:generate` | Regenerate the Prisma client (api) |

## Data layer

Prisma starts empty (`apps/api/prisma/schema.prisma`). Add your models, then:

```bash
pnpm --filter api prisma:migrate   # create + apply a migration
```

## Deployment

- **Web** — deploy `apps/web` to Vercel with **Root Directory** set to `apps/web`
  (Vercel auto-detects Next.js). Set `NEXT_PUBLIC_API_URL` in project env vars.
- **API** — deploy `apps/api` as a Node service with `DATABASE_URL` configured;
  run `pnpm --filter api prisma:migrate:deploy` on release.
