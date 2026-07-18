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

## Runtime env: base64 blob + Secret Manager (hybrid)

On deploy, `cd.yml` sets Cloud Run env from **two** sources:

1. **Literals** — the base64 blob (`API_ENV_*_B64`), decoded and applied via
   `--env-vars-file`, **minus** any key listed in the env's `*.secret-keys` file.
2. **Secret refs** — every name in [`prod.secret-keys`](prod.secret-keys) /
   [`uat.secret-keys`](uat.secret-keys) is injected via `--set-secrets` as
   `cb-api-<env>-<NAME>:latest` from Google Secret Manager.

A var is **either** a literal or a secret ref, never both — that's why secret-managed
keys are excluded from the blob side. `prod.secret-keys` currently holds the Twilio
vars; `uat.secret-keys` is empty (UAT takes everything from its blob).

### Move a var to Secret Manager (console, no CLI)

1. **Secret Manager → Create secret**: name `cb-api-<env>-<VARNAME>` (e.g.
   `cb-api-prod-TWILIO_OTP_CONTENT_SID`), paste the value, create.
2. **IAM**: grant the Cloud Run **runtime** service account
   `Secret Manager Secret Accessor` on it (Secret Manager → the secret →
   Permissions → Grant access). Granting once at the project level covers all.
3. Add the `VARNAME` to `apps/api/env/<env>.secret-keys` and commit.
4. Next `apps/api/**` deploy picks it up. **Create the secret before the deploy** or
   it fails.

**Rotate:** Secret Manager → secret → **+ New version** → redeploy (uses `:latest`).
**Read current value:** Secret Manager → secret → version → **View secret value**.

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
