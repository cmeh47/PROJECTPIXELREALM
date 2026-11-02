-- Barley the bartender: he welcomes you to town and asks you to split 5 logs of firewood on the
-- chopping block out back. He pays 15 coins when you tell him it's done.
--
-- Apply it after the save_base, heroes, boar_hunting and merchant_rescue migrations (`supabase db
-- push`, or paste it into the SQL editor). Like the rest of the base, the app never writes these
-- columns: it calls bartender_step below.

alter table public.bases
  -- 'new' (he hasn't given you the job, or you said not now), 'quest' (splitting logs) or 'done'.
  add column bartender text not null default 'new' check (bartender in ('new', 'quest', 'done')),
  -- Logs split so far (0 to 5), and when the last one was split.
  add column firewood integer not null default 0 check (firewood between 0 and 5),
  add column last_split_at timestamptz;

create or replace function public.firewood_need() returns integer language sql immutable as $$ select 5 $$;
create or replace function public.firewood_reward() returns integer language sql immutable as $$ select 15 $$;

-- The base as the app sees it, now with Barley's job.
create or replace function public.base_json(b public.bases) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'wood', b.wood,
    'shroomies', to_jsonb(b.shroomies),
    'butcher', b.butcher,
    'build_started_at', b.build_started_at,
    'build_done', b.butcher = 'building' and now() >= b.build_started_at + public.hut_build_interval(),
    'meat', b.meat,
    'ground_meat', b.ground_meat,
    'coins', b.coins,
    'boars_back_at', to_jsonb(b.boars_back_at),
    'merchant', b.merchant,
    'bartender', b.bartender,
    'firewood', b.firewood,
    'server_now', now()
  )
$$;

create or replace function public.save_base(b public.bases) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  b.updated_at := now();
  update public.bases set
    wood = b.wood,
    shroomies = b.shroomies,
    butcher = b.butcher,
    build_started_at = b.build_started_at,
    chop_budget = b.chop_budget,
    last_chop_at = b.last_chop_at,
    meat = b.meat,
    ground_meat = b.ground_meat,
    coins = b.coins,
    boars_back_at = b.boars_back_at,
    merchant = b.merchant,
    bartender = b.bartender,
    firewood = b.firewood,
    last_split_at = b.last_split_at,
    updated_at = b.updated_at
  where owner = b.owner;
  return public.base_json(b);
end $$;

-- Each step only moves forward. 'accept': you took the job; 'split': one log split on the block
-- (three swings take about a second, so two splits less than 0.6 s apart are refused); 'handin':
-- you told him all five are done, and he pays you.
create or replace function public.bartender_step(step text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b public.bases := public.my_base();
begin
  if step = 'accept' and b.bartender = 'new' then
    b.bartender := 'quest';
  elsif step = 'split' and b.bartender = 'quest' and b.firewood < public.firewood_need() then
    if b.last_split_at is not null and now() < b.last_split_at + interval '600 milliseconds' then
      raise exception 'Splitting too fast' using errcode = 'P0001';
    end if;
    b.firewood := b.firewood + 1;
    b.last_split_at := now();
  elsif step = 'handin' and b.bartender = 'quest' then
    if b.firewood < public.firewood_need() then
      raise exception 'Not enough firewood' using errcode = 'P0001';
    end if;
    b.bartender := 'done';
    b.coins := b.coins + public.firewood_reward();
  else
    raise exception 'Barley is not ready for "%"', step using errcode = 'P0001';
  end if;
  return public.save_base(b);
end $$;

revoke execute on function public.bartender_step(text) from public, anon;
grant execute on function public.bartender_step(text) to authenticated;
