# Prod environment (OpenTofu)

Manages the live Cloud Run API, profile-photo bucket, and the optional stateful
Compute Engine OpenWA gateway.

CD on **`main`** deploys images tagged `0.1.<run_number>` here.

Apply [`../platform/`](../platform/) first. Migration: [`../../MIGRATE.md`](../../MIGRATE.md).

```bash
cp terraform.tfvars.example terraform.tfvars   # if terraform.tfvars is missing
cd iac/envs/prod
rm -rf .terraform && tofu init
tofu plan
```

With `enable_openwa_vm = true`, the plan includes a single `e2-medium` VM, a
reserved external IP, a protected persistent data disk with daily snapshots,
IAP-only SSH, and public ports 80/443. Deploy the containers separately with
`scripts/deploy-openwa.sh` after DNS points at the output IP.
