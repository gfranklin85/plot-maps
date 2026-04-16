// VAPI REST client — server-side only
// Docs: https://docs.vapi.ai/api-reference

const VAPI_BASE_URL = 'https://api.vapi.ai';
const VAPI_API_KEY = process.env.VAPI_API_KEY || '';

interface VapiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

async function vapiFetch<T = unknown>(path: string, options: VapiFetchOptions = {}): Promise<T> {
  if (!VAPI_API_KEY) throw new Error('VAPI_API_KEY not set');

  const res = await fetch(`${VAPI_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`VAPI ${options.method || 'GET'} ${path} failed: ${res.status} ${text}`);
  }

  // Some endpoints return empty body on success
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return {} as T;
  return res.json() as Promise<T>;
}

// ── Assistants ────────────────────────────────────────────────────────────

export interface VapiAssistantConfig {
  name: string;
  firstMessage: string;
  model: {
    provider: 'openai';
    model: string;
    temperature?: number;
    systemPrompt?: string;
  };
  voice: {
    provider: '11labs' | 'playht' | 'azure';
    voiceId: string;
  };
  transcriber?: {
    provider: 'deepgram';
    model?: string;
    language?: string;
  };
  endCallFunctionEnabled?: boolean;
  recordingEnabled?: boolean;
  silenceTimeoutSeconds?: number;
  maxDurationSeconds?: number;
}

export interface VapiAssistant {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export async function createAssistant(config: VapiAssistantConfig): Promise<VapiAssistant> {
  return vapiFetch<VapiAssistant>('/assistant', {
    method: 'POST',
    body: config,
  });
}

export async function listAssistants(): Promise<VapiAssistant[]> {
  return vapiFetch<VapiAssistant[]>('/assistant');
}

// ── Calls ─────────────────────────────────────────────────────────────────

export interface StartCallOptions {
  assistantId: string;
  phoneNumber: string; // E.164 format, e.g. "+15591234567"
  phoneNumberId?: string; // VAPI phone number ID for outbound
  assistantOverrides?: {
    firstMessage?: string;
    variableValues?: Record<string, string | number | null>;
    model?: {
      provider: 'openai';
      model: string;
      temperature?: number;
      messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    };
    voice?: {
      provider: string;
      voiceId: string;
    };
    maxDurationSeconds?: number;
    endCallFunctionEnabled?: boolean;
  };
  metadata?: Record<string, string>;
}

export interface VapiCall {
  id: string;
  status: 'queued' | 'ringing' | 'in-progress' | 'forwarding' | 'ended';
  phoneNumberId?: string;
  assistantId: string;
  customer?: { number: string };
  startedAt?: string;
  endedAt?: string;
  endedReason?: string;
  cost?: number;
  costBreakdown?: Record<string, number>;
  transcript?: string;
  recordingUrl?: string;
  summary?: string;
  monitor?: {
    listenUrl?: string;
    controlUrl?: string;
  };
}

export async function startCall(options: StartCallOptions): Promise<VapiCall> {
  const body: Record<string, unknown> = {
    assistantId: options.assistantId,
    customer: { number: options.phoneNumber },
  };
  if (options.phoneNumberId) body.phoneNumberId = options.phoneNumberId;
  if (options.assistantOverrides) body.assistantOverrides = options.assistantOverrides;
  if (options.metadata) body.metadata = options.metadata;

  return vapiFetch<VapiCall>('/call/phone', {
    method: 'POST',
    body,
  });
}

export async function getCall(callId: string): Promise<VapiCall> {
  return vapiFetch<VapiCall>(`/call/${callId}`);
}

export async function endCall(callId: string): Promise<void> {
  await vapiFetch(`/call/${callId}`, {
    method: 'PATCH',
    body: { status: 'ended' },
  });
}

// Send a message into the live call (e.g. make the assistant say something specific)
export async function injectMessage(callId: string, content: string): Promise<void> {
  await vapiFetch(`/call/${callId}/control`, {
    method: 'POST',
    body: {
      type: 'say',
      message: content,
    },
  });
}

// Transfer a live call to a phone number (used for Jump In / warm transfer)
export async function transferCall(callId: string, destination: string): Promise<void> {
  await vapiFetch(`/call/${callId}/control`, {
    method: 'POST',
    body: {
      type: 'transfer',
      destination: {
        type: 'number',
        number: destination,
      },
    },
  });
}

// ── Webhook signature verification ────────────────────────────────────────

export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.VAPI_WEBHOOK_SECRET || '';
  if (!secret) return false;
  // VAPI sends a simple shared-secret header — verify it matches.
  // (VAPI's current webhook auth is header-based; HMAC coming in future.)
  return signatureHeader === secret;
}
