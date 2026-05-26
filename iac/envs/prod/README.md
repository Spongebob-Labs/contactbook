# Prod environment (OpenTofu)

Manages the **live** Prod stack: Cloud Run **`contactbook-api`** and GCS **`contactbook-profile-photos-c74d38dd`**.

CD on **`main`** deploys images tagged `0.1.<run_number>` here.

Apply [`../platform/`](../platform/) first. Migration: [`../../MIGRATE.md`](../../MIGRATE.md).

```bash
cp terraform.tfvars.example terraform.tfvars   # if terraform.tfvars is missing
cd iac/envs/prod
rm -rf .terraform && tofu init
tofu plan
```
