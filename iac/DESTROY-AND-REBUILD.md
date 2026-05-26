# Destroy and rebuild (greenfield, local OpenTofu)

Use when you want a clean **Prod** + **UAT** stack in `project-c74d38dd-7e12-4d3f-bbf` with local `tofu apply` and your **Google user** (no service-account impersonation).

| Env | Cloud Run | Profile bucket |
|-----|-----------|----------------|
| Prod | `contactbook-api` | `contactbook-profile-photos-c74d38dd` |
| UAT | `contactbook-api-uat` | `contactbook-profile-photos-uat-c74d38dd` |

**Warning:** Phase 1 deletes live API, GAR images, profile photos, and GitHub WIF until Phase 2 completes.

## Phase 0 — Auth

```bash
cd "/Users/khanf/Work/SaaS King/contactbook"
unset GOOGLE_APPLICATION_CREDENTIALS
unset GOOGLE_IMPERSONATE_SERVICE_ACCOUNT
gcloud auth application-default login
gcloud config set project project-c74d38dd-7e12-4d3f-bbf
```

Providers use ADC only ([`envs/*/providers.tf`](envs/platform/providers.tf)). Your user needs Owner or equivalent on the project.

Lock file issues: `rm -rf .terraform && tofu init` in each env directory.

## Phase 1 — Tear down GCP

```bash
export PROJECT=project-c74d38dd-7e12-4d3f-bbf
export REGION=europe-west10

gcloud run services delete contactbook-api-uat --region=$REGION --project=$PROJECT --quiet 2>/dev/null || true
gcloud run services delete contactbook-api --region=$REGION --project=$PROJECT --quiet

gsutil -m rm -r gs://contactbook-profile-photos-uat-c74d38dd 2>/dev/null || true
gsutil -m rm -r gs://contactbook-profile-photos-c74d38dd 2>/dev/null || true

gcloud artifacts repositories delete contactbook --location=$REGION --project=$PROJECT --quiet

gcloud iam workload-identity-pools providers delete github-oidc \
  --location=global --workload-identity-pool=contactbook-github --project=$PROJECT --quiet 2>/dev/null || true
gcloud iam workload-identity-pools delete contactbook-github \
  --location=global --project=$PROJECT --quiet 2>/dev/null || true
gcloud iam service-accounts delete contactbook-github-actions@$PROJECT.iam.gserviceaccount.com \
  --project=$PROJECT --quiet 2>/dev/null || true

rm -f iac/envs/*/terraform.tfstate* iac/opentofu-new/terraform.tfstate*
```

## Phase 2 — Apply (platform → prod → uat)

Ensure `terraform.tfvars` exists in each env (see `.example` files).

```bash
cd iac/envs/platform
tofu init && tofu plan -out=tfplan && tofu apply tfplan

cd ../prod
tofu init && tofu plan -out=tfplan && tofu apply tfplan

cd ../uat
tofu init && tofu plan -out=tfplan && tofu apply tfplan
```

Outputs:

```bash
cd iac/envs/platform
tofu output -raw github_actions_workload_identity_provider
tofu output -raw github_actions_service_account_email
cd ../prod && tofu output -raw cloud_run_service_url
cd ../uat && tofu output -raw cloud_run_service_url
```

## Phase 3 — GitHub and app config

See [`../docs/gcp-ci-cutover.md`](../docs/gcp-ci-cutover.md):

- `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT` from platform
- `API_ENV_PROD_B64`, `API_ENV_UAT_B64` from encoded `apps/api/env/prod.env` and `uat.env`
- OAuth redirect URIs for both Cloud Run URLs

Do **not** run `tofu destroy` in [`opentofu-new/`](opentofu-new/) unless you intend to delete resources still tracked there.
