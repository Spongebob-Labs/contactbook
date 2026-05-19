#!/usr/bin/env bash
# Apply all pending Prisma migrations for apps/api and regenerate the client.
#
# Usage:
#   ./scripts/migrate-api.sh           # production/CI: prisma migrate deploy
#   ./scripts/migrate-api.sh --dev     # local dev: prisma migrate dev
#
# Requires apps/api/.env with DATABASE_URL (and DIRECT_URL if set in prisma.config.ts).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="${ROOT}/apps/api"
ENV_FILE="${API_DIR}/.env"

usage() {
  cat <<'EOF'
Apply Prisma migrations for the API database.

  ./scripts/migrate-api.sh           Apply pending migrations (migrate deploy)
  ./scripts/migrate-api.sh --dev     Create/apply migrations in dev (migrate dev)
  ./scripts/migrate-api.sh --help    Show this help

Requires apps/api/.env (copy from apps/api/.env.example).
EOF
}

MODE="deploy"

for arg in "$@"; do
  case "${arg}" in
    --dev)
      MODE="dev"
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: ${arg}" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Copy apps/api/.env.example to apps/api/.env and set DATABASE_URL." >&2
  exit 1
fi

cd "${API_DIR}"

echo "==> Prisma migrate (${MODE})"
if [[ "${MODE}" == "dev" ]]; then
  pnpm run prisma:migrate
else
  pnpm run prisma:migrate:deploy
fi

echo "==> Prisma generate"
pnpm run prisma:generate

echo "==> Done. Database is up to date."
