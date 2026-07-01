-- ── Bullpen: shareable buyer positions + lender offers ────────────────
--
-- The buyer platform's spine (memory/project_position_job_posting_architecture).
-- A buyer STATES their position (occupation-first, stated-only — no verified
-- sensitive data, so no BIPA/FCRA/GLBA/CCPA exposure). The post gets a short
-- public SLUG → a shareable link the agent, the buyer, and the buyer's
-- family/friends all broadcast (three concentric networks). Any lender who
-- opens the link can post an OFFER. Offers accumulate over days on a NEUTRAL
-- timeline; the buyer sorts + chooses (Plot NEVER ranks).
--
-- Access posture: RLS ENABLED with NO anon/authenticated policies. These
-- tables are reached ONLY through API routes using the service-role client
-- (same pattern as /api/addresses). The API decides exactly what a public
-- link view exposes — the raw table is never client-readable.

-- ── posts ─────────────────────────────────────────────────────────────
create table if not exists public.bullpen_posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,                 -- short public id for the link (/b/<slug>)

  -- who's behind it (stated, not verified). Buyer may post themselves; the
  -- agent's info lives IN the post either way (their share carries legitimacy).
  buyer_name   text,                                 -- first name / handle (optional, buyer's choice)
  occupation   text not null,                        -- THE hero signal: "Correctional Officer, Corcoran"
  agent_name   text,                                 -- the representing agent (vouch by presence)
  agent_email  text,
  agent_phone  text,

  -- the stated position (all optional depth beyond occupation)
  military        text,                              -- 'active' | 'veteran' | 'no'
  military_detail text,                              -- "Navy · LT · NAS Lemoore"
  price_range  text,
  down_payment text,
  loan_type    text,
  timeline     text,
  income       text,
  debts        text,
  credit_band  text,
  proof_note   text,                                 -- optional role-proof gesture (work email / LinkedIn / note)

  -- who owns/created it (nullable — a buyer without an account can post)
  created_by   uuid references auth.users(id) on delete set null,

  status       text not null default 'open',         -- 'open' | 'closed'
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists bullpen_posts_slug_idx    on public.bullpen_posts (slug);
create index if not exists bullpen_posts_created_idx  on public.bullpen_posts (created_at desc);

-- ── offers ────────────────────────────────────────────────────────────
create table if not exists public.bullpen_offers (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.bullpen_posts(id) on delete cascade,

  -- the lender (stated). Identity stays sealed from other lenders; the buyer
  -- sees it. NMLS is a voluntary trust gesture, not verified by Plot.
  lender_name  text not null,
  lender_email text,
  lender_nmls  text,
  loan_type    text,

  -- the numbers — full honest breakdown so junk fees are visible
  rate_pct     numeric(6,3),
  apr_pct      numeric(6,3),
  points       numeric(5,3) default 0,
  lender_fees  numeric(12,2) default 0,
  credit       numeric(12,2) default 0,             -- lender credit toward closing (reduces cost)
  monthly_pi   numeric(12,2),
  est_cost_5yr numeric(14,2),
  note         text,                                 -- the lender's one-line pitch

  created_at   timestamptz not null default now()
);

create index if not exists bullpen_offers_post_idx on public.bullpen_offers (post_id, created_at);

-- ── updated_at trigger for posts ──────────────────────────────────────
create or replace function public.bullpen_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists bullpen_posts_touch on public.bullpen_posts;
create trigger bullpen_posts_touch
  before update on public.bullpen_posts
  for each row execute function public.bullpen_touch_updated_at();

-- ── RLS: locked down. Service-role only (API-mediated). No anon policies. ──
alter table public.bullpen_posts  enable row level security;
alter table public.bullpen_offers enable row level security;
-- (No policies for anon/authenticated → those roles get zero rows. All access
--  flows through the service-role API routes, which shape the public payload.)
