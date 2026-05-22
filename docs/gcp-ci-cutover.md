# GCP CI/CD cutover (`project-c74d38dd-7e12-4d3f-bbf`)

Infrastructure is in [`iac/opentofu-new/`](../iac/opentofu-new/). Legacy project `c-club-466412` stays in [`iac/opentofu/`](../iac/opentofu/).

## OpenTofu outputs (for GitHub)

From `iac/opentofu-new` after `tofu apply`:

```bash
cd iac/opentofu-new
tofu output -raw github_actions_workload_identity_provider
tofu output -raw github_actions_service_account_email
tofu output -raw cloud_run_service_url
tofu output -raw profile_photos_bucket_name
tofu output -raw profile_photos_public_base_url
```

Current values (re-run commands if infra changed):

| Output | Typical use |
|--------|-------------|
| `github_actions_workload_identity_provider` | Secret `GCP_WORKLOAD_IDENTITY_PROVIDER` |
| `github_actions_service_account_email` | Secret `GCP_SERVICE_ACCOUNT` |
| `cloud_run_service_url` | `APP_PUBLIC_URL`, OAuth redirect base |
| `profile_photos_bucket_name` | `GCS_PROFILE_PHOTOS_BUCKET` |
| `profile_photos_public_base_url` | `GCS_PUBLIC_BASE_URL` |

## GitHub — you configure (not automated here)

### Repository variables

| Variable | Value |
|----------|--------|
| `GCP_PROJECT_ID` | `project-c74d38dd-7e12-4d3f-bbf` |
| `GCP_REGION` | `europe-west10` |
| `CLOUD_RUN_SERVICE` | `contactbook-api` (optional) |

### Repository secrets

| Secret | Set from |
|--------|----------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `tofu output -raw github_actions_workload_identity_provider` |
| `GCP_SERVICE_ACCOUNT` | `tofu output -raw github_actions_service_account_email` |
| `API_ENV_B64` | Base64 of production `apps/api/.env` (see below) |

```bash
# After editing apps/api/.env for production:
./scripts/encode-env-for-gh.sh   # copy the single line printed
# Settings → Secrets → API_ENV_B64 → paste
```

Image URI pattern (CI/CD):  
`europe-west10-docker.pkg.dev/project-c74d38dd-7e12-4d3f-bbf/contactbook/api:<tag>`

## `apps/api/.env` (production fields)

Aligned for Cloud Run / `API_ENV_B64`:

- `GCS_PROFILE_PHOTOS_BUCKET=contactbook-profile-photos-c74d38dd`
- `GCS_PUBLIC_BASE_URL=https://storage.googleapis.com/contactbook-profile-photos-c74d38dd`
- `GCS_PROJECT_ID=project-c74d38dd-7e12-4d3f-bbf`
- `APP_PUBLIC_URL` = `cloud_run_service_url`
- `GOOGLE_REDIRECT_URI` = `{APP_PUBLIC_URL}/api/v1/integrations/google/callback`

For **local dev**, override in `apps/api/.env.local` (e.g. `APP_PUBLIC_URL=http://localhost:8001`).

## Google OAuth Console

In [Google Cloud Console → APIs & Credentials → OAuth client](https://console.cloud.google.com/apis/credentials):

1. Open the client used by `GOOGLE_CLIENT_ID`.
2. **Authorized redirect URIs** — add:
   `https://contactbook-api-pnuvobkmza-oe.a.run.app/api/v1/integrations/google/callback`  
   (refresh from `tofu output -raw cloud_run_service_url` if the Run URL changes.)
3. Keep localhost redirect URIs if you still develop locally.

## Verify after secrets are set

Infra smoke check (May 2026): Cloud Run URL live, WIF pool `contactbook-github`, GCS bucket `contactbook-profile-photos-c74d38dd` in `europe-west10`. GAR repo exists but may have **no images** until first CI push; Run may still show the OpenTofu placeholder `hello` image until CD deploys your API image.

1. Push to `dev` or `main` (with `apps/api/**` changes).
2. CI: image push to `europe-west10-docker.pkg.dev/project-c74d38dd-7e12-4d3f-bbf/...`
3. CD: `gcloud run services describe contactbook-api --region=europe-west10 --project=project-c74d38dd-7e12-4d3f-bbf` — image should be `.../contactbook/api:<version>`, not `cloudrun/container/hello`.
4. Profile photos: `POST /api/v1/profile/me/photo` → URL under `GCS_PUBLIC_BASE_URL`.

Optional first image without waiting for CI:

```bash
gcloud config set project project-c74d38dd-7e12-4d3f-bbf
gcloud builds submit --config apps/api/cloudbuild.yaml \
  --substitutions=_REGION=europe-west10,_GAR_REPO=contactbook,_IMAGE_NAME=api,_IMAGE_TAG=latest .
```

## Rollback

Revert GitHub variables/secrets to legacy `c-club-466412` WIF outputs from `iac/opentofu`. See [`iac/opentofu/DESTROY-LEGACY.md`](../iac/opentofu/DESTROY-LEGACY.md).
