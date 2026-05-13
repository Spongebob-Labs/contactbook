# Build from repo root: docker build -f apps/api/Dockerfile .
FROM node:20-alpine

RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/

RUN pnpm install --frozen-lockfile

COPY apps/api ./apps/api
COPY packages ./packages

RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api build

RUN test -f apps/api/dist/src/main.js || (echo "Build failed: main.js missing" && ls -la apps/api/dist/ && exit 1)

ENV NODE_ENV=production
ENV PORT=8000

EXPOSE 8000

WORKDIR /workspace/apps/api
CMD ["node", "dist/src/main.js"]
