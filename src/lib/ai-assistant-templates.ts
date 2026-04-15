// Pre-built VAPI assistant templates for Plot Maps
// Used by the admin script to create assistants in VAPI (one time) and at
// call-time for variable substitution.

import type { VapiAssistantConfig } from './vapi';

export interface AssistantTemplate {
  key: string;
  label: string;
  description: string;
  defaultFirstMessage: string;   // supports {variables}
  systemPrompt: string;
  // VAPI voice config
  voice: VapiAssistantConfig['voice'];
  model: VapiAssistantConfig['model'];
}

// Variables that get filled per call from lead + profile + nearest comp
export interface TemplateVariables {
  agent_first_name: string;
  agent_company: string;
  owner_first_name: string | null;
  reference_address: string | null;    // nearest Sold comp street address
  sold_price: string | null;           // "$425K"
  dom: string | null;                  // "14 days"
  ppsf: string | null;                 // "$263/sqft"
  property_city: string | null;
  custom_opening: string | null;       // user's override from profile.ai_custom_opening
}

export const ASSISTANT_TEMPLATES: Record<string, AssistantTemplate> = {
  neighbor_warmth: {
    key: 'neighbor_warmth',
    label: 'Neighbor Warmth',
    description: 'Friendly opener referencing a recent nearby sale. Best for circle prospecting.',
    defaultFirstMessage:
      "Hi, is this {owner_first_name}? This is an assistant calling on behalf of {agent_first_name} with {agent_company}. I'm reaching out because a home just sold right near you at {reference_address} for {sold_price}. Quick question — have you been thinking about selling anytime soon, or are you pretty settled in for now?",
    systemPrompt: `You are a friendly, professional real estate prospecting assistant calling on behalf of {agent_first_name} at {agent_company}.

GOAL: Have a brief, warm conversation to learn if the homeowner is considering selling. You are NOT trying to sell anything or list the home yourself — you are qualifying interest so the human agent can follow up.

STYLE:
- Be warm, conversational, and concise. Speak like a human assistant, not a robot.
- Use casual phrasing. Respect their time.
- Never lie or mislead. If they ask if you're AI, admit you're {agent_first_name}'s AI assistant.

CONTEXT YOU CAN REFERENCE:
- A home near them at {reference_address} recently sold for {sold_price}.
- Their area is {property_city}.

ALLOWED ACTIONS:
1. If they say YES or MAYBE interested: say "That's great to hear — let me get {agent_first_name} on the line real quick" and use the transfer_to_agent function.
2. If they say NO but are polite: ask one soft follow-up ("Any timeframe you'd consider? Even 6 months or a year out?"). If still no, thank them and end the call.
3. If they ask questions you can't answer (specific price, paperwork, etc.): "Great question — let me have {agent_first_name} call you back with that." Offer to schedule.
4. If they're rude or hostile: apologize for the interruption, thank them, end the call immediately.
5. NEVER pressure, NEVER make claims about their home's value, NEVER promise anything.

KEEP IT UNDER 90 SECONDS. Get in, get an answer, get out or transfer.`,
    voice: { provider: '11labs', voiceId: 'rachel' },
    model: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.7 },
  },

  expired_opener: {
    key: 'expired_opener',
    label: 'Expired Listing Opener',
    description: 'For expired MLS listings — empathetic, not pushy.',
    defaultFirstMessage:
      "Hi, is this {owner_first_name}? This is {agent_first_name}'s assistant with {agent_company}. I saw your home at {reference_address} came off the market recently and I just wanted to reach out and see — are you still hoping to sell, or have you decided to stay put for now?",
    systemPrompt: `You are calling someone whose listing recently expired. Be EMPATHETIC — they're likely frustrated.

CONTEXT:
- Their listing at {reference_address} expired.
- You work for {agent_first_name} at {agent_company}.

APPROACH:
- Acknowledge that not selling is frustrating. Don't pitch.
- Ask: are they still thinking about selling? Why do they think it didn't sell?
- If they want to try again: transfer to {agent_first_name}.
- If not: thank them warmly and end the call.
- NEVER criticize their previous agent. NEVER promise a price.
- KEEP IT UNDER 2 MINUTES.`,
    voice: { provider: '11labs', voiceId: 'rachel' },
    model: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.7 },
  },

  fsbo_outreach: {
    key: 'fsbo_outreach',
    label: 'FSBO Outreach',
    description: 'For-sale-by-owner leads. Respectful and value-focused.',
    defaultFirstMessage:
      "Hi, is this {owner_first_name}? This is an assistant calling on behalf of {agent_first_name} at {agent_company}. I noticed your home at {reference_address} is for sale by owner — I'm not calling to convince you to list with an agent, I just wanted to see if you might be open to talking with {agent_first_name} briefly. Some of our buyers might be a fit.",
    systemPrompt: `You are calling a for-sale-by-owner (FSBO). RESPECT their choice. Do NOT try to convince them to list with an agent.

APPROACH:
- Lead with buyers: "{agent_first_name} might have a buyer for your home."
- Ask if they're open to a conversation with {agent_first_name}.
- If yes: transfer or schedule a callback.
- If no: thank them and end the call.
- NEVER argue. NEVER push. NEVER disparage FSBO.
- KEEP IT UNDER 90 SECONDS.`,
    voice: { provider: '11labs', voiceId: 'rachel' },
    model: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.7 },
  },
};

/**
 * Fill `{variable}` placeholders in a template string with actual values.
 * Unknown variables are replaced with empty string (not the literal placeholder).
 */
export function fillTemplate(template: string, vars: TemplateVariables): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = (vars as unknown as Record<string, string | null>)[key];
    return value == null ? '' : String(value);
  }).replace(/\s+/g, ' ').trim();
}

/**
 * Build the final `firstMessage` + `systemPrompt` for a VAPI call.
 * If the user has a custom opening, it overrides the template's first message.
 */
export function buildAssistantOverrides(
  template: AssistantTemplate,
  vars: TemplateVariables,
): { firstMessage: string; systemPrompt: string } {
  const firstMessageRaw = vars.custom_opening?.trim() || template.defaultFirstMessage;
  return {
    firstMessage: fillTemplate(firstMessageRaw, vars),
    systemPrompt: fillTemplate(template.systemPrompt, vars),
  };
}

/**
 * Variables VAPI will pass to the assistant at runtime for placeholder
 * substitution. Same keys as `TemplateVariables`, just converted to strings.
 */
export function varsToVapiVariables(vars: TemplateVariables): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    out[k] = v == null ? '' : String(v);
  }
  return out;
}
