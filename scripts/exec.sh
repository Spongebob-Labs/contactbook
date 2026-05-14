#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/apps/api/.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}" >&2
  exit 1
fi
docker buildx build \
  --secret "id=api_env,src=${ENV_FILE}" \
  -f apps/api/Dockerfile \
  -t europe-west10-docker.pkg.dev/c-club-466412/contactbook/api:latest \
  "${ROOT}"
