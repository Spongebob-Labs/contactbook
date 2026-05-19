#!/usr/bin/env bash
# Emit base64 of apps/api/.env for GitHub Actions secret API_ENV_B64 (single-line, no newlines).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/apps/api/.env"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Copy apps/api/.env.example to apps/api/.env and edit." >&2
  exit 1
fi
base64 < "${ENV_FILE}" | tr -d '\n'
echo
echo "Add repository secret API_ENV_B64 with the value above (one line)." >&2
