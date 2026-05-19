#!/usr/bin/env bash
# Build, push to GAR, and deploy to Cloud Run locally.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/apps/api/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Copy apps/api/.env.example and edit." >&2
  exit 1
fi

# Configuration Defaults
GCP_PROJECT_ID="${GCP_PROJECT_ID:-c-club-466412}"
GCP_REGION="${GCP_REGION:-europe-west10}"
SERVICE_NAME="${SERVICE_NAME:-contactbook-api}"

# Generate image tag
TAG="local-$(git rev-parse --short HEAD)"
IMAGE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/contactbook/api:${TAG}"

echo "Building and pushing image: ${IMAGE}"

docker buildx build \
  --push \
  --secret "id=api_env,src=${ENV_FILE}" \
  -f apps/api/Dockerfile \
  -t "${IMAGE}" \
  -t contactbook-api:local \
  "${ROOT}"

echo "Generating Cloud Run environment variables JSON..."
ENV_JSON="/tmp/cloudrun-env-${TAG}.json"
python3 "${ROOT}/scripts/dotenv-to-gcloud-env-json.py" "${ENV_FILE}" "${ENV_JSON}"

echo "Deploying to Cloud Run..."
gcloud run services update "${SERVICE_NAME}" \
  --project="${GCP_PROJECT_ID}" \
  --region="${GCP_REGION}" \
  --image="${IMAGE}" \
  --env-vars-file="${ENV_JSON}" \
  --quiet

echo "Deployment complete! Cleaning up..."
rm -f "${ENV_JSON}"
