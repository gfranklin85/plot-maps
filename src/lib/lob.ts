/**
 * Lob print-and-mail client wrapper.
 *
 * Picks test/live keys from env and exposes a small, Plot-shaped API
 * over `@lob/lob-typescript-sdk`. All callers go through this file so
 * we have one place to:
 *   - flip environment (test vs live) via LOB_ENVIRONMENT
 *   - log costs into Plot's cost_events table
 *   - normalize error shapes for callers that don't want to know
 *     about Axios responses
 *
 * Default environment is "test" unless LOB_ENVIRONMENT=live is set
 * explicitly. That means we cannot accidentally send real mail just
 * by deploying — flipping to live is a deliberate env-var change.
 *
 * Why TEST is the default and why we'd ever want LIVE in dev:
 *   - Test mode: Lob accepts the call, returns a fake postcard ID and
 *     a renderable PDF preview, charges nothing, mails nothing.
 *   - Live mode: real money, real mail. Only when explicitly opted in.
 */

import {
  PostcardsApi,
  AddressesApi,
  PostcardEditable,
  AddressEditable,
  Configuration,
  PostcardSize as LobPostcardSize,
  CountryExtended,
  PscUseType,
  MailType as LobMailType,
} from '@lob/lob-typescript-sdk';
import { logCost } from '@/lib/cost-tracker';

type LobEnv = 'test' | 'live';

function getEnv(): LobEnv {
  return process.env.LOB_ENVIRONMENT === 'live' ? 'live' : 'test';
}

function getApiKey(): string {
  const env = getEnv();
  const key =
    env === 'live'
      ? process.env.LOB_API_KEY_LIVE
      : process.env.LOB_API_KEY_TEST;
  if (!key) {
    throw new Error(
      `Lob: missing API key for ${env} environment. ` +
        `Set LOB_API_KEY_${env.toUpperCase()} in env.`
    );
  }
  return key;
}

// Lazy-init the SDK clients so importing this file in a build context
// (e.g., TypeScript type checking) doesn't crash if env isn't ready.
let _postcards: PostcardsApi | null = null;
let _addresses: AddressesApi | null = null;

function postcardsClient(): PostcardsApi {
  if (!_postcards) {
    const config = new Configuration({ username: getApiKey() });
    _postcards = new PostcardsApi(config);
  }
  return _postcards;
}

function addressesClient(): AddressesApi {
  if (!_addresses) {
    const config = new Configuration({ username: getApiKey() });
    _addresses = new AddressesApi(config);
  }
  return _addresses;
}

// ── Cost estimates (USD) ─────────────────────────────────────────────
// Plot pre-records cost so the wallet/usage UI shows what the user is
// spending in near-real time, before Lob's billing settles. Values are
// approximate retail; tune when we have actual invoices to compare.
const POSTCARD_COST_USD: Record<PostcardSize, number> = {
  '4x6': 0.92,
  '6x9': 1.39,
  '6x11': 1.99,
};

export type PostcardSize = '4x6' | '6x9' | '6x11';
export type MailType = 'usps_first_class' | 'usps_standard';
export type UseType = 'marketing' | 'operational';

/** Shape we accept from callers; we instantiate the Lob AddressEditable internally. */
export interface AddressInput {
  name: string;
  address_line1: string;
  address_line2?: string;
  address_city: string;
  address_state: string;
  address_zip: string;
}

export interface SendPostcardArgs {
  /** Owner-facing recipient address (where the postcard lands). */
  to: AddressInput;
  /** Return address (where USPS sends it back if undeliverable). */
  from: AddressInput;
  /** Front-side artwork. HTML string or URL to a hosted PDF/PNG/JPG. */
  front: string;
  /** Back-side artwork. Same format options as `front`. */
  back: string;
  /** Merge variables for {{handlebars}} replacement in front/back HTML. */
  mergeVariables?: Record<string, unknown>;
  /** Postcard size. 4x6 is cheapest and the only size for international. */
  size?: PostcardSize;
  /** Mail class. usps_standard is cheaper but excludes 4x6 + intl. */
  mailType?: MailType;
  /** Required: marketing vs operational. Affects USPS reporting + Plot policy. */
  useType: UseType;
  /** Internal description for the Lob dashboard. */
  description?: string;
  /**
   * Metadata sent to Lob and echoed back via webhooks. Use this to
   * correlate postcards back to Plot rows (inquiry_id, lead_id, etc.).
   * Lob limits to 20 keys, 40-char keys, 500-char values.
   */
  metadata?: Record<string, string>;
  /** Plot user_id for cost tracking. Pass null for system-initiated sends. */
  userId: string | null;
}

export interface SendPostcardResult {
  id: string;
  url: string;
  expectedDeliveryDate: string | null;
  environment: LobEnv;
}

