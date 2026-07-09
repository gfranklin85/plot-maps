import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { logCost } from '@/lib/cost-tracker';

// POST /api/statement-read — read a mortgage statement into the envelope slots.
//
// The ONE place AI genuinely earns its cost on the seller intake (Greg
// 2026-07-08): the person uploads their mortgage statement (PDF/PNG/JPG) and
// Claude vision reads the four facts that make the envelope — balance owed,
// note rate, monthly P&I, and (if shown) escrow/total payment + loan type.
// The user CONFIRMS/corrects before anything is used. One cheap call per doc,
// not per turn. Everything downstream (equity, remaining term, payment
// ceiling) is then pure math (lib/finance/envelope). memory/the_thesis.

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MAX_BYTES = 12 * 1024 * 1024; // 12MB
const OK_TYPES: Record<string, 'image' | 'pdf'> = {
  'image/png': 'image', 'image/jpeg': 'image', 'image/webp': 'image', 'application/pdf': 'pdf',
};

const READ_TOOL: Anthropic.Tool = {
  name: 'record_mortgage_facts',
  description:
    'Record the loan facts read from this mortgage statement. Only fill a field ' +
    'if you can actually see it on the document — leave anything you cannot read null.',
  input_schema: {
    type: 'object',
    properties: {
      owed: { type: 'number', description: 'Current principal balance / unpaid balance owed' },
      ratePct: { type: 'number', description: 'Interest / note rate as a percent (e.g. 3.25)' },
      monthlyPI: { type: 'number', description: 'Monthly principal + interest amount (NOT the total with escrow, if both are shown)' },
      monthlyTotal: { type: 'number', description: 'Total monthly payment incl. escrow/taxes/insurance, if shown' },
      loanType: { type: 'string', enum: ['VA', 'FHA', 'Conventional', 'USDA', 'Other'], description: 'Loan type if identifiable' },
      lender: { type: 'string', description: 'Servicer / lender name if shown' },
      propertyAddress: { type: 'string', description: 'The mortgaged property address if shown' },
      readable: { type: 'boolean', description: 'False if the document is not a mortgage statement or is unreadable' },
    },
    required: ['readable'],
  },
};

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'no file' }, { status: 400 });
  }
  const kind = OK_TYPES[file.type];
  if (!kind) {
    return NextResponse.json({ error: 'upload a PDF, PNG, or JPG' }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file too large (max 12MB)' }, { status: 413 });
  }

  const b64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  const doc: Anthropic.ContentBlockParam = kind === 'pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
    : { type: 'image', source: { type: 'base64', media_type: file.type as 'image/png' | 'image/jpeg' | 'image/webp', data: b64 } };

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      system:
        'You read a homeowner\'s mortgage statement and extract only the loan facts, accurately. ' +
        'Never guess a number you cannot see. Distinguish principal+interest from the escrowed total. ' +
        'Call record_mortgage_facts exactly once.',
      tools: [READ_TOOL],
      tool_choice: { type: 'tool', name: 'record_mortgage_facts' },
      messages: [{
        role: 'user',
        content: [doc, { type: 'text', text: 'Read this mortgage statement and record the loan facts.' }],
      }],
    });
  } catch (e) {
    console.error('statement-read error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'could not read the statement — try typing it in' }, { status: 502 });
  }

  logCost(null, 'anthropic', 'statement-read',
    response.usage.input_tokens * 2e-6 + response.usage.output_tokens * 10e-6,
    1, { kind });

  const call = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'record_mortgage_facts',
  );
  const facts = (call?.input ?? { readable: false }) as Record<string, unknown>;
  if (!facts.readable) {
    return NextResponse.json({ error: "that didn't look like a readable mortgage statement — try another photo or type it in" }, { status: 422 });
  }
  return NextResponse.json({ facts });
}
