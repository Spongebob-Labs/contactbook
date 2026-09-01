# Build context is the REPO ROOT, not apps/api — a pnpm workspace needs the
# root lockfile and every workspace package.json to resolve dependencies.
#   docker build -f apps/api/Dockerfile -t contactbook-api:local .
#
# node:22-slim (Debian glibc), not alpine, in BOTH stages deliberately: bcrypt
# is a native addon, and building it in one libc and running it in another is
# exactly the kind of thing that only breaks at 2am on the VM, not in CI.

# ---- deps + build ---------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /repo

# python3/make/g++: bcrypt falls back to compiling from source if no prebuilt
# binary matches this exact platform. Build-stage only — never ships.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.13.1 --activate

# Manifests first, so `pnpm install` is Docker-layer-cached across builds
# that only change application source, not dependencies.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/utils/package.json packages/utils/package.json

RUN pnpm install --frozen-lockfile

# Now the real source.
COPY apps/api apps/api
COPY packages packages

# prisma.config.ts calls env('DIRECT_URL') at config-LOAD time -- generate
# itself never connects, it just needs the var to exist. This build stage
# has no .env (see .dockerignore) and shouldn't: real credentials have no
# business inside an image layer. ARG, not ENV -- doesn't persist into the
# runtime stage, which never reads this build stage's env at all anyway.
ARG DIRECT_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN pnpm --filter api prisma:generate
RUN pnpm --filter api build

# ---- runtime ----------------------------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Full workspace node_modules, not a pruned pnpm-deploy output — simpler and
# more predictable than chasing pnpm deploy's workspace-linking edge cases
# for a two-package monorepo this size. Costs image size, not correctness.
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json

WORKDIR /app/apps/api
EXPOSE 8080
CMD ["node", "dist/main.js"]
