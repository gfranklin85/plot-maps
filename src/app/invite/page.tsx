// /invite — the agent's tool: make a branded buyer-link to text any ready
// buyer. Buyer completes → auto-attached to the agent → posts to the public
// board. See memory/project_agent_branded_template.

import AgentInvite from '@/components/bullpen/AgentInvite';

export const dynamic = 'force-dynamic';

export default function InvitePage() {
  return <AgentInvite />;
}
