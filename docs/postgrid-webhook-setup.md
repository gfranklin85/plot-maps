# PostGrid Webhook Setup

How to connect PostGrid's event stream to Plot's webhook receiver so
postcard lifecycle events update the corresponding `property_inquiries`
row.

## What the webhook does

When PostGrid sends an event, Plot:

1. Verifies the HMAC signature using `POSTGRID_WEBHOOK_SIGNING_SECRET`.
2. Records the event into the audit log table (`lob_webhook_events`
   currently; rename pending — see migration history). Records even if
   signature verification fails, for forensic visibility.
3. Updates the matching `property_inquiries` row's `mail_provider_status`
   and (for terminal events) the top-level `status`.

Implementation:
- [src/app/api/postgrid/webhook/route.ts](../src/app/api/postgrid/webhook/route.ts) — the receiver
- [src/lib/postgrid-webhook.ts](../src/lib/postgrid-webhook.ts) — pure helpers (signature, extraction, status mapping)

## Setup steps (one-time, per environment)

### 1. Create the webhook in PostGrid

PostGrid dashboard → **Webhooks** → **Create Webhook**:

- **Description**: `Plot Maps Webhook` (or environment-specific name)
- **URL**: `https://app.plot.solutions/api/postgrid/webhook`
  - For local dev with ngrok / Cloudflare Tunnel: `https://<your-tunnel-domain>/api/postgrid/webhook`
- **Payload Format**: **JSON** (not JWT — our receiver expects JSON)
- **Event Types**: subscribe to all available (the receiver handles unknowns gracefully). At minimum:
  - `postcard.created`
  - `postcard.updated` ← the important one; this fires on every status change
  - `tracker.visited` ← if/when we add QR codes to postcards

Click **Create**. PostGrid will show you the signing secret — **copy it immediately**.

### 2. Add the secret to env

`.env.local` (local dev):
```
POSTGRID_WEBHOOK_SIGNING_SECRET=<the secret>
```

Vercel (production):
- Dashboard → Project → Settings → Environment Variables
- Add `POSTGRID_WEBHOOK_SIGNING_SECRET` with the same value
- Trigger a redeploy so production picks up the env change

### 3. Verify wiring with a test event

PostGrid dashboard → your webhook → look for a "Send Test Event" or
"Replay" affordance. Trigger a test send.

Check Supabase:
```sql
SELECT received_at, lob_event_id, event_type, signature_valid, payload
FROM lob_webhook_events
ORDER BY received_at DESC
LIMIT 5;
```

A successful test shows the event with `signature_valid = true`.

## How PostGrid's events map to Plot's inquiry status

PostGrid blends two lifecycle dimensions in the postcard payload:

**`status` field** (PostGrid's internal lifecycle):
- `ready` → just created
- `printing` → handed to printer
- `processed_for_delivery` → handed to postal service
- `completed` → believed delivered
- `cancelled` → never sent

**`imbStatus` field** (US live orders only — real USPS scans):
- `entered_mail_stream` → scanned at USPS facility
- `out_for_delivery` → final USPS facility, will deliver today/tomorrow
- `returned_to_sender` → undeliverable

Plot maps these to `property_inquiries.status` like this:
- `imbStatus=returned_to_sender` → `status='failed'`
- `status=completed` (no imb) → `status='delivered'`, stamps `delivered_at`
- `status=cancelled` → `status='failed'`
- Everything else → updates `mail_provider_status` only, top-level status untouched

See [mapPostGridEventToInquiryUpdate in src/lib/postgrid-webhook.ts](../src/lib/postgrid-webhook.ts) for the canonical logic.

## What happens when signatures fail

We still 200 to PostGrid (so attackers can't tell we noticed) and still
record the row in the audit log with `signature_valid = false`. Query:

```sql
SELECT received_at, lob_event_id, event_type, payload
FROM lob_webhook_events
WHERE signature_valid = false
ORDER BY received_at DESC
LIMIT 50;
```

Anything in this list is either (a) PostGrid secret rotation that didn't
make it to env, (b) signature encoding mismatch (we accept both hex and
base64 — investigate which PostGrid sent), or (c) genuine spoofing
attempts. Investigate.

## Local development

PostGrid can't reach `localhost`. Two options:

**Option A — ngrok / Cloudflare Tunnel** (real PostGrid → real handler):

```sh
ngrok http 3000
# → grab the https URL, register it as the webhook endpoint in PostGrid,
# → then send real test events to it.
```

**Option B — synthesize events locally**:

Sign your own payload with the configured secret, POST to
`http://localhost:3000/api/postgrid/webhook` with the right headers.
The verifier accepts both hex and base64 encoded signatures.

## Adjusting the replay-window tolerance

If genuine deliveries get rejected for `timestamp drift NNms exceeds
tolerance`, deploy environment's clock may be skewed. Either fix clock
sync or relax `SIGNATURE_TIMESTAMP_TOLERANCE_MS` in
[src/lib/postgrid-webhook.ts](../src/lib/postgrid-webhook.ts).
Default is 5 minutes (matches Stripe's recommendation). Note that
PostGrid's timestamp header is optional — if absent we accept based on
signature match alone.
