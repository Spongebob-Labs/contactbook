# Contactbook infrastructure (OpenTofu)

| Directory | GCP project | Purpose |
|-----------|-------------|---------|
| [`opentofu/`](opentofu/) | `c-club-466412` | **Legacy** — existing state; run `tofu destroy` when decommissioning |
| [`envs/platform/`](envs/platform/) | `project-c74d38dd-7e12-4d3f-bbf` | **Shared** — GAR, APIs, GitHub WIF |
| [`envs/prod/`](envs/prod/) | same | **Prod (live)** — `contactbook-api`, `contactbook-profile-photos-c74d38dd` |
| [`envs/uat/`](envs/uat/) | same | **UAT (new)** — `contactbook-api-uat`, `contactbook-profile-photos-uat-c74d38dd` |
| [`opentofu-new/`](opentofu-new/) | same | **Deprecated** — migrate to `envs/*` ([`MIGRATE.md`](MIGRATE.md)) |

Each `envs/*` directory has its own `terraform.tfstate`.

## Apply order

```bash
unset GOOGLE_APPLICATION_CREDENTIALS
gcloud auth application-default login
export GOOGLE_IMPERSONATE_SERVICE_ACCOUNT="contactbook-opentofu@project-c74d38dd-7e12-4d3f-bbf.iam.gserviceaccount.com"

# 1. Platform (once)
cd iac/envs/platform
cp terraform.tfvars.example terraform.tfvars
tofu init && tofu apply

# 2. Prod (migrate or import existing contactbook-api)
cd ../prod
cp terraform.tfvars.example terraform.tfvars
tofu init && tofu apply

# 3. UAT (new resources)
cd ../uat
cp terraform.tfvars.example terraform.tfvars
tofu init && tofu apply
```

**CI/CD:** [`../docs/gcp-ci-cutover.md`](../docs/gcp-ci-cutover.md) — `main` → Prod, `dev` → UAT.

**Migration:** [`MIGRATE.md`](MIGRATE.md) (includes path when `opentofu-new/terraform.tfstate` is missing).
