import type { Lead } from './index';

export type CampaignType = 'circle_prospecting';

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

export type ReferenceStrategy = 'nearest' | 'fixed';

export type AllowedFact = 'status' | 'price' | 'dom' | 'timing' | 'price_per_sqft';

export type IntentLabel =
  | 'curious'
  | 'maybe_this_year'
  | 'settled_for_now'
  | 'not_interested'
  | 'wrong_number'
  | 'call_back_later'
  | 'no_answer'
  | 'voicemail';

export type ProspectCallStatus = 'pending' | 'queued' | 'calling' | 'completed' | 'skipped' | 'failed';

export const INTENT_LABELS: { value: IntentLabel; label: string; color: string }[] = [
  { value: 'curious', label: 'Curious', color: 'text-sky-400 bg-sky-500/10' },
  { value: 'maybe_this_year', label: 'Maybe This Year', color: 'text-emerald-400 bg-emerald-500/10' },
  { value: 'settled_for_now', label: 'Settled', color: 'text-slate-400 bg-slate-500/10' },
  { value: 'not_interested', label: 'Not Interested', color: 'text-orange-400 bg-orange-500/10' },
  { value: 'wrong_number', label: 'Wrong Number', color: 'text-red-400 bg-red-500/10' },
  { value: 'call_back_later', label: 'Call Back', color: 'text-violet-400 bg-violet-500/10' },
  { value: 'no_answer', label: 'No Answer', color: 'text-zinc-400 bg-zinc-500/10' },
  { value: 'voicemail', label: 'Voicemail', color: 'text-zinc-400 bg-zinc-500/10' },
];

export const ALLOWED_FACTS: { value: AllowedFact; label: string; description: string }[] = [
  { value: 'status', label: 'Status', description: 'Whether the property sold, is pending, or active' },
  { value: 'price', label: 'Price', description: 'Approximate sale or list price' },
  { value: 'dom', label: 'Days on Market', description: 'How long it took to sell or go pending' },
  { value: 'timing', label: 'Timing', description: 'When it sold or went pending (e.g. "just closed Friday")' },
  { value: 'price_per_sqft', label: 'Price per Sq Ft', description: 'Price per square foot comparison' },
];

export interface HookVariantGroup {
  type: 'sold' | 'pending' | 'active';
  reference_lead_id: string;
  variants: string[];
}

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  assistant_name: string;
  campaign_type: CampaignType;
  status: CampaignStatus;
  reference_lead_ids: string[];
  primary_reference_strategy: ReferenceStrategy;
  allowed_facts: AllowedFact[];
  base_prompt: string;
  campaign_injection: string;
  first_message_template: string;
  hook_variants: HookVariantGroup[];
  voice_provider: string;
  voice_id: string;
  total_prospects: number;
  calls_made: number;
  calls_answered: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignProspect {
  id: string;
  campaign_id: string;
  lead_id: string;
  call_status: ProspectCallStatus;
  ai_call_id: string | null;
  call_order: number | null;
  priority: number;
  created_at: string;
  lead?: Lead;
}

export interface CampaignWithReferences extends Campaign {
  reference_leads: Lead[];
}

export interface CampaignCallResult {
  ai_call_id: string;
  vapi_call_id: string;
  monitor_listen_url: string | null;
  first_message: string;
  hook_variant_used: string;
  reference_lead_id: string;
}
