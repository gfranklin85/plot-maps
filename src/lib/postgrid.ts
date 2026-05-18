/**
 * PostGrid print-and-mail client wrapper.
 *
 * Direct REST client (no third-party SDK). PostGrid's API is small enough
 * that pulling in a community-maintained SDK adds risk without much
 * benefit; this file is the entire surface area Plot needs.
 *
 * All callers go through this file so we have one place to:
 *   - flip environment (test vs live) via POSTGRID_ENVIRONMENT
 *   - log costs into Plot's cost_events table
 *   - normalize PostGrid's error shape for callers
 *
 * Default environment is "test" unless POSTGRID_ENVIRONMENT=live is set
 * explicitly. We cannot accidentally send real mail just by deploying;
 * flipping to live is a deliberate env-var change.
 *
 * PostGrid REST docs: https://docs.postgrid.com/
 */

import { logCost } from '@/lib/cost-tracker';

type PgEnv = 'test' | 'live';

const BASE_URL = 'https://api.postgrid.com/print-mail/v1';

function getEnv(): PgEnv {
  return process.env.POSTGRID_ENVIRONMENT === 'live' ? 'live' : 'test';
}

function getApiKey(): string {
  const env = getEnv();
  const key =
    env === 'live'
      ? process.env.POSTGRID_API_KEY_LIVE
      : process.env.POSTGRID_API_KEY_TEST;
  if (!key) {
    throw new Error(
      `PostGrid: missing API key for ${env} environment. ` +
        `Set POSTGRID_API_KEY_${env.toUpperCase()} in env.`
    );
  }
  return key;
}

// ── Cost estimates (USD) — PostGrid Starter tier retail, July 2025 ──
// Tune when we have actual invoices. Same pattern as Lob: pre-record
// estimated cost on send so the wallet UI shows near-realtime spend
// before PostGrid's billing settles.
const POSTCARD_COST_USD: Record<PostcardSize, number> = {
  '6x4': 0.862,
  '9x6': 0.983,
  '11x6': 1.249,
};

// PostGrid sizes are written as "width x height" — note 6x4 not 4x6.
// We translate Plot's (Lob-convention) "4x6" external API to PostGrid's "6x4".
export type PostcardSize = '6x4' | '9x6' | '11x6';
export type MailingClass =
  | 'first_class'
  | 'standard_class'
  | 'usps_first_class'
  | 'usps_standard_class';

export interface AddressInput {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  provinceOrState: string;
  postalOrZip: string;
  countryCode?: string; // ISO 3166-1 alpha-2, defaults to 'US'
}

export interface SendPostcardArgs {
  /** Owner-facing recipient (where the postcard lands). */
  to: AddressInput;
  /** Return address (where USPS sends it back if undeliverable). */
  from: AddressInput;
  /** Front-side artwork — HTML string or URL to a hosted PDF/PNG/JPG. */
  frontHTML: string;
  /** Back-side artwork — same format options. */
  backHTML: string;
  /** Postcard size. 6x4 is cheapest. */
  size?: PostcardSize;
  /** Mailing class. */
  mailingClass?: MailingClass;
  /** Merge variables for {{handlebars}} in front/back HTML. */
  mergeVariables?: Record<string, unknown>;
  /** Description visible in PostGrid dashboard for debugging. */
  description?: string;
  /**
   * Metadata echoed back via webhooks. Use this to correlate postcards
   * back to Plot rows (inquiry_id, lead_id, etc.). 10kb soft limit per
   * PostGrid docs. Values must be strings (PostGrid accepts richer
   * types but we constrain for consistency with the Lob pattern).
   */
  metadata?: Record<string, string>;
  /** Plot user_id for cost tracking. Pass null for system-initiated sends. */
  userId: string | null;
}

export interface SendPostcardResult {
  id: string;                          // pc_* PostGrid order id
  status: string;                      // 'ready' on initial create
  url: string | null;                  // signed PDF preview (may be null at creation, fills in within seconds)
  expectedDeliveryDate: string | null;
  environment: PgEnv;
}

/**
 * Send a postcard via PostGrid. Returns the order ID + signed PDF
 * preview URL (PostGrid generates the preview within seconds of creation,
 * so the URL may be null on the immediate response and fill in shortly).
 *
 * Throws a normalized Error on PostGrid failures.
 */