// Map our plain-string size to Lob's enum. SDK's enum uses leading-underscore
// names because its values start with digits (TypeScript enum constraint).
const SIZE_ENUM: Record<PostcardSize, LobPostcardSize> = {
  '4x6': LobPostcardSize._4x6,
  '6x9': LobPostcardSize._6x9,
  '6x11': LobPostcardSize._6x11,
};

const USE_TYPE_ENUM: Record<UseType, PscUseType> = {
  marketing: PscUseType.Marketing,
  operational: PscUseType.Operational,
};

const MAIL_TYPE_ENUM: Record<MailType, LobMailType> = {
  usps_first_class: LobMailType.FirstClass,
  usps_standard: LobMailType.Standard,
};

function toLobAddress(a: AddressInput): AddressEditable {
  return new AddressEditable({
    name: a.name,
    address_line1: a.address_line1,
    address_line2: a.address_line2,
    address_city: a.address_city,
    address_state: a.address_state,
    address_zip: a.address_zip,
    address_country: CountryExtended.Us,
  });
}

/**
 * Send a postcard via Lob. Returns the postcard ID and a signed URL to
 * a PDF preview (always present, including in test mode).
 *
 * Throws a normalized Error on Lob failures — callers should catch and
 * decide whether to surface the message to the user.
 */
export async function sendPostcard(args: SendPostcardArgs): Promise<SendPostcardResult> {
  const env = getEnv();
  const size = args.size || '4x6';
  const mailType = args.mailType || 'usps_first_class';

  const payload = new PostcardEditable({
    to: toLobAddress(args.to),
    from: toLobAddress(args.from),
    front: args.front,
    back: args.back,
    size: SIZE_ENUM[size],
    mail_type: MAIL_TYPE_ENUM[mailType],
    use_type: USE_TYPE_ENUM[args.useType],
    description: args.description,
    merge_variables: args.mergeVariables,
    metadata: args.metadata,
  });

  try {
    const postcard = await postcardsClient().create(payload);

    // Pre-record cost (estimate). Webhook will reconcile actuals later
    // if we want exact billing; this gives near-realtime user-visible spend.
    logCost(args.userId, 'lob', `postcard_${size}_${env}`, POSTCARD_COST_USD[size], 1, {
      postcard_id: postcard.id,
      size,
      mail_type: mailType,
      use_type: args.useType,
      environment: env,
      ...args.metadata,
    });

    return {
      id: postcard.id,
      url: postcard.url,
      expectedDeliveryDate: postcard.expected_delivery_date ?? null,
      environment: env,
    };
  } catch (err: unknown) {
    throw normalizeLobError(err, 'sendPostcard');
  }
}

/**
 * Cancel a postcard that hasn't yet been sent to production. Returns
 * true if cancellation succeeded. Only works during the cancellation
 * window (before send_date or default ~5 minutes). Lob will 404 if
 * the postcard already shipped.
 */
export async function cancelPostcard(postcardId: string): Promise<boolean> {
  try {
    await postcardsClient().cancel(postcardId);
    return true;
  } catch (err: unknown) {
    throw normalizeLobError(err, 'cancelPostcard');
  }
}

/**
 * Verify a US address by creating it in Lob's address book. This runs
 * Lob's US Verification engine for free, returning the canonicalized
 * (uppercase, ZIP+4) form. Use this BEFORE sendPostcard if we want to
 * fail loudly on bad addresses without burning a postcard send.
 */
export async function verifyAddress(input: AddressInput): Promise<AddressEditable> {
  try {
    const addr = await addressesClient().create(toLobAddress(input));
    return addr as unknown as AddressEditable;
  } catch (err: unknown) {
    throw normalizeLobError(err, 'verifyAddress');
  }
}

/**
 * Lob's SDK throws Axios-shaped errors with the useful info nested at
 * err.response.data.error.message. Surface a clean Error so callers
 * don't need to know that.
 */
function normalizeLobError(err: unknown, op: string): Error {
  const axiosErr = err as {
    response?: { data?: { error?: { message?: string; code?: string; status_code?: number } } };
    message?: string;
  };
  const lobMessage = axiosErr.response?.data?.error?.message;
  const lobCode = axiosErr.response?.data?.error?.code;
  const httpStatus = axiosErr.response?.data?.error?.status_code;
  const detail = lobMessage || axiosErr.message || 'unknown error';
  const tag = lobCode ? `[${lobCode}]` : httpStatus ? `[${httpStatus}]` : '';
  return new Error(`Lob ${op} failed ${tag}: ${detail}`.trim());
}

/** Returns the current environment Lob is configured for. */
export function lobEnvironment(): LobEnv {
  return getEnv();
}
