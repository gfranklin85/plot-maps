export const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: "dashboard" },
  { label: "Map", href: "/map", icon: "map" },
  { label: "Leads", href: "/leads", icon: "group" },
  { label: "Imports", href: "/imports", icon: "upload_file" },
  { label: "Tasks", href: "/tasks", icon: "assignment" },
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
  "Zillow",
  "Cold Call",
  "Referral",
  "Manual",
  "CSV Import",
] as const;

export const TASK_TABS = [
  { label: "Follow-ups Due Today", key: "due-today" },
  { label: "Overdue", key: "overdue" },
  { label: "Hot Leads", key: "hot-leads" },
  { label: "Recently Imported", key: "recently-imported" },
] as const;

// Map default center (523 Puffin Lane, Lemoore CA 93245)
export const MAP_CENTER: { lat: number; lng: number } = { lat: 36.2632, lng: -119.7988 };
export const MAP_ZOOM = 14;
