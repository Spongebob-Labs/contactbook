# GCP CI/CD cutover (`project-c74d38dd-7e12-4d3f-bbf`)

Infrastructure uses **Prod** (existing) and **UAT** (new) in the same GCP project. Legacy project `c-club-466412` stays in [`iac/opentofu/`](../iac/opentofu/).

| Stack | Path | Cloud Run | Image tag (CI) |
|-------|------|-----------|----------------|
| Platform (shared) | [`iac/envs/platform/`](../iac/envs/platform/) | — | — |
| **Prod** (live today) | [`iac/envs/prod/`](../iac/envs/prod/) | `contactbook-api` | `0.1.<run>` on **`main`** |
| **UAT** (new) | [`iac/envs/uat/`](../iac/envs/uat/) | `contactbook-api-uat` | `0.1.<run>-uat` on **`dev`** |

State migration: [`iac/MIGRATE.md`](../iac/MIGRATE.md).  
Greenfield wipe + local apply: [`iac/DESTROY-AND-REBUILD.md`](../iac/DESTROY-AND-REBUILD.md).

## Local OpenTofu auth

Use your Google user (not `contactbook-opentofu` impersonation):

```bash
unset GOOGLE_APPLICATION_CREDENTIALS GOOGLE_IMPERSONATE_SERVICE_ACCOUNT
gcloud auth application-default login
```

## OpenTofu outputs (for GitHub)

**Platform** (WIF + GAR):

```bash
cd iac/envs/platform
tofu output -raw github_actions_workload_identity_provider
tofu output -raw github_actions_service_account_email
```

**Prod** (`main` CD / `API_ENV_PROD_B64`):

```bash
cd iac/envs/prod
tofu output -raw cloud_run_service_url
tofu output -raw profile_photos_bucket_name
tofu output -raw profile_photos_public_base_url
```

**UAT** (`dev` CD / `API_ENV_UAT_B64`):

```bash
cd iac/envs/uat
tofu output -raw cloud_run_service_url
tofu output -raw profile_photos_bucket_name
tofu output -raw profile_photos_public_base_url
```

## GitHub — you configure (not automated here)

### Repository variables (shared)

| Variable | Value |
|----------|--------|
| `GCP_PROJECT_ID` | `project-c74d38dd-7e12-4d3f-bbf` |
| `GCP_REGION` | `europe-west1` |
| `CLOUD_RUN_SERVICE_PROD` | `contactbook-api` (optional; default) |
| `CLOUD_RUN_SERVICE_UAT` | `contactbook-api-uat` (optional; default) |

### Repository secrets

| Secret | Environment | Set from |
|--------|-------------|----------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | both | `iac/envs/platform` output |
| `GCP_SERVICE_ACCOUNT` | both | `iac/envs/platform` output |
| `API_ENV_PROD_B64` | Prod (`main` CI/CD) | Base64 of `apps/api/env/prod.env` |
| `API_ENV_UAT_B64` | UAT (`dev` CI/CD) | Base64 of `apps/api/env/uat.env` |

**Cutover:** If `API_ENV_UAT_B64` is unset, CI Deploy on `dev` falls back to legacy `API_ENV_B64`. PR CI uses `API_ENV_CI_B64` or `API_ENV_B64`.

```bash
./scripts/encode-env-for-gh.sh apps/api/env/prod.env
./scripts/encode-env-for-gh.sh apps/api/env/uat.env
```

### GitHub Actions pipeline

| Event | Workflows |
|-------|-----------|
| PR → `dev` / `main` | **CI** — tests only |
| Push / merge → `dev` | **CI Deploy** → **CD** (`deploy-uat`) — no release |
| Push / merge → `main` | **CI Deploy** → **CD** (`deploy-prod`) → **release-prod** (main only, if deploy ran) |

Merge to `dev`/`main` is a `push` event (same as a direct push). No workflow artifacts; images are in GAR only.

Merge workflow file changes to **`main`** before `dev` picks up updated `workflow_run` behavior (CD reads workflows from the default branch).

Image URI pattern (shared GAR repo):

`europe-west1-docker.pkg.dev/project-c74d38dd-7e12-4d3f-bbf/contactbook/api:<tag>`

- Prod (`main`): `0.1.42`
- UAT (`dev`): `0.1.42-uat`

## `apps/api/env/` per environment

Keep **`apps/api/env/prod.env`** and **`apps/api/env/uat.env`** (gitignored; templates in `*.env.example`). Encode each for GitHub secrets.

Use **separate** Supabase/DB and URLs per environment.

**Prod** (`API_ENV_PROD_B64`) — existing stack:

- `GCS_PROFILE_PHOTOS_BUCKET=contactbook-profile-photos-c74d38dd`
- `GCS_PUBLIC_BASE_URL=https://storage.googleapis.com/contactbook-profile-photos-c74d38dd`
- `APP_PUBLIC_URL` = Prod `cloud_run_service_url` (`contactbook-api`)
- `GOOGLE_REDIRECT_URI` = `{APP_PUBLIC_URL}/api/v1/integrations/google/callback`

**UAT** (`API_ENV_UAT_B64`) — from `iac/envs/uat` outputs after apply:

- `GCS_PROFILE_PHOTOS_BUCKET=contactbook-profile-photos-uat-c74d38dd`
- `APP_PUBLIC_URL` = UAT `cloud_run_service_url` (`contactbook-api-uat`)

For **local dev**, override in `apps/api/.env.local`.

## Google OAuth Console

Keep the **Prod** redirect URI for `contactbook-api`. Add a **second** redirect for UAT Run URL when UAT exists.

## Verify after secrets are set

1. Open PR to **`dev`** → **CI** tests only (no CI Deploy / CD / release).
2. Merge or push to **`dev`** → **CI Deploy** tag `…-uat` → **CD** updates **`contactbook-api-uat`** (no release).
3. Merge or push to **`main`** with `apps/api` change → **CI Deploy** → **CD** Prod → GitHub Release `api-v0.1.<N>` (only if deploy ran).
3. `gcloud run services describe contactbook-api --region=europe-west1 --project=project-c74d38dd-7e12-4d3f-bbf`
4. `gcloud run services describe contactbook-api-uat --region=europe-west1 --project=project-c74d38dd-7e12-4d3f-bbf`

## Rollback

Revert GitHub variables/secrets to legacy `c-club-466412` WIF outputs from `iac/opentofu`. See [`iac/opentofu/DESTROY-LEGACY.md`](../iac/opentofu/DESTROY-LEGACY.md).
