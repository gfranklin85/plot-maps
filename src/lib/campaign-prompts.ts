import type { Lead } from '@/types';
import type { AllowedFact, HookVariantGroup, ReferenceStrategy } from '@/types/campaign';

// ── Base prompt: core voice behavior ─────────────────────────────────────────

export const CIRCLE_PROSPECTING_BASE_PROMPT = `You are {assistant_name}, a friendly neighborhood outreach caller working with {agent_first_name} at {agent_company} in {property_city}.

PRIMARY GOAL:
- Keep the homeowner on the phone
- Reference local activity naturally
- Ask one question
- Gather light intent

NOT YOUR GOAL:
- Close a deal
- Force an appointment
- Deliver a market report
- Interrogate the homeowner

TONE AND STYLE:
- Sound local, calm, and normal
- Conversational, not corporate
- Low pressure, never pushy
- You are a real person making neighborhood calls, not a telemarketer
- Ask one question at a time
- Keep responses short and natural

RULES:
- Never mention more than one reference property at a time
- Never stack more than 2 data points in a single sentence
- Never use ellipses or trailing pauses
- If asked if you are AI, say "I'm {assistant_name}, {agent_first_name}'s assistant"
- If they show interest, offer to have {agent_first_name} follow up
- If they say no, thank them warmly and end the call
- If they are rude or hostile, apologize and end the call immediately
- Keep the entire call under 90 seconds
- Do not repeat yourself

CONVERSATION FLOW:
1. Deliver your opening (first message)
2. Listen to their response
3. Ask one soft follow-up question if appropriate
4. Based on their answer, either offer {agent_first_name} follow-up or thank them
5. End the call naturally

{campaign_injection}`;

// ── Campaign injection builder ───────────────────────────────────────────────

function formatPrice(price: number | null | undefined): string | null {
  if (!price) return null;
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(1)} million`;
  return `$${Math.round(price / 1000).toLocaleString()}K`;
}

function formatTiming(lead: Lead): string | null {
  const dateStr = lead.selling_date || lead.pending_date || lead.listing_date;
  if (!dateStr) return null;

  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 1) return 'just yesterday';
  if (diffDays <= 3) return 'a couple days ago';
  if (diffDays <= 7) return 'earlier this week';
  if (diffDays <= 14) return 'about a week or two ago';
  if (diffDays <= 30) return 'within the last month';
  return 'recently';
}

function getListingType(lead: Lead): 'sold' | 'pending' | 'active' {
  const s = (lead.listing_status || '').toLowerCase();
  if (s === 'sold') return 'sold';
  if (s === 'pending') return 'pending';
  return 'active';
}

function getStreetName(address: string | null): string {
  if (!address) return 'a nearby street';
  const street = address.split(',')[0].trim();
  const parts = street.split(/\s+/);
  if (parts.length >= 2) return parts.slice(1).join(' ');
  return street;
}

export function buildCampaignInjection(
  referenceLeads: Lead[],
  allowedFacts: AllowedFact[],
): string {
  if (referenceLeads.length === 0) return '';

  const blocks = referenceLeads.map((lead, i) => {
    const lines: string[] = [];
    const street = getStreetName(lead.property_address);
    const type = getListingType(lead);

    lines.push(`Reference Property ${i + 1}:`);
    lines.push(`- Street: ${street}`);

    if (allowedFacts.includes('status')) {
      const statusLabel = type === 'sold' ? 'Sold' : type === 'pending' ? 'Pending' : 'Active';
      lines.push(`- Status: ${statusLabel}`);
    }

    if (allowedFacts.includes('timing')) {
      const timing = formatTiming(lead);
      if (timing) lines.push(`- Timing: ${timing}`);
    }

    if (allowedFacts.includes('price')) {
      const price = type === 'sold' ? lead.selling_price : lead.listing_price;
      const formatted = formatPrice(price);
      if (formatted) lines.push(`- Price: Around ${formatted}`);
    }

    if (allowedFacts.includes('dom') && lead.dom != null) {
      lines.push(`- Days on Market: About ${lead.dom} days`);
    }

    if (allowedFacts.includes('price_per_sqft') && lead.sqft && lead.sqft > 0) {
      const price = type === 'sold' ? lead.selling_price : lead.listing_price;
      if (price) {
        const ppsf = Math.round(price / lead.sqft);
        lines.push(`- Price per Sq Ft: About $${ppsf}`);
      }
    }

    return lines.join('\n');
  });

  return `REFERENCE PROPERTIES YOU MAY MENTION:
