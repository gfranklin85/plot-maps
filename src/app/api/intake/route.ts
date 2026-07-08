import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase-server';
import { logCost } from '@/lib/cost-tracker';

// POST /api/intake — Claude at the front door.
//
// The conversational intake: an ad visitor TALKS their move request instead of
// filling a form ("you could just be the intake" — the_thesis: THE INTAKE IS A
// CONVERSATION). Claude asks resolving follow-ups (family → real cities,
// occupation, town-size anchoring), answers "how does this work?" right there,
// and extracts everything through the update_move_request tool as it listens.
// The client's live position card fills from the extraction; Confirm & Post
// sends the same /api/move-request the wizard uses.
//
// STORE IT ALL, RETRIEVE IT ALL: the full transcript + latest extraction land
// in intake_conversations. The transcript is data we haven't built schemas for
// yet — future extractors re-mine every conversation ever had.
//
// Anonymous (bullpen pattern) — no auth; the conversation uuid is the bearer.

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Model choice (Greg, 2026-07-08: "no token-heavy model for easy stuff"):
// Sonnet — near-Opus quality on exactly this kind of conversational work at
// a fraction of the price, run at LOW effort (snappy) with prompt caching on
// the growing transcript. Intake turns are easy work; Opus stays reserved
// for jobs that need it.
const INTAKE_MODEL = 'claude-sonnet-5';
// Sonnet 5 intro pricing per token: $2/M in, $10/M out, cache read ~$0.20/M,
// cache write ~$2.50/M — for the cost_events estimate only.
const PRICE = { in: 2e-6, out: 10e-6, cacheRead: 0.2e-6, cacheWrite: 2.5e-6 };

const MAX_TURNS = 60; // transcript message cap — nudge to post past this

// The extraction tool. Claude calls this whenever it learns something new,
// ALWAYS sending the complete current picture (arrays replace, not append).
// Claude supplies approximate lat/lng for destinations — city-centroid
// accuracy is plenty for the 400km match radius.
const EXTRACT_TOOL: Anthropic.Tool = {
  name: 'update_move_request',
  description:
    'Record the current complete state of the move request. Call this every time you learn ' +
    'something new, re-sending ALL fields you know so far (arrays are full replacements). ' +
    'For every destination, include your best approximate latitude/longitude for the city or ' +
    'region center. Never invent facts the person did not say.',
  input_schema: {
    type: 'object',
    properties: {
      destinations: {
        type: 'array',
        description:
          'EVERY place they would truly consider, wide or narrow — each with approximate coords. ' +
          'Vague wishes ("closer to family") must be resolved into real places before they land here.',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'City/region, e.g. "Pensacola, FL"' },
            lat: { type: 'number' },
            lng: { type: 'number' },
            family: { type: 'boolean', description: 'True if this is where their family is' },
          },
          required: ['label'],
        },
      },
      fromLabel: { type: 'string', description: 'Where they are now, e.g. "Lemoore, CA"' },
      fromLat: { type: 'number' },
      fromLng: { type: 'number' },
      occupation: { type: 'string', description: 'What they do for work, their words' },
      industry: { type: 'string', description: 'The industry that occupation belongs to' },
      populationAnchor: {
        type: 'string',
        enum: ['smaller', 'same', 'bigger', 'any'],
        description: 'Town size they want RELATIVE to where they are now',
      },
      ownership: { type: 'string', enum: ['own', 'rent', 'helping', 'exploring'] },
      acresMin: { type: 'number' },
      bedsMin: { type: 'integer' },
      targetMonthly: { type: 'number' },
      downPayment: { type: 'number' },
      maxPrice: { type: 'number' },
      financingType: { type: 'string', enum: ['Conventional', 'VA', 'Cash', 'Seller financing'] },
      timing: { type: 'string', enum: ['ASAP', '6 months', '1–2 years', 'Flexible'] },
      amenities: {
        type: 'array',
        items: { type: 'string' },
        description: 'Slugs from the amenity vocabulary in your instructions — only exact slugs',
      },
      moveCondition: { type: 'string', description: 'Their one-line "I\'d move if…"' },
      name: { type: 'string' },
      contact: { type: 'string', description: 'Email or phone, only if offered' },
      notes: {
        type: 'string',
        description:
          'Everything meaningful they shared that has no field: household (kids, pets), why now, ' +
          'how long in their town, what they would miss, hobbies, remote work, health, schools. ' +
          'Short semicolon-separated facts. This is enrichment gold — keep it growing.',
      },
      status: {
        type: 'string',
        enum: ['gathering', 'complete'],
        description: 'complete = you have destination(s) + current position and have delivered the warm close',
      },
    },
    required: [],
  },
};

