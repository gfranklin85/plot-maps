// Centralized tier definitions — used by all API routes for limits
// Price IDs must match Stripe products in .env.local

export interface TierConfig {
  key: string;
  label: string;
  geocodes: number;       // monthly limit (lifetime for free)
  skipTraces: number;     // monthly limit (lifetime for free)
  callingMinutes: number; // 0 = manual dialing only (Twilio minutes)
  hasDialer: boolean;
  hasPhoneNumber: boolean;
  unlimitedStreetView: boolean;
  overageSkipTraceCents: number;      // cost per extra skip trace (0 = no overages)
  aiMinutes: number;                  // AI caller minutes (monthly; lifetime for free)
  aiOverageCentsPerMin: number;       // AI caller overage rate (0 = no overages)
  broadcastCalls: number;             // broadcast calls per month (0 = no broadcasts)
  broadcastOverageCentsPerCall: number; // overage rate per extra broadcast call
}

// Special tier for admin users — all limits set to effectively infinite.
// Admin routes bypass billing entirely but this tier is returned so any code
// that reads limits (e.g. UI counters) still works without special-casing.
export const ADMIN_TIER: TierConfig = {
  key: 'admin',
  label: 'Admin',
  geocodes: 1_000_000,
  skipTraces: 1_000_000,
  callingMinutes: 1_000_000,
  hasDialer: true,
  hasPhoneNumber: true,
  unlimitedStreetView: true,
  overageSkipTraceCents: 0,
  aiMinutes: 1_000_000,
  aiOverageCentsPerMin: 0,
  broadcastCalls: 1_000_000,
  broadcastOverageCentsPerCall: 0,
};

export const TIERS: Record<string, TierConfig> = {
  free: {
    key: 'free',
    label: 'Free',
    geocodes: 50,
    skipTraces: 10,
    callingMinutes: 0,
    hasDialer: false,
    hasPhoneNumber: false,
    unlimitedStreetView: false,
    overageSkipTraceCents: 0,
    aiMinutes: 5,
    aiOverageCentsPerMin: 0,
    broadcastCalls: 0,           // no broadcasts for free
    broadcastOverageCentsPerCall: 0,
  },
  basic: {
    key: 'basic',
    label: 'Basic',
    geocodes: 500,
    skipTraces: 50,
    callingMinutes: 0,
    hasDialer: false,
    hasPhoneNumber: false,
    unlimitedStreetView: false,
    overageSkipTraceCents: 25,
    aiMinutes: 20,
    aiOverageCentsPerMin: 50,
    broadcastCalls: 100,         // 100 calls/month
    broadcastOverageCentsPerCall: 10, // $0.10/call overage
  },
  standard: {
    key: 'standard',
    label: 'Standard',
    geocodes: 1500,
    skipTraces: 150,
    callingMinutes: 500,
    hasDialer: true,
    hasPhoneNumber: true,
    unlimitedStreetView: true,
    overageSkipTraceCents: 20,
    aiMinutes: 75,
    aiOverageCentsPerMin: 40,
    broadcastCalls: 500,         // 500 calls/month
    broadcastOverageCentsPerCall: 8, // $0.08/call overage
  },
  pro: {
    key: 'pro',
    label: 'Pro',
    geocodes: 5000,
    skipTraces: 500,
    callingMinutes: 1000,
    hasDialer: true,
    hasPhoneNumber: true,
    unlimitedStreetView: true,
    overageSkipTraceCents: 15,
    aiMinutes: 250,
    aiOverageCentsPerMin: 30,
    broadcastCalls: 2000,        // 2000 calls/month
    broadcastOverageCentsPerCall: 5, // $0.05/call overage
  },
};

// Map Stripe price IDs to tier keys
const BASIC_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID || '';
const STANDARD_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_STANDARD_PRICE_ID || '';
const PRO_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || '';

// Also support old price IDs during transition
const OLD_STARTER_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || '';
const OLD_PRO_PRICE_ID = 'price_1TJI3FC3SsySERZ5aQ2dc4sR';

export function getTierKey(subscriptionStatus: string | null, stripePriceId: string | null): string {
  if (subscriptionStatus !== 'active') return 'free';
  if (stripePriceId === PRO_PRICE_ID) return 'pro';
  if (stripePriceId === STANDARD_PRICE_ID) return 'standard';
  if (stripePriceId === BASIC_PRICE_ID) return 'basic';
  // Legacy price ID mapping
  if (stripePriceId === OLD_PRO_PRICE_ID) return 'standard'; // old $79 Pro → new Standard
  if (stripePriceId === OLD_STARTER_PRICE_ID) return 'basic'; // old $49 Starter → new Basic
  return 'basic'; // default for active subscribers with unknown price
}

export function getTier(subscriptionStatus: string | null, stripePriceId: string | null): TierConfig {
  return TIERS[getTierKey(subscriptionStatus, stripePriceId)];
}
