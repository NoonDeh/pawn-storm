-- Initial schema for Pawn Storm.
-- Reconstructed from the live database catalog. RLS is enabled with no policies,
-- so only the service role can read or write these tables.

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  balance numeric not null default 1000.00 check (balance >= 0),
  target_balance numeric not null default 100000.00,
  min_balance numeric not null default 100.00,
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.auctions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  status text not null default 'voting' check (status in ('voting', 'settled')),
  item_name text not null,
  item_base_value numeric not null check (item_base_value > 0),
  item_condition text not null check (
    item_condition in ('PRISTINE', 'EXCELLENT', 'GOOD', 'WORN', 'DAMAGED', 'BROKEN')
  ),
  item_authenticity text not null check (
    item_authenticity in ('AUTHENTIC', 'QUESTIONABLE', 'FAKE')
  ),
  item_rarity text not null check (
    item_rarity in ('COMMON', 'UNCOMMON', 'RARE', 'LEGENDARY', 'MYTHIC')
  ),
  real_value numeric not null check (real_value >= 0),
  estimate_min numeric not null,
  estimate_max numeric not null,
  starting_bid numeric not null check (starting_bid >= 0),
  current_bid numeric not null,
  final_bid numeric,
  winner text check (winner in ('STREAMER', 'BOT')),
  profit numeric,
  vote_ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  constraint settled_fields check (
    status = 'voting'
    or (final_bid is not null and winner is not null and profit is not null and settled_at is not null)
  )
);

create index auctions_session_created_idx
  on public.auctions (session_id, created_at desc);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  voter_key text not null check (char_length(voter_key) >= 1 and char_length(voter_key) <= 128),
  choice text not null check (choice in ('RAISE', 'SURRENDER')),
  weight integer not null default 1 check (weight >= 1 and weight <= 3),
  created_at timestamptz not null default now(),
  unique (auction_id, voter_key)
);

create index votes_auction_idx on public.votes (auction_id);

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  external_id text unique,
  donor_name text not null,
  coins integer not null check (coins > 0),
  time_seconds integer not null default 0 check (time_seconds >= 0),
  capital_added numeric not null default 0 check (capital_added >= 0),
  created_at timestamptz not null default now()
);

create index donations_session_created_idx
  on public.donations (session_id, created_at desc);

alter table public.game_sessions enable row level security;
alter table public.auctions enable row level security;
alter table public.votes enable row level security;
alter table public.donations enable row level security;
