import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

// Search available numbers
export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const areaCode = searchParams.get('areaCode') || '559';

  try {
    const numbers = await client.availablePhoneNumbers('US')
      .local.list({
        areaCode: parseInt(areaCode),
        limit: 10,
        voiceEnabled: true,
      });

    return NextResponse.json({
      numbers: numbers.map((n) => ({
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName,
        locality: n.locality,
        region: n.region,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to search numbers';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Purchase a number
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { phoneNumber } = await request.json();
  if (!phoneNumber) {
    return NextResponse.json({ error: 'phoneNumber is required' }, { status: 400 });
  }

  // Check subscription and existing number
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('twilio_phone_number, subscription_status')
    .eq('id', user.id)
    .single();

  if (profile?.subscription_status !== 'active') {
    return NextResponse.json(
      { error: 'Phone numbers require an active subscription. Upgrade to get a local number.' },
      { status: 403 }
    );
  }

  if (profile?.twilio_phone_number) {
    return NextResponse.json({ error: 'You already have a number provisioned' }, { status: 400 });
  }

  try {
    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber,
      voiceUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.plot.solutions'}/api/twilio/voice`,
      voiceMethod: 'POST',
      friendlyName: `Plot Maps - ${user.id.slice(0, 8)}`,
    });

    // Save to user's profile
    await supabaseAdmin
      .from('profiles')
      .update({
        twilio_phone_number: purchased.phoneNumber,
        twilio_phone_sid: purchased.sid,
      })
      .eq('id', user.id);

    return NextResponse.json({
      phoneNumber: purchased.phoneNumber,
      sid: purchased.sid,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to provision number';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
