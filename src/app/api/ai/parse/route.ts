import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAuthUser, isSubscribed } from '@/lib/auth';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT = `You are a data extraction assistant specializing in real estate property records. Extract all property records from the provided text. For each property, extract these fields:

- property_address
- owner_name
- phone
- phone_2
- email
- mailing_address
- mailing_city
- mailing_state
- mailing_zip
- city
- state
- zip
- price_range
- property_condition
- notes

Return the results as a JSON array. If a field is not found, use null. Return ONLY the JSON array, no other text.`;

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!await isSubscribed(user.id)) {
      return NextResponse.json({ error: 'Subscription required' }, { status: 403 });
    }

    const { text, source } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    const userPrompt = source
      ? `Source: ${source}\n\nExtract all property records from the following text:\n\n${text}`
      : `Extract all property records from the following text:\n\n${text}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Extract text from the response
    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    // Parse the JSON array from Claude's response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Failed to parse AI response as JSON', raw: responseText },
        { status: 422 }
      );
    }

    const records = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ records, count: records.length });
  } catch (error: unknown) {
    console.error('AI parse error:', error);
    const message = error instanceof Error ? error.message : 'AI parsing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
