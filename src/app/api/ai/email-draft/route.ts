import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/auth';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { leadId, context, tone = 'professional' } = await request.json();

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }

    // Fetch the lead
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('user_id', user.id)
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Fetch recent activities
    const { data: activities } = await supabaseAdmin
      .from('activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(10);

    const activitiesSummary = (activities || [])
      .map(a => `${a.created_at}: ${a.type} - ${a.title}${a.outcome ? ` (${a.outcome})` : ''}`)
      .join('\n');

    const ownerName = lead.owner_name || lead.name || 'Property Owner';
    const address = lead.property_address || 'the property';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: `You are a professional real estate email writer. Draft concise, compelling emails that get responses. Return your response as a JSON object with "subject" and "body" fields. The body should be plain text (not HTML). Do not include any text outside the JSON.`,
      messages: [
        {
          role: 'user',
          content: `Draft a ${tone} real estate email to ${ownerName} about their property at ${address}.

Lead details:
- Status: ${lead.status}
- Priority: ${lead.priority || 'not set'}
- Price range: ${lead.price_range || 'unknown'}
- Property condition: ${lead.property_condition || 'unknown'}
- Notes: ${lead.notes || 'none'}

Activity history:
${activitiesSummary || 'No previous activity'}

${context ? `Additional context: ${context}` : ''}

Tone: ${tone}
Write the email as Greg Fisher, a real estate professional.`,
        },
      ],
    });

    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Failed to parse AI response', raw: responseText },
        { status: 422 }
      );
    }

    const draft = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      subject: draft.subject,
      body: draft.body,
      leadName: ownerName,
      leadEmail: lead.email,
    });
  } catch (error: unknown) {
    console.error('Email draft error:', error);
    const message = error instanceof Error ? error.message : 'Failed to draft email';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
