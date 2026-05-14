# syntax=docker/dockerfile:1.7
#
# Multi-stage Dockerfile for the ContactBook NestJS API.
# Optimized for Google Cloud Run: small runtime, non-root user, listens on $PORT.
#
# Build context MUST be the repository root (pnpm workspace):
#   docker build -f apps/api/Dockerfile -t contactbook-api .
#
#
ARG NODE_VERSION=20-alpine

# =============================================================================
# Stage 1: base — Node + pnpm + OpenSSL (required by Prisma engines on Alpine)
# =============================================================================
FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache openssl libc6-compat \
 && corepack enable \
 && corepack prepare pnpm@10 --activate
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true
WORKDIR /workspace

# =============================================================================
# Stage 2: builder — install workspace deps, generate Prisma client, build Nest
# =============================================================================
FROM base AS builder

# Workspace manifests first to maximize Docker layer caching across code changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile \
      --filter api... \
      --filter "./packages/*"

# Source for the api and its workspace deps.
COPY apps/api ./apps/api
COPY packages ./packages

# Full dotenv for prisma generate (not persisted): BuildKit file secret -> apps/api/.env, then removed.
# CI: decode API_ENV_B64 to apps/api/.env, then build-push-action `secret-files: api_env=<that path>`.
# Local: docker buildx build --secret id=api_env,src=apps/api/.env ...
RUN --mount=type=secret,id=api_env \
    --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    cp /run/secrets/api_env /workspace/apps/api/.env \
 && pnpm --filter api exec prisma generate \
 && pnpm --filter api build \
 && rm -f /workspace/apps/api/.env \
 && test -f apps/api/dist/main.js \
    || (echo "Build failed: apps/api/dist/main.js missing" \
        && ls -la apps/api/dist && exit 1)

# =============================================================================
# Stage 3: deployer — produce a self-contained prod-only deployment tree
# =============================================================================
FROM base AS deployer

# Re-copy workspace metadata + source so pnpm deploy can resolve the api.
COPY --from=builder /workspace/package.json /workspace/pnpm-lock.yaml /workspace/pnpm-workspace.yaml /workspace/tsconfig.json /workspace/
COPY --from=builder /workspace/apps/api /workspace/apps/api
COPY --from=builder /workspace/apps/web/package.json /workspace/apps/web/package.json
COPY --from=builder /workspace/packages /workspace/packages

# Drop pre-built node_modules — pnpm deploy installs a fresh prod-only tree.
RUN rm -rf /workspace/node_modules /workspace/apps/api/node_modules \
           /workspace/packages/*/node_modules

# Create the deployable bundle (apps/api + its prod deps, workspace deps inlined).
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter=api deploy --legacy --prod /deploy

# pnpm deploy reinstalls @prisma/client fresh, which discards the previously
# generated client. Regenerate it inside /deploy by pulling the matching prisma
# CLI on the fly (only @prisma/client needs to be present at runtime).
WORKDIR /deploy
RUN --mount=type=secret,id=api_env \
    --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    cp /run/secrets/api_env /deploy/.env \
 && PRISMA_VERSION=$(node -p "require('./node_modules/@prisma/client/package.json').version") \
 && pnpm dlx prisma@${PRISMA_VERSION} generate \
 && rm -f /deploy/.env \
 && rm -rf /root/.cache /root/.npm /root/.local /tmp/*

# Drop files not needed at runtime to keep the image lean.
RUN rm -rf src test eslint.config.mjs nest-cli.json \
           tsconfig.json tsconfig.build.json tsconfig.build.tsbuildinfo \
           Dockerfile cloudbuild.yaml .env.example .gitignore

# =============================================================================
# Stage 4: runtime — minimal image for Cloud Run
# =============================================================================
FROM node:${NODE_VERSION} AS runtime

RUN apk add --no-cache openssl tini

ENV NODE_ENV=production \
    PORT=8080 \
    NODE_OPTIONS="--enable-source-maps"

WORKDIR /app
COPY --from=deployer --chown=node:node /deploy /app

USER node

# Documents the default Cloud Run port; Cloud Run injects PORT at runtime and
# the Nest app reads process.env.PORT in src/main.ts.
EXPOSE 8080

# tini reaps zombies and forwards signals (SIGTERM from Cloud Run -> Node).
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
