# OpenWA GCP Deployment

OpenWA runs on a single Compute Engine VM because its WhatsApp session and
long-lived Baileys connection are stateful. ContactBook's API remains on Cloud
Run. Docker data, the OpenWA database, Redis data, media, sessions, and Caddy
certificates live on a separate persistent disk mounted at `/var/lib/openwa`.

## Source Version

The deployment script defaults to the checked-out
[`fardeen9983/OpenWA`](https://github.com/fardeen9983/OpenWA) fork. Its `main`
branch starts from upstream `v0.7.14` and carries the ContactBook gateway
changes as normal Git commits.
The active ContactBook integration only needs upstream text messages, signed
webhooks, delivery events, Baileys, and LID-to-phone resolution. It does not
need the experimental button endpoint from the local POC.

Upstream `v0.7.13` reports delivery failure status but does not include the
numeric WhatsApp failure code in `message.failed`. Text delivery and inbound
Accept/Decline handling work with the base release. ContactBook will record a
generic failed delivery when no code is present; the special
`RECIPIENT_INITIATION_REQUIRED` mapping requires a future upstream or forked
change that exposes code `463`.

Use the clean local fork clone for production. The script refuses to deploy a
dirty checkout and tags the image with its commit SHA. Set
`OPENWA_SOURCE_DIR=upstream` only for an explicit comparison with pristine
upstream behavior.

## 1. Provision The VM

Ensure the platform stack has enabled `compute.googleapis.com`, then apply the
production stack:

```bash
cd iac/envs/platform
tofu init
tofu apply

cd ../prod
tofu init
tofu plan
tofu apply
tofu output openwa_external_ip
```

The OpenWA data disk and VM have deletion protection. Removing the module will
fail until those protections are deliberately disabled.

## 2. Configure DNS

Create this DNS record and wait for it to resolve:

```text
Type: A
Host: openwa
Value: <openwa_external_ip output>
```

Caddy obtains the TLS certificate after `openwa.getcontactbook.com` resolves
to the reserved VM address.

## 3. Prepare OpenWA Configuration

Start from the upstream `.env.example` or the existing ignored
`OpenWA/.env`. At minimum, set strong values for:

```dotenv
API_MASTER_KEY=replace-with-a-long-random-value
DATABASE_PASSWORD=replace-with-a-long-random-value
```

The deploy script enforces production, Baileys, PostgreSQL, Redis, automatic
session startup, LID phone resolution, and the public domain. Do not commit the
dotenv file.

## 4. Deploy The Gateway

Authenticate to GCP and run:

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project project-c74d38dd-7e12-4d3f-bbf

OPENWA_DOMAIN=openwa.getcontactbook.com \
OPENWA_DASHBOARD_PASSWORD='replace-with-a-strong-password' \
OPENWA_ENV_FILE="$PWD/OpenWA/.env" \
./scripts/deploy-openwa.sh
```

The script builds the committed local fork, pushes it to the existing
ContactBook Artifact Registry, uploads runtime configuration over IAP SSH,
starts the Compose stack, and waits for the HTTPS readiness endpoint. The
dashboard and API documentation use HTTP Basic authentication; OpenWA API
routes continue to require an OpenWA API key.

To deploy another pinned upstream release, set `OPENWA_UPSTREAM_REF`. To deploy
the current local gateway while testing a fix, set:

```bash
OPENWA_SOURCE_DIR="$PWD/OpenWA" \
OPENWA_DOMAIN=openwa.getcontactbook.com \
OPENWA_DASHBOARD_PASSWORD='replace-with-a-strong-password' \
./scripts/deploy-openwa.sh
```

## 5. Link And Configure ContactBook

Open `https://openwa.getcontactbook.com`, authenticate as `admin`, create an
operator API key, create a Baileys session, and link `+919676240186`.

Configure ContactBook with:

```dotenv
WHATSAPP_PROVIDER=openwa
OPENWA_BASE_URL=https://openwa.getcontactbook.com
OPENWA_API_KEY=<operator-api-key>
OPENWA_SESSION_ID=<linked-session-id>
OPENWA_SENDER_PHONE=919676240186
OPENWA_WEBHOOK_SECRET=<shared-webhook-secret>
```

Register the webhook using
[`openwa-contactbook-runbook.md`](openwa-contactbook-runbook.md), then verify
the ContactBook health endpoint reports `whatsapp.ready: true`.

## Operations

View logs:

```bash
gcloud compute ssh contactbook-openwa \
  --zone=europe-west1-b \
  --tunnel-through-iap \
  --command='cd /var/lib/openwa/app && sudo docker compose -f docker-compose.yml -f docker-compose.gcp.yml logs -f --tail=200'
```

Redeploying creates a new immutable image tag and leaves the previous image in
Artifact Registry for rollback. To roll back, replace `OPENWA_IMAGE` in
`/var/lib/openwa/app/.env` with an earlier tag and restart
`openwa-compose.service`.