// Frozen system prompt (stable-first for caching; the amenity vocabulary is
// appended once per process start — it changes rarely).
function systemPrompt(amenityList: string) {
  return `You are PlotMaps — the front door of the Real Estate Interconnector. A person clicked an ad and instead of a form, they got you: an alive person, talking back, making them feel good about expressing what they want.

THE OPENING: the page greeted them with one question — "Where would you go?" — over one big input, nothing else. Their first message is them answering (a place, a feeling, a maybe), asking how this works, or a suggestion they tapped ("We keep talking about moving…", "I want land", "Somewhere cheaper than here", "How does this work?"). Don't re-greet; meet them right where their words are. A bare tap like "I want land" is an opener, not a full answer — take it warmly and draw out the rest.

WHAT PLOTMAPS IS (so you can answer "how does this work?" right there):
- People post what they WANT — where they'd move and what would make it worth it. The system compares every request against every other to find direct connections AND multi-step move paths.
- Webs, not swaps: nobody needs to find their exact opposite. Person A and B don't need to want each other's property — if person C or D can complete the loop, a 3- or 4-household move path unlocks that no pair could do alone.
- Privacy: their request saves as a PRIVATE DRAFT, visible only to them, but structured for matching from minute one. Nothing goes public without verification, and posting a want never requires verification — only placing a property on the public map does. "Verify privately. Choose how you appear publicly."
- It's free to post. A licensed brokerage (Position) stands behind it.

YOUR MISSION — every conversation works toward these goals, in rough order:
G1. At least one REAL destination — a place with coordinates, never an unresolved wish. Wide sets welcome.
G2. Their current position: city + own/rent/helping.
G3. Occupation — and tailor the conversation to it.
G4. One matchable constraint: payment comfort, land/size need, or timing.
G5. The one-liner: "I'd move if…"
G6. At close: contact (email or phone) so we can reach them when a connection appears.
Each turn, aim your ONE question at the highest unmet goal — unless their last message opens a door worth walking through (an aside about kids, work, why now: take it, note it, come back to the goals). When G1–G3 are met and the momentum fades, close warm — don't drag a finished conversation. Set status "complete" and tell them to post the card.

HOW TO BE:
- Warm, real, brief. 1–3 short sentences, then ONE question. Never a list of questions. Never form-speak.
- Meet the person, not the data. React to what they actually said before asking the next thing.
- If they ask how it works, answer plainly right there, then pick the thread back up.

WEB SEARCH: you can search the web, but it costs money and time — at most one search per turn, and ONLY when a current, local fact would materially improve their match or their trust (who's hiring in their trade near a destination, a base's current status, whether a market's actually cheaper). Never search for small talk or anything you already know well. Most turns need no search.

WHAT YOU'RE LISTENING FOR (extract via update_move_request as you go — resend the full picture each call):
1. DESTINATIONS — the set of everywhere they'd truly go. Wide is fine: "Florida, Georgia, Tennessee, maybe the Carolinas" = multiple destinations, each matchable. Include your best approximate lat/lng for each.
2. RESOLVE OR IT'S JUNK — never accept a wish that can't match. "Closer to family" → "Where's family?" and the real cities go in the set (family: true). "Near water" → how close counts? "Somewhere cheaper" → cheaper than what, and where would you actually go?
3. OCCUPATION — what somebody does means everything; it decides where they can actually go. Ask naturally ("What do you do for work?"). A Navy mechanic, a nurse, remote software — each opens different doors.
4. COMPARATIVE SIZE — people don't know census numbers, they know their town. "Do you want somewhere as big as [their town], smaller, or more city?"
5. Current position (city + own/rent), rough payment comfort, timing, what they bring (equity, need to sell first, open to seller financing or trading situations), and the one-liner: what would make you move?
6. THE CONVERSATION IS THE SURVEY — while you talk, quietly collect the life around the move into the notes field: kids and their ages/school stage, pets, why now (orders? retirement? a birth? a loss?), how long they've been where they are, what they'd miss, hobbies that need space (horses, shop, boat), remote-work reality, who else moves with them. Never interrogate for these — earn them by being genuinely curious about the person, one light aside at a time ("Kids in school, or is timing yours to pick?"). Every one of these makes their match better and the map smarter.

AMENITY VOCABULARY (use exact slugs in the amenities field):
${amenityList}

RULES:
- Never invent anything they didn't say. Sparse extraction is fine.
- Don't interrogate. If they give you three things in one breath, extract all three and ask about the most important gap.
- Money is a soft ask — rough numbers, "totally fine to skip."
- Contact/name only if they offer or when closing ("Want us to reach you when a connection appears? Email or phone works.").
- When you have at least one real destination and their current position, you can close whenever the conversation feels done: set status "complete" and end warm — like: "Thank you — we'll go find your property. Your request stays private until you say otherwise." Then tell them to hit Post when the card on the side looks right.
- If they drift way off real estate, be human about it briefly, then come back.`;
}

