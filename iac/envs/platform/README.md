# Platform (shared GCP resources)

Single apply per project: **Artifact Registry** (`contactbook`), **API enablement**, **GitHub Workload Identity Federation**.

UAT and Prod environment stacks depend on this; apply platform before `envs/uat` or `envs/prod`.

See [`../../MIGRATE.md`](../../MIGRATE.md) when moving state from `iac/opentofu-new`.
