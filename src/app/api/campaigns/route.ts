import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import {
  CIRCLE_PROSPECTING_BASE_PROMPT,
  buildCampaignInjection,
  buildFirstMessageTemplate,
  generateHookVariants,
} from '@/lib/campaign-prompts';
import type { AllowedFact, ReferenceStrategy } from '@/types/campaign';

const VALID_FACTS: AllowedFact[] = ['status', 'price', 'dom', 'timing', 'price_per_sqft'];

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    name,
    assistant_name = 'Morgan',
    reference_lead_ids = [],
    primary_reference_strategy = 'nearest',
    allowed_facts = [],
  }: {
    name?: string;
    assistant_name?: string;
    reference_lead_ids?: string[];
    primary_reference_strategy?: ReferenceStrategy;
    allowed_facts?: AllowedFact[];
  } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 });
  }

  if (reference_lead_ids.length === 0 || reference_lead_ids.length > 3) {
    return NextResponse.json({ error: 'Select 1-3 reference properties' }, { status: 400 });
  }

  const validFacts = allowed_facts.filter((f) => VALID_FACTS.includes(f));
  if (validFacts.length === 0) {
    return NextResponse.json({ error: 'Select at least one allowed fact' }, { status: 400 });
  }

  const { data: refLeads, error: refError } = await supabaseAdmin
    .from('leads')
    .select('*')
    .in('id', reference_lead_ids);

  if (refError || !refLeads || refLeads.length === 0) {
    return NextResponse.json({ error: 'Could not load reference properties' }, { status: 400 });
  }

  const basePrompt = CIRCLE_PROSPECTING_BASE_PROMPT;
  const campaignInjection = buildCampaignInjection(refLeads, validFacts);
  const firstMessageTemplate = buildFirstMessageTemplate(assistant_name);
  const hookVariants = generateHookVariants(refLeads, validFacts);

  const { data: campaign, error: insertError } = await supabaseAdmin
    .from('campaigns')
    .insert({
      user_id: user.id,
      name: name.trim(),
      assistant_name,
      campaign_type: 'circle_prospecting',
      status: 'draft',
      reference_lead_ids,
      primary_reference_strategy,
      allowed_facts: validFacts,
      base_prompt: basePrompt,
      campaign_injection: campaignInjection,
      first_message_template: firstMessageTemplate,
      hook_variants: hookVariants,
    })
    .select('*')
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(campaign, { status: 201 });
}
