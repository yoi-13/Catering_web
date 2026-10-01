-- Experimental V1: one versioned aggregate, atomically updated. No browser DB access.
create table if not exists public.catering_state (
 id integer primary key check (id = 1), data jsonb, revision integer not null default 0
);
insert into public.catering_state(id) values(1) on conflict do nothing;
alter table public.catering_state enable row level security;
revoke all on public.catering_state from anon, authenticated;
grant all on public.catering_state to service_role;
create or replace function public.save_catering_state(expected_revision integer,new_data jsonb)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 update catering_state set data=new_data,revision=revision+1 where id=1 and revision=expected_revision;
 return found;
end; $$;
revoke all on function public.save_catering_state(integer,jsonb) from public,anon,authenticated;
grant execute on function public.save_catering_state(integer,jsonb) to service_role;
create table if not exists public.catering_limits (key text primary key,window_start timestamptz not null,hits integer not null);
alter table public.catering_limits enable row level security;
revoke all on public.catering_limits from anon,authenticated;
grant all on public.catering_limits to service_role;
create or replace function public.catering_rate_limit(bucket_key text,max_requests integer)
returns boolean language plpgsql security invoker set search_path=public as $$
declare count_hits integer;
begin
 delete from catering_limits where window_start < now()-interval '1 day';
 insert into catering_limits(key,window_start,hits) values(bucket_key,now(),1)
 on conflict(key) do update set
 hits=case when catering_limits.window_start<now()-interval '15 minutes' then 1 else catering_limits.hits+1 end,
 window_start=case when catering_limits.window_start<now()-interval '15 minutes' then now() else catering_limits.window_start end
 returning hits into count_hits;
 return count_hits<=max_requests;
end; $$;
revoke all on function public.catering_rate_limit(text,integer) from public,anon,authenticated;
grant execute on function public.catering_rate_limit(text,integer) to service_role;
