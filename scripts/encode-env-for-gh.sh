#!/usr/bin/env bash
# Emit base64 of a dotenv file for GitHub Actions secrets (single-line, no newlines).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

usage() {
  cat >&2 <<EOF
Usage: $(basename "$0") <env-file>

Encode a dotenv file as one line of base64 for GitHub repository secrets.

Examples:
  $(basename "$0") apps/api/env/prod.env   → API_ENV_PROD_B64
  $(basename "$0") apps/api/env/uat.env  → API_ENV_UAT_B64
  $(basename "$0") apps/api/.env         → API_ENV_B64 (legacy)
EOF
  exit 1
}

[[ $# -eq 1 ]] || usage

ENV_FILE="$1"
if [[ "${ENV_FILE}" != /* ]]; then
  ENV_FILE="${ROOT}/${ENV_FILE}"
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}" >&2
  exit 1
fi

SECRET_NAME="API_ENV_B64"
case "$(basename "${ENV_FILE}")" in
  prod.env) SECRET_NAME="API_ENV_PROD_B64" ;;
  uat.env) SECRET_NAME="API_ENV_UAT_B64" ;;
esac

base64 < "${ENV_FILE}" | tr -d '\n'
echo
echo "Add repository secret ${SECRET_NAME} with the value above (one line)." >&2
