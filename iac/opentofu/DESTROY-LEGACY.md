# Decommission legacy project (`c-club-466412`)

When the new stack in [`../envs/`](../envs/) is live and you no longer need legacy infra:

```bash
unset GOOGLE_IMPERSONATE_SERVICE_ACCOUNT
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/opentofu-key.json"

cd iac/opentofu
gcloud config set project c-club-466412
tofu plan
tofu destroy
```

This directory's `terraform.tfstate` and `terraform.tfvars` stay as-is (no workspace migration).
