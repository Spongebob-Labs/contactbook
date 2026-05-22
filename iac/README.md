# Contactbook infrastructure (OpenTofu)

| Directory | GCP project | Purpose |
|-----------|-------------|---------|
| [`opentofu/`](opentofu/) | `c-club-466412` | **Legacy** — existing state; run `tofu destroy` here when decommissioning |
| [`opentofu-new/`](opentofu-new/) | `project-c74d38dd-7e12-4d3f-bbf` | **New** — fresh state; use for all new applies |

Each directory is an independent OpenTofu root module (separate `terraform.tfstate`).

## New project: first apply

```bash
unset GOOGLE_APPLICATION_CREDENTIALS
gcloud auth application-default login
export GOOGLE_IMPERSONATE_SERVICE_ACCOUNT="contactbook-opentofu@project-c74d38dd-7e12-4d3f-bbf.iam.gserviceaccount.com"

cd iac/opentofu-new
tofu init
tofu plan
tofu apply
```

See [`opentofu-new/README.md`](opentofu-new/README.md).

**CI/CD cutover checklist:** [`../docs/gcp-ci-cutover.md`](../docs/gcp-ci-cutover.md) (GitHub secrets/variables — configure manually).
