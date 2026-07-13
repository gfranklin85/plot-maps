-- ── Listings: post your property for FREE ─────────────────────────────
--
-- The listings marketplace (Greg, 2026-07-13). "Post your listing for free —
-- yes, that's right." Zillow charges; we don't. An owner (FSBO) or an agent
-- signs in with Google (kills spam, ties the listing to a real account) and
-- posts a property. Zero fee. The listing shows up on the public /listings
-- browse grid AND, because it carries lat/lng + status='active', it renders
-- on the 3D map as an "Active" house-pin for free (AdvancedLeadMarkers keys on
-- listing_status='Active') — shape it into the Lead type at read time.
--
-- Access posture: RLS ENABLED with NO anon/authenticated policies (same as
-- bullpen/wants). All access flows through the service-role API routes, which
-- shape exactly what a public view exposes. Photos live in the public
-- `listing-photos` Storage bucket; only their URLs are stored here.

create table if not exists public.listings (
  id            uuid primary key default gen_random_uuid(),

  -- who posted it (nullable so a draft can exist pre-auth; the page gates
  -- on Google sign-in, and the API stamps the session user when present).
  user_id       uuid references auth.users(id) on delete set null,
  posted_by     text not null default 'owner',        -- 'owner' | 'agent'

  -- location (Google Places autocomplete → lat/lng; APN matched when known)
  apn           text,                                  -- parcel link (properties.apn)
  address       text not null,                         -- the one required field
  city          text,
  state         text,
  zip           text,
  lat           double precision,
  lng           double precision,

  -- the listing facts
  status        text not null default 'active',        -- active | pending | sold | draft
  price         numeric(14,2),
  beds          numeric(4,1),
  baths         numeric(4,1),
  sqft          integer,
  lot_sqft      integer,
  year_built    integer,
  property_type text,                                  -- single-family | condo | land | multi | manufactured | other
  description   text,
  photos        text[] not null default '{}',          -- public URLs in the listing-photos bucket

  -- contact (how a buyer reaches the seller/agent)
  contact_name  text,
  contact_email text,
  contact_phone text,

  visibility    text not null default 'public',        -- public | draft
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists listings_status_idx   on public.listings (status, created_at desc);
create index if not exists listings_geo_idx       on public.listings (lat, lng);
create index if not exists listings_apn_idx       on public.listings (apn);
create index if not exists listings_user_idx      on public.listings (user_id, created_at desc);
create index if not exists listings_visibility_idx on public.listings (visibility, status);

-- updated_at trigger
create or replace function public.listings_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists listings_touch on public.listings;
create trigger listings_touch
  before update on public.listings
  for each row execute function public.listings_touch_updated_at();

-- RLS: locked to service-role (API-mediated). No anon/authenticated policies.
alter table public.listings enable row level security;

-- ── Storage bucket for listing photos (public read) ───────────────────
-- Create a public bucket so uploaded photo URLs are directly viewable. The
-- upload itself goes through an API route using the service-role client, so
-- we don't need anon insert policies on storage.objects.
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;
