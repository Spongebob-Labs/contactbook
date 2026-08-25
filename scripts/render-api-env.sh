#!/usr/bin/env bash
# Turns individual GitHub Actions secrets (already exported into this
# process's environment by the deploy workflow) into the .env file that gets
# copied to the VM. Never run this by hand against real secrets on a laptop
# that isn't the CI runner — it writes them to a plain file.
#
# Usage: OUTPUT_PATH=./rendered.env scripts/render-api-env.sh
set -euo pipefail

OUTPUT_PATH="${OUTPUT_PATH:-./rendered.env}"

# Exactly the list env.schema.ts's REQUIRED_IN_PRODUCTION enforces, plus
# CORS_ORIGIN/SHARE_BASE_URL — those two default to localhost:3000 in the
# app's own zod schema (so a fresh clone boots without config), which is
# exactly wrong for a real deploy and would fail silently, not loudly, if
# left unset here.
REQUIRED_VARS=(
  DATABASE_URL
  DIRECT_URL
  JWT_ACCESS_SECRET
  JWT_REFRESH_SECRET
  FIELD_ENCRYPTION_KEY
  TWILIO_ACCOUNT_SID
  TWILIO_AUTH_TOKEN
  TWILIO_WHATSAPP_FROM
  TWILIO_OTP_CONTENT_SID
  GCP_PROJECT_ID
  TASKS_QUEUE_OUTBOUND
  TASKS_QUEUE_PRIORITY
  TASKS_TARGET_BASE_URL
  TASKS_OIDC_AUDIENCE
  TASKS_INVOKER_SA
  GCS_PROFILE_PHOTOS_BUCKET
  CORS_ORIGIN
  SHARE_BASE_URL
)

missing=()
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    missing+=("$var")
  fi
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "render-api-env.sh: missing required secret(s): ${missing[*]}" >&2
  echo "Fix the GitHub Actions secrets, not this script." >&2
  exit 1
fi

# CADDY_API_DOMAIN: the Caddyfile needs a bare host, TASKS_TARGET_BASE_URL is
# a full https:// URL — same derivation Terraform's uptime_host output uses,
# kept in sync deliberately rather than introducing a second source of truth
# for the same domain.
CADDY_API_DOMAIN="${TASKS_TARGET_BASE_URL#https://}"
CADDY_API_DOMAIN="${CADDY_API_DOMAIN#http://}"

cat > "$OUTPUT_PATH" <<EOF
NODE_ENV=production
APP_ENV=${APP_ENV:-production}
LOG_LEVEL=${LOG_LEVEL:-info}

DATABASE_URL=${DATABASE_URL}
DIRECT_URL=${DIRECT_URL}

JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_ACCESS_TTL=${JWT_ACCESS_TTL:-15m}
JWT_REFRESH_TTL=${JWT_REFRESH_TTL:-30d}

FIELD_ENCRYPTION_KEY=${FIELD_ENCRYPTION_KEY}

TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID}
TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN}
TWILIO_WHATSAPP_FROM=${TWILIO_WHATSAPP_FROM}
TWILIO_OTP_CONTENT_SID=${TWILIO_OTP_CONTENT_SID}

GCP_PROJECT_ID=${GCP_PROJECT_ID}
GCP_REGION=${GCP_REGION:-europe-west2}
TASK_TRANSPORT=cloud_tasks
TASKS_QUEUE_PRIORITY=${TASKS_QUEUE_PRIORITY}
TASKS_QUEUE_OUTBOUND=${TASKS_QUEUE_OUTBOUND}
TASKS_TARGET_BASE_URL=${TASKS_TARGET_BASE_URL}
TASKS_OIDC_AUDIENCE=${TASKS_OIDC_AUDIENCE}
TASKS_INVOKER_SA=${TASKS_INVOKER_SA}

CORS_ORIGIN=${CORS_ORIGIN}
SHARE_BASE_URL=${SHARE_BASE_URL}
AUTH_COOKIE_SAME_SITE=${AUTH_COOKIE_SAME_SITE:-none}

CADDY_API_DOMAIN=${CADDY_API_DOMAIN}

SENTRY_DSN=${SENTRY_DSN:-}
GCS_PROFILE_PHOTOS_BUCKET=${GCS_PROFILE_PHOTOS_BUCKET}
SWAGGER_ENABLED=${SWAGGER_ENABLED:-}
EOF

chmod 600 "$OUTPUT_PATH"
echo "Wrote $OUTPUT_PATH (chmod 600)"
