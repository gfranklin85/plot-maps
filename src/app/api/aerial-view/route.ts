import { NextResponse } from 'next/server';

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY!;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address } = body as { address: string };

    if (!address) {
      return NextResponse.json(
        { error: 'address is required' },
        { status: 400 }
      );
    }

    const url = `https://aerialview.googleapis.com/v1/videos:lookupVideo?key=${GOOGLE_API_KEY}&address=${encodeURIComponent(address)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.state === 'ACTIVE' && data.uris) {
      return NextResponse.json({
        available: true,
        videoUri: data.uris?.MP4_MEDIUM?.landscapeUri || data.uris?.MP4_LOW?.landscapeUri || null,
        thumbnailUri: data.uris?.IMAGE?.landscapeUri || null,
        duration: data.metadata?.duration || null,
      });
    }

    return NextResponse.json({ available: false });
  } catch (error: unknown) {
    console.error('Aerial view error:', error);
    return NextResponse.json({ available: false });
  }
}
