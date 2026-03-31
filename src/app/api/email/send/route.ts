import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase-server';

const resend = new Resend(process.env.RESEND_API_KEY!);

const FROM_EMAIL = process.env.FROM_EMAIL || 'greg@plot.solutions';

export async function POST(request: Request) {
  try {
    const { to, subject, body, leadId } = await request.json();

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: 'to, subject, and body are required' },
        { status: 400 }
      );
    }

    // Send email via Resend
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

    return NextResponse.json({ success: true, emailId: data?.id });
  } catch (error: unknown) {
    console.error('Email send error:', error);
    const message = error instanceof Error ? error.message : 'Failed to send email';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
