#!/usr/bin/env bash
# Render apps/api/.env from individual environment variables.
#
# In CI each variable below is populated from a GitHub Actions secret of the same
# name (see .github/workflows/deploy.yml and api-test.yml). This is the single
# source of truth for which runtime env vars the API expects — add a key here and
# create the matching GitHub secret to introduce a new one.
#
# Usage:
#   DATABASE_URL=... JWT_SECRET=... ./scripts/render-api-env.sh [output-path]
# Output path defaults to apps/api/.env (relative to repo root).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-${ROOT}/apps/api/.env}"

# Runtime env vars the API reads. PORT is intentionally NOT here — the container
# port is fixed by docker-compose (8080) so the host port mapping stays stable.
KEYS=(
  DATABASE_URL
  DIRECT_URL
  CORS_ORIGIN
  JWT_SECRET
  JWT_EXPIRES_IN
  JWT_REFRESH_EXPIRES_IN
  JWT_PHONE_VERIFY_EXPIRES_IN
  AUTH_COOKIE_SAME_SITE
  COOKIE_SECURE
  APP_PUBLIC_URL
  WEB_APP_URL
  WHATSAPP_PROVIDER
  OPENWA_BASE_URL
  OPENWA_API_KEY
  OPENWA_SESSION_ID
  OPENWA_SENDER_PHONE
  OPENWA_WEBHOOK_SECRET
  OPENWA_REQUEST_TIMEOUT_MS
  OPENWA_DELIVERY_POLL_ATTEMPTS
  OPENWA_DELIVERY_POLL_INTERVAL_MS
  LOGIN_BROADCAST_ENABLED
  LOGIN_BROADCAST_RECIPIENTS
  DUMMY_OTP_LOGIN_ENABLED
  TWILIO_ACCOUNT_SID
  TWILIO_AUTH_TOKEN
  TWILIO_VERIFY_SERVICE_SID
  TWILIO_WHATSAPP_FROM
  TWILIO_OTP_CONTENT_SID
  TWILIO_INBOUND_WEBHOOK_ENABLED
  TWILIO_WA_CONNECTION_CONTENT_SID
  TWILIO_WA_CARD_PICK_CONTENT_SID
  WHATSAPP_CLOUD_VERIFY_TOKEN
  WHATSAPP_CLOUD_APP_SECRET
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  OAUTH_TOKEN_ENCRYPTION_KEY_BASE64
  FINANCIAL_FIELD_ENCRYPTION_KEY_BASE64
  GCS_PROFILE_PHOTOS_BUCKET
  GCS_PUBLIC_BASE_URL
  GCS_PROJECT_ID
)

: > "$OUT"
chmod 600 "$OUT"
written=0
for key in "${KEYS[@]}"; do
  val="${!key-}"
  # Escape backslashes and double quotes for the double-quoted dotenv value.
  val="${val//\\/\\\\}"
  val="${val//\"/\\\"}"
  printf '%s="%s"\n' "$key" "$val" >> "$OUT"
  written=$((written + 1))
done

echo "Wrote ${written} vars to ${OUT}" >&2
