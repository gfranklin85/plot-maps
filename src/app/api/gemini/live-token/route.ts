import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getAuthUser } from '@/lib/auth';

// ── Gemini Live ephemeral-token minter ──────────────────────────────
//
// Otanimus, the on-screen flight companion, connects to the Gemini
// Live API over a WebSocket DIRECTLY from the browser (it streams the
// map screen + the user's mic and gets back streaming voice). That
// connection needs a credential — but GEMINI_API_KEY must NEVER reach
// the client. So the browser asks this route for a short-lived
// *ephemeral token* instead. The token works only with the Live API,
// expires in minutes, and is single-session — safe to hand to the
// browser.
//
// Flow:
//   client → GET /api/gemini/live-token → { token }
//   client → ai.live.connect({ apiKey: token })  (the token name)
//
// See [[project-otanimus-on-map-companion]].

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 },
      );
    }

    const client = new GoogleGenAI({ apiKey });

    const now = Date.now();
    const token = await client.authTokens.create({
      config: {
        // One Live session per token. The browser uses sessionResumption
        // to survive the ~10-min server-side reconnect within expireTime.
        uses: 1,
        // Token (and any resumed sessions) usable for 30 minutes.
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        // New sessions can be STARTED with this token for 1 minute —
        // tight window between mint and connect.
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });

    // token.name is the credential the client passes as apiKey.
    return NextResponse.json({ token: token.name });
  } catch (err) {
    console.error('[gemini/live-token] mint failed', err);
    return NextResponse.json(
      { error: 'Failed to mint Live token' },
      { status: 500 },
    );
  }
}
