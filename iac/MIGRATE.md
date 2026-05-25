# Migrate from `iac/opentofu-new` to `iac/envs/*`

The **live stack today is Prod**: `contactbook-api` + `contactbook-profile-photos-c74d38dd`.  
**UAT** is a new greenfield stack: `contactbook-api-uat` + `contactbook-profile-photos-uat-c74d38dd`.

| Role | Path | Cloud Run | Profile bucket |
|------|------|-----------|----------------|
| Platform | `envs/platform` | — | — |
| Prod (existing) | `envs/prod` | `contactbook-api` | `contactbook-profile-photos-c74d38dd` |
| UAT (new) | `envs/uat` | `contactbook-api-uat` | `contactbook-profile-photos-uat-c74d38dd` |

**Do not run `tofu destroy` in `opentofu-new`** — that deletes Prod.

## Order

1. **Platform** — GAR, APIs, GitHub WIF  
2. **Prod** — adopt existing Cloud Run + bucket (state copy + `moved.tf`, or **import** if no state)  
3. **UAT** — greenfield `tofu apply` (no `moved.tf` in uat)

## 0. Auth and provider init

```bash
cd "/Users/khanf/Work/SaaS King/contactbook"
unset GOOGLE_APPLICATION_CREDENTIALS
gcloud auth application-default login
export GOOGLE_IMPERSONATE_SERVICE_ACCOUNT="contactbook-opentofu@project-c74d38dd-7e12-4d3f-bbf.iam.gserviceaccount.com"
```

If you see lock-file / checksum errors:

```bash
rm -rf .terraform
tofu init
```

## Path A — you have `iac/opentofu-new/terraform.tfstate`

### 1. Backup state

```bash
cd iac/opentofu-new
rm -rf .terraform && tofu init
tofu state list
cp terraform.tfstate terraform.tfstate.backup.$(date +%Y%m%d)
cp terraform.tfstate ../envs/platform/terraform.tfstate
cp terraform.tfstate.backup.* ../envs/prod/terraform.tfstate
```

### 2. Platform

```bash
cd ../envs/platform
cp -n terraform.tfvars.example terraform.tfvars
rm -rf .terraform && tofu init
tofu plan -out=tfplan-platform
tofu apply tfplan-platform
```

### 3. Prod

```bash
cd ../prod
cp -n terraform.tfvars.example terraform.tfvars
rm -rf .terraform && tofu init
tofu state list

for addr in $(tofu state list | grep -E 'artifact_registry|github_actions|workload_identity|google_project_service'); do
  tofu state rm "$addr"
done

tofu plan -out=tfplan-prod
tofu apply tfplan-prod
```

### 4. UAT (greenfield)

```bash
cd ../uat
rm -f terraform.tfstate terraform.tfstate.backup*
cp -n terraform.tfvars.example terraform.tfvars
rm -rf .terraform && tofu init
tofu plan -out=tfplan-uat
tofu apply tfplan-uat
```

## Path B — no local `terraform.tfstate` (common)

Skip copying from `opentofu-new`. Adopt live GCP resources instead.

### 1. Platform

```bash
cd iac/envs/platform
cp -n terraform.tfvars.example terraform.tfvars
rm -rf .terraform && tofu init
tofu plan
```

If plan wants to **create** GAR/WIF that already exist, **import** them (see OpenTofu import docs) or align config until plan shows no unwanted creates. Then `tofu apply`.

### 2. Prod (import existing service + bucket)

```bash
cd ../prod
cp -n terraform.tfvars.example terraform.tfvars
rm -rf .terraform && tofu init

tofu import 'module.environment.google_cloud_run_v2_service.api' \
  'projects/project-c74d38dd-7e12-4d3f-bbf/locations/europe-west10/services/contactbook-api'

tofu import 'module.environment.google_storage_bucket.profile_photos[0]' \
  contactbook-profile-photos-c74d38dd

# Import IAM members if plan still wants to create them (addresses from tofu plan)
tofu plan
tofu apply
```

Review every plan: **no destroy** on `contactbook-api` or the profile bucket.

### 3. UAT

```bash
cd ../uat
cp -n terraform.tfvars.example terraform.tfvars
rm -rf .terraform && tofu init
tofu plan -out=tfplan-uat
tofu apply tfplan-uat
```

## 5. Retire `opentofu-new`

```bash
cd iac/opentofu-new
# Do NOT tofu destroy
mv terraform.tfstate terraform.tfstate.retired.$(date +%Y%m%d) 2>/dev/null || true
```

## Verify

```bash
cd iac/envs/platform && tofu output
cd ../prod && tofu output -raw cloud_run_service_url
cd ../uat && tofu output -raw cloud_run_service_url
```

GitHub: [`docs/gcp-ci-cutover.md`](../docs/gcp-ci-cutover.md) — `API_ENV_PROD_B64`, `API_ENV_UAT_B64`, `CLOUD_RUN_SERVICE_PROD=contactbook-api`, `CLOUD_RUN_SERVICE_UAT=contactbook-api-uat`.