Use only ONE property at a time unless the conversation naturally supports mentioning more.

${blocks.join('\n\n')}

INSTRUCTIONS FOR REFERENCING:
- Mention only one property at a time
- Do not list all stats, keep it to 1-2 facts
- Use conversational phrasing, not a data readout
- Pick the reference closest to the person you are calling`;
}

// ── First message template builder ───────────────────────────────────────────

export function buildFirstMessageTemplate(assistantName: string): string {
  return `Hi, is this {owner_first_name}? Hey, this is ${assistantName}. I work with {agent_first_name} with {agent_company} here in {property_city}, just reaching out to a couple homeowners nearby real quick. {hook}`;
}

// ── Hook variant generator ───────────────────────────────────────────────────

function buildSoldHooks(lead: Lead, allowedFacts: AllowedFact[]): string[] {
  const street = getStreetName(lead.property_address);
  const price = formatPrice(lead.selling_price);
  const timing = formatTiming(lead);
  const hooks: string[] = [];

  if (allowedFacts.includes('price') && price && allowedFacts.includes('timing') && timing) {
    hooks.push(`A home on ${street} just sold ${timing} around ${price}, and we have been reaching out to a few neighbors because people are usually surprised where things are right now.`);
  }

  if (allowedFacts.includes('timing') && timing) {
    hooks.push(`A home nearby on ${street} just closed ${timing} and it has gotten some neighbors curious about what their own place might be worth.`);
  }

  if (allowedFacts.includes('price') && price && allowedFacts.includes('dom') && lead.dom != null) {
    hooks.push(`A place on ${street} sold for about ${price} in just ${lead.dom} days, so we wanted to check in with a few people nearby.`);
  }

  if (hooks.length === 0) {
    hooks.push(`A home nearby on ${street} just sold and we have been checking in with a few homeowners around there.`);
  }

  return hooks;
}

function buildPendingHooks(lead: Lead, allowedFacts: AllowedFact[]): string[] {
  const street = getStreetName(lead.property_address);
  const timing = formatTiming(lead);
  const hooks: string[] = [];

  if (allowedFacts.includes('timing') && timing) {
    hooks.push(`A home nearby on ${street} just went under contract ${timing}, and it has gotten some people around there thinking about what their own place might look like.`);
  }

  hooks.push(`There is a home on ${street} that just went pending and we have been reaching out to a few neighbors nearby.`);

  if (allowedFacts.includes('price')) {
    const price = formatPrice(lead.listing_price);
    if (price) {
      hooks.push(`A place on ${street} went pending at around ${price} and we wanted to check in with a few people in the area.`);
    }
  }

  return hooks;
}

function buildActiveHooks(lead: Lead, allowedFacts: AllowedFact[]): string[] {
  const street = getStreetName(lead.property_address);
  const hooks: string[] = [];

  hooks.push(`There is an active listing nearby on ${street} right now, and we have been checking in with a few homeowners around there because activity tends to get people curious.`);

  if (allowedFacts.includes('price')) {
    const price = formatPrice(lead.listing_price);
    if (price) {
      hooks.push(`A home on ${street} just hit the market around ${price} and we wanted to touch base with a few neighbors.`);
    }
  }

  hooks.push(`There is some new activity on ${street} and we have been reaching out to a few homeowners in the area.`);

  return hooks;
}

export function generateHookVariants(
  referenceLeads: Lead[],
  allowedFacts: AllowedFact[],
): HookVariantGroup[] {
  return referenceLeads.map((lead) => {
    const type = getListingType(lead);
    let variants: string[];

    switch (type) {
      case 'sold':
        variants = buildSoldHooks(lead, allowedFacts);
        break;
      case 'pending':
        variants = buildPendingHooks(lead, allowedFacts);
        break;
      default:
        variants = buildActiveHooks(lead, allowedFacts);
        break;
    }

    return {
      type,
      reference_lead_id: lead.id,
      variants,
    };
  });
}

// ── Reference property selection (call-time) ─────────────────────────────────

function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 3959; // miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function selectReferenceProperty(
  prospect: Lead,
  referenceLeads: Lead[],
  strategy: ReferenceStrategy,
): Lead {
  if (strategy === 'fixed' || referenceLeads.length === 1) {
    return referenceLeads[0];
  }

  if (!prospect.latitude || !prospect.longitude) {
    return referenceLeads[0];
  }

  let best = referenceLeads[0];
  let bestScore = Infinity;

  for (const ref of referenceLeads) {
    if (!ref.latitude || !ref.longitude) continue;

    const dist = haversineDistance(
      prospect.latitude, prospect.longitude,
      ref.latitude, ref.longitude,
    );

    // Recency bonus: more recent status changes score lower (better)
    const dateStr = ref.selling_date || ref.pending_date || ref.listing_date;
    const recencyDays = dateStr
      ? Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
      : 365;
    const recencyPenalty = recencyDays / 100;

    const score = dist + recencyPenalty;

    if (score < bestScore) {
      bestScore = score;
      best = ref;
    }
  }

  return best;
}

// ── Random hook picker ───────────────────────────────────────────────────────

export function pickRandomVariant(
  hookVariants: HookVariantGroup[],
  referenceLeadId: string,
): string {
  const group = hookVariants.find((h) => h.reference_lead_id === referenceLeadId);
  if (!group || group.variants.length === 0) {
    return 'We have been reaching out to a few homeowners in the area about some recent neighborhood activity.';
  }
  const idx = Math.floor(Math.random() * group.variants.length);
  return group.variants[idx];
}

// ── Full call-time prompt composer ───────────────────────────────────────────

export interface CampaignCallComposition {
  systemPrompt: string;
  firstMessage: string;
  hookVariantUsed: string;
  referenceLeadId: string;
}

export function composeCampaignCall(
  campaign: {
    base_prompt: string;
    campaign_injection: string;
    first_message_template: string;
    hook_variants: HookVariantGroup[];
    assistant_name: string;
    primary_reference_strategy: ReferenceStrategy;
  },
  prospect: Lead,
  referenceLeads: Lead[],
  profile: { full_name?: string | null; company?: string | null },
): CampaignCallComposition {
  const selectedRef = selectReferenceProperty(
    prospect,
    referenceLeads,
    campaign.primary_reference_strategy,
  );

  const hook = pickRandomVariant(campaign.hook_variants, selectedRef.id);

  const agentFirstName = (profile.full_name || 'your agent').split(' ')[0];
  const agentCompany = profile.company || 'Plot Maps';
  const ownerFirstName = (() => {
    const full = prospect.owner_name || prospect.name || '';
    return full.split(' ')[0] || 'there';
  })();
  const city = prospect.city || selectedRef.city || '';

  const vars: Record<string, string> = {
    assistant_name: campaign.assistant_name,
    agent_first_name: agentFirstName,
    agent_company: agentCompany,
    owner_first_name: ownerFirstName,
    property_city: city,
    hook,
    campaign_injection: campaign.campaign_injection,
  };

  const fill = (template: string) =>
    template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '').replace(/\s+/g, ' ').trim();

  return {
    systemPrompt: fill(campaign.base_prompt),
    firstMessage: fill(campaign.first_message_template),
    hookVariantUsed: hook,
    referenceLeadId: selectedRef.id,
  };
}
