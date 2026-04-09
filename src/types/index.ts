export type LeadStatus =
  | "New"
  | "Not Contacted"
  | "Called"
  | "Follow-Up"
  | "Interested"
  | "Not Interested"
  | "Do Not Call"
  | "Hot Lead";

export type CallOutcome =
  | "No Answer"
  | "Left VM"
  | "Spoke with Owner"
  | "Not Interested"
  | "Follow-Up"
  | "DNC";

export type Priority = "high" | "medium" | "low";

export type ActivityType = "call" | "note" | "email" | "letter" | "status_change" | "import";

export type CompType = "active" | "sold" | "pending";

export interface Lead {
  id: string;
  user_id: string;
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
  // Geo columns
  latitude: number | null;
  longitude: number | null;
  geocoded_at: string | null;
  tags: string[] | null;
  // New prospecting columns
  owner_name: string | null;
  phone_2: string | null;
  phone_3: string | null;
  mailing_address: string | null;
  mailing_city: string | null;
  mailing_state: string | null;
  mailing_zip: string | null;
  follow_up_date: string | null;
  last_contact_date: string | null;
  priority: Priority | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  // MLS listing data
  listing_status: string | null;
  listing_price: number | null;
  selling_price: number | null;
  dom: number | null;
  listing_date: string | null;
  pending_date: string | null;
  selling_date: string | null;
  sqft: number | null;
  lot_acres: number | null;
  year_built: number | null;
  record_type: string | null;
}

export interface Activity {
  id: string;
  lead_id: string | null;
  type: ActivityType;
  title: string;
  description: string | null;
  outcome: CallOutcome | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface MarketComp {
  id: string;
  lead_id: string | null;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  sale_price: number | null;
  list_price: number | null;
  sale_date: string | null;
  sqft: number | null;
  beds: number | null;
  baths: number | null;
  year_built: number | null;
  lot_size: string | null;
  comp_type: CompType;
  dom: number | null;
  price_per_sqft: number | null;
  notes: string | null;
  source: string | null;
  created_at: string;
}

export interface ImportTemplate {
  id: string;
  name: string;
  source: string;
  column_mapping: Record<string, string>;
  field_defaults: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

export interface DailyTarget {
  id: string;
  target_date: string;
  conversations_target: number;
  conversations_actual: number;
  followups_target: number;
  followups_actual: number;
  letters_target: number;
  letters_actual: number;
  new_contacts_target: number;
  new_contacts_actual: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
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

// AI Action List item
export interface ActionItem {
  leadId: string;
  leadName: string;
  address: string | null;
  phone: string | null;
  action: string;
  reason: string;
  suggestedOpener: string | null;
  priority: Priority;
}

// MLS listing status colors (for map markers)
export type ListingStatus = 'Sold' | 'Active' | 'Pending';

export const LISTING_STATUS_COLORS: Record<string, string> = {
  'Active': '#22c55e',    // green
  'Pending': '#a855f7',   // purple
  'Sold': '#eab308',      // yellow/gold
};

export const LISTING_STATUS_BG: Record<string, string> = {
  'Sold': 'bg-green-500/10 text-green-500',
  'Active': 'bg-orange-500/10 text-orange-500',
  'Pending': 'bg-yellow-500/10 text-yellow-500',
};

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
  "New": "bg-blue-500/10 text-blue-400",
  "Not Contacted": "bg-slate-500/10 text-slate-400",
  "Called": "bg-violet-500/10 text-violet-400",
  "Follow-Up": "bg-amber-500/10 text-amber-400",
  "Interested": "bg-emerald-500/10 text-emerald-400",
  "Not Interested": "bg-rose-500/10 text-rose-400",
  "Do Not Call": "bg-red-500/10 text-red-400",
  "Hot Lead": "bg-green-500/10 text-green-400",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  high: "bg-red-500/10 text-red-400",
  medium: "bg-amber-500/10 text-amber-400",
  low: "bg-slate-500/10 text-slate-400",
};
