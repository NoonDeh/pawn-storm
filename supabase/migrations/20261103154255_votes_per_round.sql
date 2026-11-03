-- Votes are counted per round, not per auction.
-- A single auction can have several voting rounds, so one voter may vote once in each round.

alter table public.auctions
  add column current_round integer not null default 1 check (current_round >= 1);

alter table public.votes
  add column round integer not null default 1 check (round >= 1);

alter table public.votes drop constraint votes_auction_id_voter_key_key;

alter table public.votes
  add constraint votes_auction_round_voter_key unique (auction_id, round, voter_key);
