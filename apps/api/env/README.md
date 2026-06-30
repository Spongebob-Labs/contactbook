# API environment files (Prod / UAT)

Store **one dotenv file per deployed environment**. CI/CD reads these via GitHub secrets (`API_ENV_PROD_B64`, `API_ENV_UAT_B64`), not from this folder directly.

| File | Environment | Cloud Run | GitHub secret |
|------|-------------|-----------|---------------|
| [`prod.env`](prod.env) | Production (`main`) | `contactbook-api` | `API_ENV_PROD_B64` |
| [`uat.env`](uat.env) | UAT (`dev`) | `contactbook-api-uat` | `API_ENV_UAT_B64` |

Templates (safe to commit): [`prod.env.example`](prod.env.example), [`uat.env.example`](uat.env.example).

OpenWA is deployed separately from the API. Its base URL must be reachable from Cloud Run over HTTPS or a private network; `localhost` is valid only when both processes run on the same machine.

## Setup

```bash
cd apps/api/env
cp prod.env.example prod.env
cp uat.env.example uat.env
# Edit prod.env and uat.env — use separate Supabase projects/DBs for Prod vs UAT when possible
```

For **local development**, keep using [`../.env`](../.env) and optional [`../.env.local`](../.env.local) (see [`../.env.example`](../.env.example)).

## Encode for GitHub Actions

From repo root (after `prod.env` / `uat.env` are filled in):

```bash
# Prod → Settings → Secrets → API_ENV_PROD_B64
base64 < apps/api/env/prod.env | tr -d '\n' | pbcopy

# UAT → API_ENV_UAT_B64
base64 < apps/api/env/uat.env | tr -d '\n' | pbcopy
```

Or from repo root:

```bash
./scripts/encode-env-for-gh.sh apps/api/env/prod.env
./scripts/encode-env-for-gh.sh apps/api/env/uat.env
```

## Infra outputs

Refresh URLs and GCS names after `tofu apply`:

```bash
cd iac/envs/prod && tofu output -raw cloud_run_service_url
cd iac/envs/uat && tofu output -raw cloud_run_service_url
```

See [`../../../docs/gcp-ci-cutover.md`](../../../docs/gcp-ci-cutover.md).
