export interface MarketAsset {
  id: string;
  city: string;
  address: string;
  status: "active" | "pending" | "sold";
  list_price: number | null;
  sold_price: number | null;
  sqft: number | null;
  year_built: number | null;
  list_date: string | null;
  pending_date: string | null;
  sold_date: string | null;
  // Lifecycle tracking
  first_seen_date: string | null;
  last_seen_date: string | null;
  inferred_list_date: string | null;
  inferred_pending_date: string | null;
  inferred_sold_date: string | null;
  status_date: string | null;
  // MLS truth layer
  mls_dom: number | null;
  mls_list_date: string | null;
  dom_confidence: string | null;
  needs_dom_research: boolean;
  created_at: string;
}

export type MarketAssetInsert = Omit<MarketAsset, "id" | "created_at">;
