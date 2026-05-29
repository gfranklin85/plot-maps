// Thin wrapper around /api/public/inquiry for the in-map "Request
// this market" demand-capture form (fired when a visitor searches a
// city Plot does not yet cover with property data).

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
  const merged = { ...body, kind: 'market' };
  const forwarded = new Request(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(merged),
  });
  return inquiryPOST(forwarded as NextRequest);
}
