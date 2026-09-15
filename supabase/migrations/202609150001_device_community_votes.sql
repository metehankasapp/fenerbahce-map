create extension if not exists pgcrypto;

create table public.device_installations (
  device_hash text primary key check (length(device_hash) = 64),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.community_votes (
  device_hash text primary key references public.device_installations(device_hash) on delete cascade,
  community_id text not null check (community_id ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  created_at timestamptz not null default now()
);

create index community_votes_community_id_idx on public.community_votes (community_id);

alter table public.device_installations enable row level security;
alter table public.community_votes enable row level security;

-- There are intentionally no client policies. Only the service-role Edge Function can read/write votes.
revoke all on public.device_installations from anon, authenticated;
revoke all on public.community_votes from anon, authenticated;

create view public.community_vote_counts
with (security_invoker = true)
as
select community_id, count(*)::bigint as vote_count
from public.community_votes
group by community_id;

revoke all on public.community_vote_counts from anon, authenticated;
