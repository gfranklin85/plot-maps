import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { mergeAnonymousSession } from '@/lib/analytics-merge';

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { anonymous_id } = await request.json();
    if (!anonymous_id) {
      return NextResponse.json({ error: 'Missing anonymous_id' }, { status: 400 });
    }

    await mergeAnonymousSession(anonymous_id, user.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Analytics merge error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
