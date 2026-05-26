# Contactbook infrastructure (OpenTofu)

| Directory | GCP project | Purpose |
|-----------|-------------|---------|
| [`opentofu/`](opentofu/) | `c-club-466412` | **Legacy** — existing state; run `tofu destroy` when decommissioning |
| [`envs/platform/`](envs/platform/) | `project-c74d38dd-7e12-4d3f-bbf` | **Shared** — GAR, APIs, GitHub WIF |
| [`envs/prod/`](envs/prod/) | same | **Prod** — `contactbook-api`, `contactbook-profile-photos-c74d38dd` |
| [`envs/uat/`](envs/uat/) | same | **UAT** — `contactbook-api-uat`, `contactbook-profile-photos-uat-c74d38dd` |

Each `envs/*` directory has its own `terraform.tfstate` (gitignored).

## Local apply (Google user ADC)

OpenTofu uses **your** Application Default Credentials — no service-account impersonation.

```bash
unset GOOGLE_APPLICATION_CREDENTIALS
unset GOOGLE_IMPERSONATE_SERVICE_ACCOUNT
gcloud auth application-default login
gcloud config set project project-c74d38dd-7e12-4d3f-bbf
```

Your Google account needs sufficient IAM on the project (e.g. Owner).

## Apply order

```bash
# 1. Platform (GAR + GitHub WIF)
cd iac/envs/platform
cp -n terraform.tfvars.example terraform.tfvars
tofu init && tofu apply

# 2. Prod
cd ../prod
cp -n terraform.tfvars.example terraform.tfvars
tofu init && tofu apply

# 3. UAT
cd ../uat
cp -n terraform.tfvars.example terraform.tfvars
tofu init && tofu apply
```

**Greenfield destroy + rebuild:** [`DESTROY-AND-REBUILD.md`](DESTROY-AND-REBUILD.md)  
**State migration (keep existing resources):** [`MIGRATE.md`](MIGRATE.md)  
**CI/CD secrets:** [`../docs/gcp-ci-cutover.md`](../docs/gcp-ci-cutover.md)
