export type LeadStatus =
  | "New"
  | "Not Contacted"
  | "Called"
  | "Follow-Up"
  | "Interested"
  | "Not Interested"
  | "Do Not Call"
  | "Hot Lead";

export interface Lead {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: string | null;
  timeline: string | null;
  property_address: string | null;
  property_condition: string | null;
  price_range: string | null;
  pre_approved: boolean | null;
  va_eligible: boolean | null;
  motivation: string | null;
  source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  status: LeadStatus;
  riley_conversation_id: string | null;
  notes: string | null;
  // Added columns
  latitude: number | null;
  longitude: number | null;
  geocoded_at: string | null;
  tags: string[] | null;
}

export interface Contact {
  id: string;
  tenant_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  type: string | null;
  stage: string | null;
  source: string | null;
  address: string | null;
  notes: string | null;
  tags: string[] | null;
  created_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  tenant_id: string | null;
  deal_id: string | null;
  contact_id: string | null;
  milestone_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  due_at: string | null;
  completed_at: string | null;
  assigned_to_profile_id: string | null;
  created_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  lead?: Lead;
}

export interface CallLog {
  id: string;
  tenant_id: string | null;
  contact_id: string | null;
  vapi_call_id: string | null;
  phone_number: string | null;
  caller_number: string | null;
  direction: string | null;
  status: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  summary: string | null;
  recording_url: string | null;
  cost: number | null;
  started_at: string | null;
  ended_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  created_at: string;
  lead_id: string | null;
  scheduled_at: string | null;
  type: string | null;
  status: string | null;
  notes: string | null;
}

export interface Profile {
  id: string;
  tenant_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  settings: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ImportBatch {
  id: string;
  tenant_id: string | null;
  filename: string;
  total_rows: number;
  valid_rows: number;
  geocoded_rows: number;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
}

export interface ImportRow {
  id: string;
  batch_id: string;
  raw_data: Record<string, string>;
  mapped_data: Record<string, string> | null;
  status: "pending" | "valid" | "invalid" | "imported";
  error_message: string | null;
  lead_id: string | null;
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  name: string;
  address: string;
  status: LeadStatus;
  phone: string | null;
  source: string | null;
}

// Status color mapping
export const STATUS_COLORS: Record<LeadStatus, string> = {
  "New": "#3b82f6",
  "Not Contacted": "#6b7280",
  "Called": "#8b5cf6",
  "Follow-Up": "#f59e0b",
  "Interested": "#10b981",
  "Not Interested": "#ef4444",
  "Do Not Call": "#dc2626",
  "Hot Lead": "#059669",
};

export const STATUS_BG_COLORS: Record<LeadStatus, string> = {
  "New": "bg-blue-100 text-blue-700",
  "Not Contacted": "bg-slate-100 text-slate-500",
  "Called": "bg-violet-100 text-violet-700",
  "Follow-Up": "bg-amber-100 text-amber-700",
  "Interested": "bg-emerald-100 text-emerald-700",
  "Not Interested": "bg-rose-100 text-rose-700",
  "Do Not Call": "bg-red-100 text-red-700",
  "Hot Lead": "bg-green-100 text-green-700",
};
