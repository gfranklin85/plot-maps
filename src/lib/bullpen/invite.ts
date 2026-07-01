// ── Agent invite ──────────────────────────────────────────────────────
//
// The agent-branded template link. An agent fills /invite once → gets a token
// → texts /bullpen?agent=<token> to a ready buyer. The buyer's completed
// position auto-attaches to the agent and lands on the PUBLIC bullpen (RESPA-
// clean; no steering to a private sphere). The agent can brand it.
// See memory/project_agent_branded_template + project_agent_invite_link.

export interface AgentInvite {
  token: string;
  agentName: string;
  agentEmail: string | null;
  agentPhone: string | null;
  brokerage: string | null;
  logoUrl: string | null;
}

export function shapeInvite(row: Record<string, unknown>): AgentInvite {
  const s = (v: unknown) => (v == null ? null : String(v));
  return {
    token: String(row.token),
    agentName: String(row.agent_name ?? ''),
    agentEmail: s(row.agent_email),
    agentPhone: s(row.agent_phone),
    brokerage: s(row.brokerage),
    logoUrl: s(row.logo_url),
  };
}

// Short, readable token (no ambiguous chars).
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export function makeInviteToken(len = 6): string {
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}
