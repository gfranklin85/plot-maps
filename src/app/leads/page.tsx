'use client';

// /leads — the CRM route. Renders the portable LeadsList (also used inside
// the agent dashboard's PROSPECT island). One source of truth for the table.
import LeadsList from '@/components/leads/LeadsList';

export default function LeadsPage() {
  return <LeadsList />;
}
