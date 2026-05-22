# New GCP project stack

OpenTofu for **`project-c74d38dd-7e12-4d3f-bbf`**. Local state lives only in this directory (fresh `terraform.tfstate` on first apply).

- Auth: impersonates `contactbook-opentofu@project-c74d38dd-7e12-4d3f-bbf.iam.gserviceaccount.com` (see `providers.tf`). Run `gcloud auth application-default login` first.
- Legacy project **`c-club-466412`** remains in [`../opentofu/`](../opentofu/) — do not change that folder when migrating.
- **CI/CD cutover** (GitHub variables/secrets, `API_ENV_B64`, OAuth): [`../../docs/gcp-ci-cutover.md`](../../docs/gcp-ci-cutover.md).

---

# Contactbook IaC (OpenTofu)

This directory provisions:

- **Google Artifact Registry** Docker repository
- **Cloud Run** service for the API (deploys an image from Artifact Registry)
- **GCS bucket** `contactbook-profile-photos` for public profile photo URLs (when `create_profile_photos_bucket = true`)
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
- `profile_photos_bucket_name` and `profile_photos_public_base_url` (for API env)

## Profile photos bucket (GCS)

When **`create_profile_photos_bucket`** is `true` (default), OpenTofu creates **`contactbook-profile-photos`** (override with `profile_photos_bucket_name`) in **`var.region`** with:

- **Public read** (`allUsers` → `roles/storage.objectViewer`) for `<img src>` URLs
- **CORS** GET/HEAD for origins in `profile_photos_cors_origins` (align with API `CORS_ORIGIN` / your web app)
- **`roles/storage.objectAdmin`** on the bucket for the Cloud Run **runtime** service account (`cloud_run_service_account_email` or the project default compute SA)

Ensure **`storage.googleapis.com`** is in `apis` when `enable_apis` is true, then apply:

```bash
tofu apply
```

Set in `apps/api/.env` (and `API_ENV_B64` for production):

```bash
GCS_PROFILE_PHOTOS_BUCKET="<profile_photos_bucket_name output>"
GCS_PUBLIC_BASE_URL="<profile_photos_public_base_url output>"
```

To disable bucket creation (e.g. bucket already exists elsewhere), set `create_profile_photos_bucket = false` in `terraform.tfvars`.

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

`prisma generate` in the Dockerfile reads a full dotenv file via BuildKit file secret **`api_env`** (not persisted in image layers). From the **repository root**, with `apps/api/.env` populated (e.g. from `.env.example`):

```bash
./scripts/build-api.sh
# or:
docker buildx build -f apps/api/Dockerfile \
  --secret id=api_env,src=apps/api/.env \
  -t contactbook-api:local .
```

## CI/CD (GitHub Actions)

- **CI** (`.github/workflows/ci.yml`) uses repository secrets **`API_ENV_B64`** (and optionally **`API_ENV_CI_B64`**), **`GCP_WORKLOAD_IDENTITY_PROVIDER`**, **`GCP_SERVICE_ACCOUNT`**, and OIDC to push images to GAR on push to `main` or `dev` (tags `:sha` and `:0.1.<run_number>`).
- **CD** (`.github/workflows/cd.yml`) runs after a successful CI run for a **push** to `main` or `dev`: decodes **`API_ENV_B64`**, then updates Cloud Run to image `…/contactbook/api:<version>` and applies env keys via **`--env-vars-file`** (JSON produced by [../../scripts/dotenv-to-gcloud-env-json.py](../../scripts/dotenv-to-gcloud-env-json.py)). Apply DB migrations locally with [../../scripts/migrate-api.sh](../../scripts/migrate-api.sh).

Configure repository **variables**: `GCP_REGION`, `GCP_PROJECT_ID`, and optionally `CLOUD_RUN_SERVICE` (defaults to `contactbook-api`). Configure **secrets** as above.

Encode `apps/api/.env` for the `API_ENV_B64` secret: [../../scripts/encode-env-for-gh.sh](../../scripts/encode-env-for-gh.sh).

## GitHub Workload Identity Federation (OpenTofu)

When **`enable_github_actions_wif`** is `true` in [`terraform.tfvars`](terraform.tfvars), OpenTofu creates:

- A **Workload Identity Pool** + **GitHub OIDC provider** (`token.actions.githubusercontent.com`) scoped with `attribute_condition` to your **`github_repository`** (`owner/repo`).
- A **service account** used by GitHub Actions, with **`roles/artifactregistry.writer`** on this module’s Artifact Registry repo and **`roles/run.developer`** on the project (Cloud Run deploy/update).
- **`roles/iam.serviceAccountUser`** on **`cloud_run_service_account_email`** when that variable is set (so deploy can attach the runtime SA to new revisions). If Cloud Run still uses the default identity, set `cloud_run_service_account_email` to a dedicated runtime SA and apply, or grant `serviceAccountUser` manually for the default compute SA.

Also enables **`sts.googleapis.com`** and **`iamcredentials.googleapis.com`** whenever WIF is enabled (merged with `apis`).

After `tofu apply`, copy outputs into GitHub **Actions** repository secrets:

| Output | GitHub secret name |
|--------|--------------------|
| `github_actions_workload_identity_provider` | `GCP_WORKLOAD_IDENTITY_PROVIDER` |
| `github_actions_service_account_email` | `GCP_SERVICE_ACCOUNT` |

Workflows already use `permissions: id-token: write` for OIDC.

## Notes

- **Secrets**: pass non-sensitive config via `var.env`. For secrets, prefer Secret Manager + Cloud Run secret env var wiring (can be added later).
- **Auth**: `allow_unauthenticated=true` makes the API public (`roles/run.invoker` to `allUsers`). Set to `false` if you want authenticated-only access.
