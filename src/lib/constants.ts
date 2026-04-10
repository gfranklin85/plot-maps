export const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: "dashboard" },
  { label: "Map", href: "/map", icon: "map" },
  { label: "Leads", href: "/leads", icon: "group" },
  { label: "Imports", href: "/imports", icon: "upload_file" },
] as const;

export const LEAD_STATUSES = [
  "New",
  "Not Contacted",
  "Called",
  "Follow-Up",
  "Interested",
  "Not Interested",
  "Do Not Call",
  "Hot Lead",
] as const;

export const LEAD_SOURCES = [
  "Mojo",
  "RPR",
  "PropWire",
  "SmartZip",
  "BatchLeads",
  "Zillow",
  "Cold Call",
  "Referral",
  "Manual",
  "CSV Import",
  "AI Parse",
] as const;

export const CALL_OUTCOMES = [
  "No Answer",
  "Left VM",
  "Spoke with Owner",
  "Not Interested",
  "Follow-Up",
  "DNC",
] as const;

export const PRIORITIES = ["high", "medium", "low"] as const;

export const TASK_TABS = [
  { label: "Follow-ups Due Today", key: "due-today" },
  { label: "Overdue", key: "overdue" },
  { label: "Hot Leads", key: "hot-leads" },
  { label: "Recently Imported", key: "recently-imported" },
] as const;

// Map default center — Lemoore, CA (centered on neighborhoods)
export const MAP_CENTER: { lat: number; lng: number } = { lat: 36.3008, lng: -119.7828 };
export const MAP_ZOOM = 14;

// System fields for import column mapping
export const IMPORT_SYSTEM_FIELDS = [
  { key: "property_address", label: "Property Address", required: true },
  { key: "owner_name", label: "Owner Name", required: false },
  { key: "name", label: "Contact Name", required: false },
  { key: "phone", label: "Phone 1", required: false },
  { key: "phone_2", label: "Phone 2", required: false },
  { key: "phone_3", label: "Phone 3", required: false },
  { key: "email", label: "Email", required: false },
  { key: "mailing_address", label: "Mailing Address", required: false },
  { key: "mailing_city", label: "Mailing City", required: false },
  { key: "mailing_state", label: "Mailing State", required: false },
  { key: "mailing_zip", label: "Mailing ZIP", required: false },
  { key: "city", label: "Property City", required: false },
  { key: "state", label: "Property State", required: false },
  { key: "zip", label: "Property ZIP", required: false },
  { key: "status", label: "Status", required: false },
  { key: "source", label: "Source", required: false },
  { key: "tags", label: "Tags", required: false },
  { key: "price_range", label: "Price / Value", required: false },
  { key: "property_condition", label: "Property Condition", required: false },
  { key: "notes", label: "Notes", required: false },
  { key: "latitude", label: "Latitude", required: false },
  { key: "longitude", label: "Longitude", required: false },
] as const;

// Export formats
export const EXPORT_FORMATS = [
  { key: "phone-list", label: "Phone List", fields: ["owner_name", "name", "phone", "phone_2", "property_address"] },
  { key: "address-list", label: "Address List", fields: ["property_address", "city", "state", "zip", "owner_name"] },
  { key: "call-sheet", label: "Call Sheet", fields: ["owner_name", "name", "phone", "phone_2", "phone_3", "property_address", "status", "notes"] },
  { key: "mailing-sheet", label: "Mailing Sheet", fields: ["owner_name", "mailing_address", "mailing_city", "mailing_state", "mailing_zip", "property_address"] },
  { key: "full", label: "Full Export", fields: [] },
] as const;

// User phone (for Twilio click-to-call)
export const USER_PHONE = process.env.NEXT_PUBLIC_USER_PHONE || "+15595551234";
