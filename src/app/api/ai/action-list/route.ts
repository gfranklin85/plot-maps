import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getAuthUser, isSubscribed } from '@/lib/auth';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!await isSubscribed(user.id)) {
      return NextResponse.json({ error: 'Subscription required' }, { status: 403 });
    }

    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Query leads that need attention
    const { data: followUpLeads } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('user_id', user.id)
      .eq('follow_up_date', today);

    const { data: hotLeads } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['Follow-Up', 'Hot Lead']);

    const { data: highPriorityLeads } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('user_id', user.id)
      .eq('priority', 'high');

    const { data: recentNewLeads } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'New')
      .gte('created_at', sevenDaysAgo);

    // Combine and deduplicate leads by id
    const allLeads = [
      ...(followUpLeads || []),
      ...(hotLeads || []),
      ...(highPriorityLeads || []),
      ...(recentNewLeads || []),
    ];
    const uniqueLeads = Array.from(
      new Map(allLeads.map(lead => [lead.id, lead])).values()
    );

    if (uniqueLeads.length === 0) {
      return NextResponse.json({ actions: [], message: 'No leads need attention today.' });
    }

    // Get lead IDs for activity query
    const leadIds = uniqueLeads.map(l => l.id);

    // Query recent activities for these leads
    const { data: activities } = await supabaseAdmin
      .from('activities')
      .select('*')
      .in('lead_id', leadIds)
      .order('created_at', { ascending: false })
      .limit(100);

    // Build context for Claude
    const leadsContext = uniqueLeads.map(lead => ({
      id: lead.id,
      name: lead.owner_name || lead.name || 'Unknown',
      address: lead.property_address,
      phone: lead.phone,
      status: lead.status,
      priority: lead.priority,
      follow_up_date: lead.follow_up_date,
      last_contact_date: lead.last_contact_date,
      notes: lead.notes,
      source: lead.source,
    }));

    const activitiesContext = (activities || []).map(a => ({
      lead_id: a.lead_id,
      type: a.type,
      title: a.title,
      outcome: a.outcome,
      date: a.created_at,
    }));

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `You are a real estate sales commander. Given these leads and their activity history, generate a prioritized daily action list. For each lead, provide: a specific action to take, why now, and a suggested opener. Be specific and actionable, not generic. Return the result as a JSON array with objects containing: leadId, leadName, address, phone, action, reason, suggestedOpener, priority (high/medium/low).`,
      messages: [
        {
          role: 'user',
          content: `Today is ${today}.\n\nLeads:\n${JSON.stringify(leadsContext, null, 2)}\n\nRecent Activities:\n${JSON.stringify(activitiesContext, null, 2)}\n\nGenerate the prioritized daily action list.`,
        },
      ],
    });

    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Failed to parse AI response', raw: responseText },
        { status: 422 }
      );
    }

    const actions = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ actions, leadCount: uniqueLeads.length });
  } catch (error: unknown) {
    console.error('Action list error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate action list';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
