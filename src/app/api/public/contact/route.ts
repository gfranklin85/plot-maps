// Thin wrapper around /api/public/inquiry for the /contact form.
// Discriminator added server-side so the form code doesn't have to
// know about the unified backend.

import { NextRequest, NextResponse } from 'next/server';
import { POST as inquiryPOST } from '../inquiry/route';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const merged = { ...body, kind: 'contact' };
  const forwarded = new Request(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(merged),
  });
  return inquiryPOST(forwarded as NextRequest);
}
