# ContactBook OpenWA Runbook

ContactBook uses OpenWA as its WhatsApp provider. OpenWA must run with the Baileys engine, have a ready linked session, and be reachable from the ContactBook API.

## Configuration

Configure the API with `WHATSAPP_PROVIDER=openwa`, the OpenWA base URL, an `OPERATOR` API key, session ID, sender phone, webhook secret, and request timeout. Use a stable HTTPS URL or private service address outside local development.

The API health response includes the OpenWA session readiness under `whatsapp`. A non-ready or unreachable session reports `degraded` while the health endpoint remains available.

## Register The Webhook

Register the ContactBook endpoint after deploying the API. Replace placeholders with the OpenWA session, API key, API public URL, and the same secret configured as `OPENWA_WEBHOOK_SECRET`:

```bash
curl -X POST "OPENWA_BASE_URL/api/sessions/OPENWA_SESSION_ID/webhooks" \
  -H "X-API-Key: OPENWA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "CONTACTBOOK_API_URL/api/v1/webhooks/openwa/whatsapp",
    "events": ["message.received", "message.ack", "message.failed"],
    "secret": "OPENWA_WEBHOOK_SECRET",
    "retryCount": 3
  }'
```

Register once per environment and update the registration whenever the API URL or secret changes.

## Cold Sends And OTP

OpenWA attempts first-contact messages but WhatsApp may reject them with provider error `463`. ContactBook returns `RECIPIENT_INITIATION_REQUIRED` for OTP requests with a `wa.me` link. The user sends `START` to `+919676240186` and retries the OTP request.

The gateway must include `errorCode: "463"` in its `message.failed` webhook for
that specialized mapping. Base OpenWA `v0.7.13` emits the failed status without
the numeric code, so ContactBook records a generic delivery failure in that
configuration. This does not affect established text conversations.

Pending connection requests remain stored when delivery fails. Their requester can retry with `POST /api/v1/connections/requests/:id/resend` after the recipient initiates the WhatsApp conversation.

## Deployment Order

1. Deploy and migrate ContactBook API.
2. Start OpenWA and confirm its session is `ready`.
3. Register the signed ContactBook webhook.
4. Verify API health reports `whatsapp.ready: true`.
5. Send an OTP and a connection request, then verify inbound replies and delivery updates.
