# UAT environment (OpenTofu)

**New** stack: Cloud Run **`contactbook-api-uat`** and GCS **`contactbook-profile-photos-uat-c74d38dd`**.

CD on **`dev`** deploys images tagged `0.1.<run_number>-uat` here.

Apply [`../platform/`](../platform/) and [`../prod/`](../prod/) (or import prod) before UAT if you rely on shared GAR/WIF only from platform.

```bash
cp terraform.tfvars.example terraform.tfvars   # if terraform.tfvars is missing
cd iac/envs/uat
rm -rf .terraform && tofu init
tofu plan    # expect creates (greenfield; no moved.tf)
tofu apply
```
