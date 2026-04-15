const BASE_URL = 'https://tracerfy.com/v1/api';
const API_KEY = process.env.TRACERFY_API_KEY || '';

async function tracerfy(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Tracerfy ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Batch Trace (async — webhook on complete) ──

interface BatchTraceAddress {
  address: string;
  city: string;
  state: string;
  zip?: string;
}

interface BatchTraceResult {
  message: string;
  queue_id: number;
  status: string;
  rows_uploaded: number;
  trace_type: string;
  credits_per_lead: number;
  estimated_wait_seconds: number;
}

export async function batchTrace(addresses: BatchTraceAddress[], traceType: 'normal' | 'advanced' = 'advanced'): Promise<BatchTraceResult> {
  // Tracerfy batch endpoint requires multipart/form-data
  const jsonData = addresses.map(a => ({
    address: a.address.split(',')[0]?.trim() || a.address,
    city: a.city || '',
    state: a.state || '',
    zip: a.zip || '',
  }));

  const formData = new FormData();
  formData.append('json_data', JSON.stringify(jsonData));
  formData.append('address_column', 'address');
  formData.append('city_column', 'city');
  formData.append('state_column', 'state');
  formData.append('zip_column', 'zip');
  formData.append('first_name_column', 'first_name');
  formData.append('last_name_column', 'last_name');
  formData.append('mail_address_column', 'mail_address');
  formData.append('mail_city_column', 'mail_city');
  formData.append('mail_state_column', 'mail_state');
  formData.append('trace_type', traceType);

  const res = await fetch(`${BASE_URL}/trace/`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Tracerfy batch ${res.status}: ${text}`);
  }

  return res.json();
}

// ── Instant Lookup (sync — returns immediately) ──

interface PersonResult {
  first_name: string;
  last_name: string;
  full_name: string;
  dob: string;
  age: string;
  deceased: boolean;
  property_owner: boolean;
  litigator: boolean;
  mailing_address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  phones: {
    number: string;
    type: string;
    dnc: boolean;
    carrier: string;
    rank: number;
  }[];
  emails: {
    email: string;
    rank: number;
  }[];
}

export interface InstantLookupResult {
  address: string;
  city: string;
  state: string;
  zip: string;
  hit: boolean;
  persons_count: number;
  credits_deducted: number;
  persons: PersonResult[];
}

export async function instantLookup(
  address: string,
  city: string,
  state: string,
  zip?: string
): Promise<InstantLookupResult> {
  return tracerfy('/trace/lookup/', {
    method: 'POST',
    body: JSON.stringify({
      address: address.split(',')[0]?.trim() || address,
      city,
      state,
      zip: zip || '',
      find_owner: true,
    }),
  });
}

// ── Queue Results ──

interface QueueRecord {
  address: string;
  city: string;
  state: string;
  first_name: string;
  last_name: string;
  primary_phone: string;
  primary_phone_type: string;
  email_1: string;
  mobile_1: string;
  mobile_2: string;
  mobile_3: string;
  landline_1: string;
  landline_2: string;
  mail_address: string;
  mail_city: string;
  mail_state: string;
}

export async function getQueueResults(queueId: number): Promise<QueueRecord[]> {
  return tracerfy(`/queue/${queueId}`);
}

// ── Analytics ──

interface TracerfyAnalytics {
  total_queues: number;
  properties_traced: number;
  queues_pending: number;
  queues_completed: number;
  balance: number;
}

export async function getAnalytics(): Promise<TracerfyAnalytics> {
  return tracerfy('/analytics/');
}
