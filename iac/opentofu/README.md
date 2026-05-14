# Contactbook IaC (OpenTofu)

This directory provisions:

- **Google Artifact Registry** Docker repository
- **Cloud Run** service for the API (deploys an image from Artifact Registry)
- Optional: **API enablement** for common required services

The container build uses the existing `apps/api/Dockerfile`, which expects the **repo root** as the build context.

## Prerequisites

- OpenTofu installed (`tofu`)
- Google Cloud SDK (`gcloud`)
- A GCP project with billing enabled

Authenticate for Terraform/OpenTofu:

```bash
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

## Configure variables

Edit [`terraform.tfvars`](terraform.tfvars) in this directory (or copy from a private template). Set at least:

- `project_id`
- `region`

State is **local** by default (`terraform.tfstate` in this directory). No `backend.hcl` is required until you move to GCS (below).

## Provision GAR + Cloud Run

From this directory:

```bash
tofu init
tofu fmt -recursive
tofu plan
tofu apply
```

Outputs include:

- Cloud Run service URL
- Artifact Registry repo
- Deployed image URI

## Remote state (GCS) — optional, migrate later

When you are ready:

1. Ensure a GCS bucket exists (create one in the console, with **versioning** on, or set `create_terraform_state_bucket = true`, set `terraform_state_bucket` to a globally unique name, add `storage.googleapis.com` to `apis` in `terraform.tfvars`, apply once with **local** state so `google_storage_bucket.terraform_state` is created).

2. In [`versions.tf`](versions.tf), add a partial backend inside the `terraform { }` block:

   ```hcl
   backend "gcs" {}
   ```

3. Copy [`backend.hcl.example`](backend.hcl.example) to `backend.hcl` (gitignored), set `bucket` and `prefix`.

4. Migrate existing local state into the bucket:

   ```bash
   tofu init -backend-config=backend.hcl -migrate-state
   ```

If you previously added `backend "gcs" {}` and a `backend.hcl` but want to stay on **local** state for now, remove the `backend "gcs" {}` block from `versions.tf`, delete or rename `backend.hcl`, and run `tofu init -reconfigure` so OpenTofu uses the default local backend again.

## Build + push the API image to GAR

This repo includes a Cloud Build config at `apps/api/cloudbuild.yaml` that:

- builds using `apps/api/Dockerfile`
- uses repo root (`.`) as build context
- pushes to `${REGION}-docker.pkg.dev/${PROJECT_ID}/${GAR_REPO}/${IMAGE_NAME}:${IMAGE_TAG}`

Run a one-off build locally (no GitHub triggers required):

```bash
gcloud builds submit \
  --config apps/api/cloudbuild.yaml \
  --substitutions=_REGION=us-central1,_GAR_REPO=contactbook,_IMAGE_NAME=api,_IMAGE_TAG=latest \
  .
```

Then redeploy Cloud Run to the new tag by updating `image_tag` (or keep `latest`) and re-applying:

```bash
tofu apply
```

### Local Docker build

`prisma generate` in the Dockerfile reads `DATABASE_URL` via a BuildKit secret (not baked into layers). From the **repository root**:

```bash
export DATABASE_URL="postgresql://..."   # any URL Prisma accepts for generate
docker buildx build -f apps/api/Dockerfile \
  --secret id=database_url,env=DATABASE_URL \
  -t contactbook-api:local .
```

## CI/CD (GitHub Actions)

- **CI** (`.github/workflows/ci.yml`) uses repository secret `DATABASE_URL` and OIDC secrets to push images to GAR on push to `main` or `dev`.
- **CD** (`.github/workflows/cd.yml`) runs after a successful CI run for a **push** to `main` and updates Cloud Run to `…/contactbook/api:<commit-sha>`.

Configure repository **variables**: `GCP_REGION`, `GCP_PROJECT_ID`, and optionally `CLOUD_RUN_SERVICE` (defaults to `contactbook-api`). Configure **secrets**: `DATABASE_URL`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`.

## Notes

- **Secrets**: pass non-sensitive config via `var.env`. For secrets, prefer Secret Manager + Cloud Run secret env var wiring (can be added later).
- **Auth**: `allow_unauthenticated=true` makes the API public (`roles/run.invoker` to `allUsers`). Set to `false` if you want authenticated-only access.
