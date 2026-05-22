# First apply (new project)

Your shell may set `GOOGLE_APPLICATION_CREDENTIALS` to the **legacy** SA key (`opentofu-key.json`). That blocks impersonation for this project.

```bash
unset GOOGLE_APPLICATION_CREDENTIALS
gcloud auth application-default login
export GOOGLE_IMPERSONATE_SERVICE_ACCOUNT="contactbook-opentofu@project-c74d38dd-7e12-4d3f-bbf.iam.gserviceaccount.com"

cd iac/opentofu-new
tofu init
tofu plan
tofu apply
```

After apply, copy outputs into GitHub secrets and `apps/api/.env` (`GCS_*`).
