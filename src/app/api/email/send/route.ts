import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getAuthUser, isSubscribed } from '@/lib/auth';
import { logCost } from '@/lib/cost-tracker';

// Force dynamic so Next's "Collect page data" phase doesn't import this
// module's top-level statements during build.
export const dynamic = 'force-dynamic';

const FROM_EMAIL = process.env.FROM_EMAIL || 'greg@plot.solutions';

// Lazy-instantiate at request time. Module load was throwing in builds
// where RESEND_API_KEY wasn't yet in scope.
function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not configured');
  return new Resend(key);
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!await isSubscribed(user.id)) {
      return NextResponse.json({ error: 'Subscription required' }, { status: 403 });
    }

    const { to, subject, body, leadId } = await request.json();

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: 'to, subject, and body are required' },
        { status: 400 }
      );
    }

    // Send email via Resend
    const resend = getResend();
    const { data, error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html: body,
    });

    if (sendError) {
      console.error('Resend error:', sendError);
      return NextResponse.json({ error: sendError.message }, { status: 500 });
    }

    // Log email to activities
    if (leadId) {
      await supabaseAdmin.from('activities').insert({
        lead_id: leadId,
        type: 'email',
        title: `Email sent: ${subject}`,
        description: `Email sent to ${to}`,
        metadata: {
          email_id: data?.id,
          to,
          subject,
        },
      });

      // Update lead's last_contact_date
      await supabaseAdmin
        .from('leads')
        .update({ last_contact_date: new Date().toISOString() })
        .eq('id', leadId);
    }

    logCost(user.id, 'resend', 'email_send', 0.0005);
    return NextResponse.json({ success: true, emailId: data?.id });
  } catch (error: unknown) {
    console.error('Email send error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send email';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