// The amenity vocabulary, loaded once per process (module scope) — stable
// system prompt = cacheable prefix.
let amenityCache: string | null = null;
async function amenityList(): Promise<string> {
  if (amenityCache) return amenityCache;
  const { data } = await supabaseAdmin.from('amenities').select('slug, label').order('slug');
  amenityCache = (data ?? []).map((a) => `${a.slug} (${a.label})`).join(', ') || 'pool, acreage, waterfront';
  return amenityCache;
}

type Extracted = Record<string, unknown>;

// Merge a tool call into the running extraction: non-null scalars overwrite,
// arrays are full replacements (the tool contract says resend everything).
function mergeExtraction(prev: Extracted, input: Extracted): Extracted {
  const next = { ...prev };
  for (const [k, v] of Object.entries(input)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    next[k] = v;
  }
  return next;
}

export async function POST(req: Request) {
  let body: { conversationId?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 4000) : '';
  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 });

  // Load or create the conversation (service-role only — the transcript is
  // sensitive; the uuid is the bearer credential).
  let convId = typeof body.conversationId === 'string' ? body.conversationId : null;
  let transcript: Anthropic.MessageParam[] = [];
  let extracted: Extracted = {};
  if (convId) {
    const { data } = await supabaseAdmin
      .from('intake_conversations')
      .select('transcript, extracted')
      .eq('id', convId)
      .maybeSingle();
    if (data) {
      transcript = (data.transcript as Anthropic.MessageParam[]) ?? [];
      extracted = (data.extracted as Extracted) ?? {};
    } else {
      convId = null;
    }
  }
  if (!convId) {
    const { data: created, error } = await supabaseAdmin
      .from('intake_conversations')
      .insert({ transcript: [], extracted: {} })
      .select('id')
      .single();
    if (error || !created) {
      console.error('intake conversation create error:', error?.message);
      return NextResponse.json({ error: 'could not start' }, { status: 500 });
    }
    convId = created.id;
  }

  if (transcript.length > MAX_TURNS) {
    return NextResponse.json({
      conversationId: convId,
      reply: "We've covered a lot — your request card is ready. Hit Post and we'll go find your property.",
      extracted,
      complete: true,
    });
  }

  transcript.push({ role: 'user', content: message });

  // Sonnet at LOW effort (snappy conversational turns), a CAPPED web search
  // (≤2 uses/turn; the prompt says use it rarely), and top-level prompt
  // caching so the growing transcript is served from cache each turn.
  const params = {
    model: INTAKE_MODEL,
    max_tokens: 4096,
    thinking: { type: 'adaptive' as const },
    output_config: { effort: 'low' as const },
    cache_control: { type: 'ephemeral' as const },
    system: systemPrompt(await amenityList()),
    tools: [
      EXTRACT_TOOL,
      { type: 'web_search_20260209', name: 'web_search', max_uses: 2 } as unknown as Anthropic.Tool,
    ],
  };

  let response: Anthropic.Message;
  const allText: string[] = [];
  let allToolUses: Anthropic.ToolUseBlock[] = [];
  const usage = { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 };
  try {
    response = await anthropic.messages.create({ ...params, messages: transcript });
    // Server tools (web search) can pause the turn — append the assistant
    // content and re-send to let it finish (no extra user message).
    let rounds = 0;
    for (;;) {
      usage.in += response.usage.input_tokens;
      usage.out += response.usage.output_tokens;
      usage.cacheRead += response.usage.cache_read_input_tokens ?? 0;
      usage.cacheWrite += response.usage.cache_creation_input_tokens ?? 0;
      allText.push(...response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text));
      allToolUses = allToolUses.concat(response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'update_move_request',
      ));
      if (response.stop_reason !== 'pause_turn' || rounds >= 3) break;
      transcript.push({ role: 'assistant', content: response.content });
      response = await anthropic.messages.create({ ...params, messages: transcript });
      rounds++;
    }
  } catch (e) {
    console.error('intake anthropic error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'the intake is busy — try again in a moment' }, { status: 502 });
  }

  // Fire-and-forget cost telemetry (cost_events) — Greg watches spend.
  logCost(null, 'anthropic', 'intake-turn',
    usage.in * PRICE.in + usage.out * PRICE.out
    + usage.cacheRead * PRICE.cacheRead + usage.cacheWrite * PRICE.cacheWrite,
    1, { conversationId: convId, model: INTAKE_MODEL, ...usage });

  const reply = allText.join('').trim();
  const toolUses = allToolUses;
  for (const t of toolUses) {
    extracted = mergeExtraction(extracted, t.input as Extracted);
  }

  // Keep the transcript API-valid: append the assistant content verbatim, and
  // if the FINAL message called the extraction tool, answer it in a user turn
  // so the next request continues cleanly (all tool_results in ONE user
  // message; intermediate pause_turn rounds were already appended above).
  transcript.push({ role: 'assistant', content: response.content });
  const finalToolUses = response.content.filter(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'update_move_request',
  );
  if (finalToolUses.length > 0) {
    transcript.push({
      role: 'user',
      content: finalToolUses.map((t) => ({
        type: 'tool_result' as const,
        tool_use_id: t.id,
        content: 'Saved.',
      })),
    });
  }

  const { error: saveErr } = await supabaseAdmin
    .from('intake_conversations')
    .update({ transcript, extracted, updated_at: new Date().toISOString() })
    .eq('id', convId);
  if (saveErr) console.error('intake save error:', saveErr.message);

  return NextResponse.json({
    conversationId: convId,
    reply: reply || 'Tell me more.',
    extracted,
    complete: extracted.status === 'complete',
  });
}

// PATCH /api/intake — link the conversation to the want it produced (called
// after Confirm & Post succeeds). The retrieval side of store-it-all.
export async function PATCH(req: Request) {
  let body: { conversationId?: string; wantId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (!body.conversationId || !body.wantId) {
    return NextResponse.json({ error: 'conversationId and wantId required' }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from('intake_conversations')
    .update({ want_id: body.wantId })
    .eq('id', body.conversationId);
  if (error) return NextResponse.json({ error: 'could not link' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
