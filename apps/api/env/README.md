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

## Runtime env → Google Secret Manager (per-var)

Cloud Run **runtime** env is served from Secret Manager, one secret per variable —
`cb-api-<env>-<KEY>` — referenced by `cd.yml` via `--set-secrets`. The list of vars
to materialize lives in the committed, values-free key files
[`prod.keys`](prod.keys) / [`uat.keys`](uat.keys). This means you change one variable
without touching the rest, and you can always read the current value back.

Seed or update all secrets from a filled-in env file (needs `gcloud` + Secret Manager
admin on the project; grants `secretAccessor` to the Cloud Run runtime SA):

```bash
python3 scripts/sync-secrets-to-gcp.py apps/api/env/prod.env prod \
  --project "$GCP_PROJECT_ID" --service-account "$CLOUD_RUN_RUNTIME_SA"
python3 scripts/sync-secrets-to-gcp.py apps/api/env/uat.env uat \
  --project "$GCP_PROJECT_ID" --service-account "$CLOUD_RUN_RUNTIME_SA"
```

It only adds a new secret version when a value actually changed, and rewrites the
`.keys` file. Commit the updated `.keys` file. The next `apps/api/**` push redeploys
and picks up `:latest`.

**Add one variable** (the common case):

```bash
printf 'the-value' | gcloud secrets create cb-api-prod-NEW_VAR \
  --project="$GCP_PROJECT_ID" --replication-policy=automatic \
  --labels=app=contactbook,env=prod --data-file=-
gcloud secrets add-iam-policy-binding cb-api-prod-NEW_VAR \
  --project="$GCP_PROJECT_ID" --member="serviceAccount:$CLOUD_RUN_RUNTIME_SA" \
  --role=roles/secretmanager.secretAccessor --condition=None
echo NEW_VAR >> apps/api/env/prod.keys   # commit this
```

**Rotate a value:** `printf 'new' | gcloud secrets versions add cb-api-prod-JWT_SECRET --data-file=-`
**Read current value:** `gcloud secrets versions access latest --secret=cb-api-prod-JWT_SECRET`

## Build/test env — still the base64 blob

The Docker build (`prisma generate`) and `api-test.yml` still decode
`API_ENV_PROD_B64` / `API_ENV_UAT_B64` into `apps/api/.env`. These rarely change and
don't include runtime integration config (Twilio, etc.). Update them only when a
build/test-time var changes:

```bash
./scripts/encode-env-for-gh.sh apps/api/env/prod.env   # → API_ENV_PROD_B64
./scripts/encode-env-for-gh.sh apps/api/env/uat.env    # → API_ENV_UAT_B64
```

## Infra outputs

Refresh URLs and GCS names after `tofu apply`:

```bash
cd iac/envs/prod && tofu output -raw cloud_run_service_url
cd iac/envs/uat && tofu output -raw cloud_run_service_url
```

See [`../../../docs/gcp-ci-cutover.md`](../../../docs/gcp-ci-cutover.md).
