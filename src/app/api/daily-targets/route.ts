import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

const DEFAULT_TARGETS = {
  conversations_target: 10,
  conversations_actual: 0,
  followups_target: 5,
  followups_actual: 0,
  letters_target: 3,
  letters_actual: 0,
  new_contacts_target: 5,
  new_contacts_actual: 0,
  notes: null,
};

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Try to fetch today's targets
    const { data, error } = await supabaseAdmin
      .from('daily_targets')
      .select('*')
      .eq('target_date', today)
      .single();

    if (data) {
      return NextResponse.json(data);
    }

    // If not found, create a new row with defaults
    if (error?.code === 'PGRST116') {
      const { data: newTarget, error: insertError } = await supabaseAdmin
        .from('daily_targets')
        .insert({ target_date: today, ...DEFAULT_TARGETS })
        .select()
        .single();

      if (insertError) {
        console.error('Failed to create daily targets:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      return NextResponse.json(newTarget);
    }

    // Some other error
    if (error) {
      console.error('Failed to fetch daily targets:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Daily targets GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch daily targets';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const updates = await request.json();

    // Only allow updating known fields
    const allowedFields = [
      'conversations_target', 'conversations_actual',
      'followups_target', 'followups_actual',
      'letters_target', 'letters_actual',
      'new_contacts_target', 'new_contacts_actual',
      'notes',
    ];

    const sanitized: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in updates) {
        sanitized[key] = updates[key];
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('daily_targets')
      .update(sanitized)
      .eq('target_date', today)
      .select()
      .single();

    if (error) {
      console.error('Failed to update daily targets:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Daily targets PATCH error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update daily targets';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
