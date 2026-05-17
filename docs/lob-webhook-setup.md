# Lob Webhook Setup

How to connect Lob's event stream to Plot's webhook receiver so postcard
lifecycle events (`postcard.delivered`, `postcard.returned_to_sender`, etc.)
update the corresponding `property_inquiries` row.

## What the webhook does

When Lob sends an event, Plot:

1. Verifies the HMAC signature using `LOB_WEBHOOK_SIGNING_SECRET`.
2. Records the event into `lob_webhook_events` (append-only audit log) —
   *even if signature verification fails*, for forensic visibility.
3. Updates the matching `property_inquiries` row's `mail_provider_status`
   and (for terminal events) the top-level `status`.

Implementation lives in [src/app/api/lob/webhook/route.ts](../src/app/api/lob/webhook/route.ts)
and helpers in [src/lib/lob-webhook.ts](../src/lib/lob-webhook.ts).

## Setup steps (one-time, per environment)

### 1. Generate the signing secret in Lob

1. Log in to the Lob dashboard.
2. Settings → Webhooks → "Add Endpoint" (you'll create one per environment
   — Test and Live).
3. URL: `https://<your domain>/api/lob/webhook`
   - For local dev with ngrok / Cloudflare Tunnel:
     `https://<your-tunnel-domain>/api/lob/webhook`
   - For production: `https://app.plot.solutions/api/lob/webhook`
4. Subscribe to the events you want. At minimum:
   - `postcard.delivered`
   - `postcard.returned_to_sender`
   - `postcard.failed`
   - `postcard.deleted`

   Recommended additions for richer lifecycle tracking:
   - `postcard.created`
   - `postcard.rendered_pdf`
   - `postcard.in_transit`
   - `postcard.in_local_area`
   - `postcard.processed_for_delivery`
   - `postcard.re-routed`

5. Save. Lob displays a **signing secret** — copy it immediately.

### 2. Add the secret to `.env.local`

```
LOB_WEBHOOK_SIGNING_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx
```

Restart the dev server so Next picks up the new env var.

For Vercel production, set the same env var via the Vercel dashboard
(do **not** commit it).

### 3. Verify with a Lob test event

In the Lob dashboard, the webhook endpoint page has a "Send test event"
button. Click it.

Check:
- Server logs: should show no errors.
- Supabase: `SELECT * FROM lob_webhook_events ORDER BY received_at DESC LIMIT 5;`
  — the test event should appear with `signature_valid = true`.

## What happens when signatures fail

We still 200 to Lob (so attackers can't tell we noticed) and still record
the row in `lob_webhook_events` with `signature_valid = false`. Query:

```sql
SELECT received_at, lob_event_id, event_type, payload
FROM lob_webhook_events
WHERE signature_valid = false
ORDER BY received_at DESC
LIMIT 50;
```

Anything in this list is either (a) Lob secret rotation that didn't make
it to env, (b) clock skew beyond 5 minutes, or (c) genuine spoofing
attempts. Investigate.

## Local development

Lob can't reach `localhost`. Two options:

**Option A — ngrok / Cloudflare Tunnel** (real Lob → real handler):

```sh
ngrok http 3000
# → grab the https URL, register it as the webhook endpoint in Lob,
# → then send real test events to it.
```

**Option B — synthesize events locally** (faster iteration):

You can `curl` your own endpoint with a hand-signed payload. Example
script (write your own — don't commit it):

```js
const crypto = require('crypto');
const body = JSON.stringify({
  id: 'evt_test',
  event_type: { id: 'postcard.delivered' },
  body: { id: 'psc_7c613b003bb6b4d1', object: 'postcard' },
});
const ts = Date.now().toString();
const sig = crypto.createHmac('sha256', process.env.LOB_WEBHOOK_SIGNING_SECRET)
  .update(`${ts}.${body}`).digest('hex');
// POST to http://localhost:3000/api/lob/webhook with headers:
//   lob-signature: <sig>
//   lob-signature-timestamp: <ts>
//   content-type: application/json
```

## Adjusting the replay-window tolerance

If genuine deliveries get rejected for `timestamp drift NNms exceeds
tolerance`, Lob's clocks are likely fine but our deploy environment's
clock is skewed. Either fix clock sync or relax
`SIGNATURE_TIMESTAMP_TOLERANCE_MS` in [src/lib/lob-webhook.ts](../src/lib/lob-webhook.ts).
Default is 5 minutes, matching Stripe's recommendation.
