alter table public.community_votes
  drop constraint community_votes_pkey;

alter table public.community_votes
  add primary key (device_hash, community_id);

