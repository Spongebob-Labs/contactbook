#!/usr/bin/env bash
# Local Docker build: full API env file as BuildKit secret (same as CI).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/apps/api/.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Copy apps/api/.env.example and edit." >&2
  exit 1
fi
docker buildx build \
  --secret "id=api_env,src=${ENV_FILE}" \
  -f apps/api/Dockerfile \
  -t contactbook-api:local \
  "${ROOT}"
