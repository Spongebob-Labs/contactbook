#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ID="${GCP_PROJECT_ID:-project-c74d38dd-7e12-4d3f-bbf}"
REGION="${GCP_REGION:-europe-west1}"
ZONE="${OPENWA_ZONE:-europe-west1-b}"
INSTANCE="${OPENWA_INSTANCE:-contactbook-openwa}"
GAR_REPOSITORY="${OPENWA_GAR_REPOSITORY:-contactbook}"
UPSTREAM_REPOSITORY="${OPENWA_UPSTREAM_REPOSITORY:-https://github.com/rmyndharis/OpenWA.git}"
UPSTREAM_REF="${OPENWA_UPSTREAM_REF:-v0.7.14}"
ENV_FILE="${OPENWA_ENV_FILE:-${ROOT}/OpenWA/.env}"
DOMAIN="${OPENWA_DOMAIN:-}"
SOURCE_DIR="${OPENWA_SOURCE_DIR:-${ROOT}/OpenWA}"
SCHEME="${OPENWA_SCHEME:-https}"

usage() {
  cat <<'EOF'
Deploy OpenWA to the Terraform-managed ContactBook Compute Engine VM.

Required environment:
  OPENWA_DOMAIN                 Public hostname, for example openwa.getcontactbook.com
  OPENWA_DASHBOARD_PASSWORD     Password protecting the dashboard and API docs

Optional environment:
  OPENWA_SCHEME                 Protocol scheme, http or https (default: https)
  OPENWA_ENV_FILE               OpenWA dotenv file (default: OpenWA/.env)
  OPENWA_SOURCE_DIR             Build a local OpenWA tree (default: OpenWA). Set to 'upstream' to clone instead.
  OPENWA_UPSTREAM_REF           Upstream tag/commit (default: v0.7.14)
  GCP_PROJECT_ID, GCP_REGION, OPENWA_ZONE, OPENWA_INSTANCE

The dotenv file must define API_MASTER_KEY and DATABASE_PASSWORD. The script
pins Baileys, PostgreSQL, Redis, and automatic session startup on the VM.
EOF
}