export async function sendPostcard(args: SendPostcardArgs): Promise<SendPostcardResult> {
  const env = getEnv();
  const size = args.size || '6x4';
  const mailingClass = args.mailingClass || 'first_class';

  // PostGrid accepts URL-encoded forms or JSON. JSON is cleaner and
  // matches the rest of Plot's request-shape conventions.
  const body: Record<string, unknown> = {
    to: pgAddress(args.to),
    from: pgAddress(args.from),
    frontHTML: args.frontHTML,
    backHTML: args.backHTML,
    size,
    mailingClass,
  };
  if (args.description) body.description = args.description;
  if (args.metadata) body.metadata = args.metadata;
  if (args.mergeVariables) body.mergeVariables = args.mergeVariables;

  const response = await pgFetch('/postcards', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const postcard = response as {
    id: string;
    status: string;
    url?: string | null;
    expectedDeliveryDate?: string | null;
  };

  // Pre-record cost estimate. Webhook can reconcile actual cost later.
  logCost(args.userId, 'postgrid', `postcard_${size}_${env}`, POSTCARD_COST_USD[size], 1, {
    postcard_id: postcard.id,
    size,
    mailing_class: mailingClass,
    environment: env,
    ...args.metadata,
  });

  return {
    id: postcard.id,
    status: postcard.status,
    url: postcard.url ?? null,
    expectedDeliveryDate: postcard.expectedDeliveryDate ?? null,
    environment: env,
  };
}

/**
 * Cancel a postcard that's still in `ready` status. PostGrid returns
 * 422 (cancel_failed_error) if the order has progressed past `ready`.
 * See PostGrid docs > Cancellation for the timing window.
 */
export async function cancelPostcard(postcardId: string): Promise<boolean> {
  await pgFetch(`/postcards/${postcardId}`, { method: 'DELETE' });
  return true;
}

/**
 * Verify a US address by running PostGrid's address verification.
 * Returns the cleaned/canonicalized form. Throws if undeliverable
 * (per account address strictness setting).
 */
export async function verifyAddress(input: AddressInput): Promise<AddressInput & { id: string }> {
  const result = await pgFetch('/contacts', {
    method: 'POST',
    body: JSON.stringify(pgAddress(input)),
  });
  return result as AddressInput & { id: string };
}

/** Returns the current environment PostGrid is configured for. */
export function postgridEnvironment(): PgEnv {
  return getEnv();
}

// ── Internal helpers ────────────────────────────────────────────────

function pgAddress(a: AddressInput): Record<string, unknown> {
  // PostGrid requires either firstName/lastName OR companyName.
  // We accept either input shape and pass through.
  const out: Record<string, unknown> = {
    addressLine1: a.addressLine1,
    city: a.city,
    provinceOrState: a.provinceOrState,
    postalOrZip: a.postalOrZip,
    countryCode: a.countryCode || 'US',
  };
  if (a.firstName) out.firstName = a.firstName;
  if (a.lastName) out.lastName = a.lastName;
  if (a.companyName) out.companyName = a.companyName;
  if (a.addressLine2) out.addressLine2 = a.addressLine2;
  return out;
}

/**
 * Wrapper around fetch() that handles PostGrid auth, JSON content-type,
 * and error normalization. Returns the parsed JSON body on success;
 * throws a normalized Error on any 4xx/5xx.
 */
async function pgFetch(path: string, init: RequestInit): Promise<unknown> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'x-api-key': getApiKey(),
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers });
  } catch (err) {
    throw new Error(`PostGrid ${init.method || 'GET'} ${path} network error: ${(err as Error).message}`);
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // Non-JSON response — keep raw text for the error.
      if (!response.ok) {
        throw new Error(`PostGrid ${init.method || 'GET'} ${path} [${response.status}]: ${text.slice(0, 500)}`);
      }
    }
  }

  if (!response.ok) {
    // PostGrid error shape: { error: { type, message } }
    const errObj = (parsed as { error?: { type?: string; message?: string } } | null)?.error;
    const tag = errObj?.type ? `[${errObj.type}]` : `[${response.status}]`;
    const message = errObj?.message || `HTTP ${response.status}`;
    throw new Error(`PostGrid ${init.method || 'GET'} ${path} ${tag}: ${message}`);
  }

  return parsed;
}
