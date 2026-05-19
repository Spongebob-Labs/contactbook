#!/usr/bin/env bash
# Run API quality checks locally: install, Prisma generate, ESLint, build, Jest.
# Requires apps/api/.env (copy from apps/api/.env.example). Not run in CI.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/apps/api/.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Copy apps/api/.env.example to apps/api/.env and fill values." >&2
  exit 1
fi
cd "${ROOT}"
pnpm install --frozen-lockfile --filter api...
pnpm -C apps/api prisma:generate
pnpm -C apps/api lint
pnpm -C apps/api build
pnpm -C apps/api test