die() {
  echo "Error: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

dotenv_has_value() {
  local key="$1"
  grep -Eq "^[[:space:]]*${key}=[^[:space:]#].*$" "${ENV_FILE}"
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

require_command gcloud
require_command docker
require_command git
require_command curl

[[ -n "${DOMAIN}" ]] || die "Set OPENWA_DOMAIN"
[[ -n "${OPENWA_DASHBOARD_PASSWORD:-}" ]] || die "Set OPENWA_DASHBOARD_PASSWORD"
[[ -f "${ENV_FILE}" ]] || die "OpenWA env file not found: ${ENV_FILE}"
dotenv_has_value API_MASTER_KEY || die "API_MASTER_KEY must be set in ${ENV_FILE}"
dotenv_has_value DATABASE_PASSWORD || die "DATABASE_PASSWORD must be set in ${ENV_FILE}"

WORK_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "${WORK_DIR}"
}
trap cleanup EXIT

if [[ -n "${SOURCE_DIR}" && "${SOURCE_DIR}" != "upstream" ]]; then
  [[ -f "${SOURCE_DIR}/Dockerfile" ]] || die "OPENWA_SOURCE_DIR is not an OpenWA source tree"
  BUILD_CONTEXT="$(cd "${SOURCE_DIR}" && pwd)"
  git -C "${BUILD_CONTEXT}" rev-parse --is-inside-work-tree >/dev/null 2>&1 || \
    die "OPENWA_SOURCE_DIR must be a Git clone"
  [[ -z "$(git -C "${BUILD_CONTEXT}" status --porcelain)" ]] || \
    die "OpenWA source has uncommitted changes; commit them before deploying"
  SOURCE_LABEL="$(git -C "${BUILD_CONTEXT}" rev-parse --short=12 HEAD)"
else
  git clone --quiet --depth 1 --branch "${UPSTREAM_REF}" "${UPSTREAM_REPOSITORY}" "${WORK_DIR}/OpenWA"
  BUILD_CONTEXT="${WORK_DIR}/OpenWA"
  SOURCE_LABEL="${UPSTREAM_REF#v}"
fi

TAG="${SOURCE_LABEL}-$(date -u +%Y%m%d%H%M%S)"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${GAR_REPOSITORY}/openwa:${TAG}"
REGISTRY="${REGION}-docker.pkg.dev"

echo "Authenticating Docker to ${REGISTRY}..."
gcloud auth configure-docker "${REGISTRY}" --quiet

echo "Building and pushing ${IMAGE}..."
docker buildx build \
  --platform linux/amd64 \
  --push \
  --tag "${IMAGE}" \
  "${BUILD_CONTEXT}"

cp "${BUILD_CONTEXT}/docker-compose.yml" "${WORK_DIR}/docker-compose.yml"
cp "${ENV_FILE}" "${WORK_DIR}/openwa.env"
cat >>"${WORK_DIR}/openwa.env" <<EOF

# Enforced by scripts/deploy-openwa.sh
NODE_ENV=production
API_PORT=2785
DOMAIN=${DOMAIN}
BASE_URL=${SCHEME}://${DOMAIN}
CORS_ORIGINS=${SCHEME}://${DOMAIN}
ENGINE_TYPE=baileys
AUTO_START_SESSIONS=true
RESOLVE_LID_TO_PHONE=true
DATABASE_TYPE=postgres
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=openwa
DATABASE_USERNAME=openwa
DATABASE_SYNCHRONIZE=false
REDIS_ENABLED=true
REDIS_HOST=redis
REDIS_PORT=6379
STORAGE_TYPE=local
OPENWA_IMAGE=${IMAGE}
EOF

cat >"${WORK_DIR}/docker-compose.gcp.yml" <<'EOF'
services:
  openwa-api:
    image: ${OPENWA_IMAGE:?OPENWA_IMAGE is required}
    pull_policy: always

  caddy:
    image: caddy:2-alpine
    container_name: openwa-caddy
    restart: unless-stopped
    network_mode: host
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config

volumes:
  caddy-data:
  caddy-config:
EOF

printf '%s' "${OPENWA_DASHBOARD_PASSWORD}" >"${WORK_DIR}/dashboard-password"
chmod 600 "${WORK_DIR}/openwa.env" "${WORK_DIR}/dashboard-password"

echo "Waiting for VM bootstrap..."
gcloud compute ssh "${INSTANCE}" \
  --project="${PROJECT_ID}" \
  --zone="${ZONE}" \
  --tunnel-through-iap \
  --command="cloud-init status --wait >/dev/null && sudo test -d /var/lib/openwa/app"

echo "Uploading deployment configuration..."
gcloud compute scp \
  "${WORK_DIR}/docker-compose.yml" \
  "${WORK_DIR}/docker-compose.gcp.yml" \
  "${WORK_DIR}/openwa.env" \
  "${WORK_DIR}/dashboard-password" \
  "${INSTANCE}:/tmp/" \
  --project="${PROJECT_ID}" \
  --zone="${ZONE}" \
  --tunnel-through-iap \
  --quiet

REMOTE_SCRIPT=$(cat <<EOF
set -euo pipefail
cleanup_remote() {
  rm -f /tmp/docker-compose.yml /tmp/docker-compose.gcp.yml /tmp/openwa.env /tmp/dashboard-password
}
trap cleanup_remote EXIT
TOKEN=\$(curl -fsS -H 'Metadata-Flavor: Google' 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token' | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
printf '%s' "\${TOKEN}" | sudo docker login -u oauth2accesstoken --password-stdin 'https://${REGISTRY}' >/dev/null
sudo install -d -m 750 /var/lib/openwa/app
sudo install -m 640 /tmp/docker-compose.yml /var/lib/openwa/app/docker-compose.yml
sudo install -m 640 /tmp/docker-compose.gcp.yml /var/lib/openwa/app/docker-compose.gcp.yml
sudo install -m 600 /tmp/openwa.env /var/lib/openwa/app/.env
HASH=\$(sudo docker run --rm caddy:2-alpine caddy hash-password --plaintext "\$(cat /tmp/dashboard-password)")
sudo tee /var/lib/openwa/app/Caddyfile >/dev/null <<CADDY
${SCHEME}://${DOMAIN} {
  @dashboard not path /api/* /mcp*
  @apiDocs path /api/docs*
  basic_auth @dashboard {
    admin \${HASH}
  }
  basic_auth @apiDocs {
    admin \${HASH}
  }
  reverse_proxy 127.0.0.1:2785
}
CADDY
sudo chmod 640 /var/lib/openwa/app/Caddyfile
sudo sh -c 'cd /var/lib/openwa/app && docker compose -f docker-compose.yml -f docker-compose.gcp.yml --profile postgres --profile redis pull'
sudo systemctl enable openwa-compose.service
sudo systemctl restart openwa-compose.service
EOF
)

echo "Starting OpenWA..."
gcloud compute ssh "${INSTANCE}" \
  --project="${PROJECT_ID}" \
  --zone="${ZONE}" \
  --tunnel-through-iap \
  --command="${REMOTE_SCRIPT}"

echo "Checking OpenWA API health on the VM..."
API_READY=false
for attempt in {1..30}; do
  if gcloud compute ssh "${INSTANCE}" \
    --project="${PROJECT_ID}" \
    --zone="${ZONE}" \
    --tunnel-through-iap \
    --command="curl --fail --silent http://localhost:2785/api/health/ready" >/dev/null 2>&1; then
    API_READY=true
    break
  fi
  sleep 10
done

if [[ "${API_READY}" == "true" ]]; then
  echo "OpenWA API is healthy on the VM!"
  echo "Deployed image: ${IMAGE}"
  
  echo "Testing public URL access: ${SCHEME}://${DOMAIN}/api/health/ready ..."
  if curl --fail --silent --max-time 5 "${SCHEME}://${DOMAIN}/api/health/ready" >/dev/null 2>&1; then
    echo "OpenWA is publicly accessible: ${SCHEME}://${DOMAIN}"
    exit 0
  else
    echo "Warning: ${SCHEME}://${DOMAIN} is not reachable from your local machine yet."
    echo "This is normal if your DNS A record has not propagated or has not been configured yet."
    VM_IP=$(gcloud compute instances describe "${INSTANCE}" \
      --project="${PROJECT_ID}" \
      --zone="${ZONE}" \
      --format='get(networkInterfaces[0].accessConfigs[0].natIP)' 2>/dev/null || echo "<VM_IP>")
    echo "Please ensure your DNS A record points openwa.getcontactbook.com to the VM's external IP: ${VM_IP}"
    exit 0
  fi
else
  echo "OpenWA API did not become ready on the VM. Recent logs:" >&2
  gcloud compute ssh "${INSTANCE}" \
    --project="${PROJECT_ID}" \
    --zone="${ZONE}" \
    --tunnel-through-iap \
    --command="sudo sh -c 'cd /var/lib/openwa/app && docker compose -f docker-compose.yml -f docker-compose.gcp.yml logs --tail=100'"
  exit 1
fi
