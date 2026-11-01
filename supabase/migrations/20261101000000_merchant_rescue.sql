-- Puul the merchant: lost in the far corner of the Boar Woods, circled by boars. You save him, walk
-- him home, and he asks for 20 wood to build his merchant stand.
--
-- Apply it after the save_base, heroes and boar_hunting migrations (`supabase db push`, or paste it
-- into the SQL editor). Like the rest of the base, the app never writes this column: it calls
-- merchant_step below.

alter table public.bases
  -- 'lost' (in the woods), 'escort' (following you home), 'home' (on your base, offering the stand
  -- job), 'stand' (gathering the wood) or 'open' (the stand is built).
  add column merchant text not null default 'lost' check (merchant in ('lost', 'escort', 'home', 'stand', 'open'));

create or replace function public.stand_wood() returns integer language sql immutable as $$ select 20 $$;

-- The base as the app sees it, now with Puul.
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
    updated_at = b.updated_at
  where owner = b.owner;
  return public.base_json(b);
end $$;

-- Each step of Puul's story only moves forward from the step before it. 'rescued': the boars
-- circling him are beaten (the battle result is still trusted from the app); 'home': you walked him
-- back to your base; 'accept': you took the stand job; 'handin': 20 wood for the stand.
create or replace function public.merchant_step(step text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b public.bases := public.my_base();
begin
  if step = 'rescued' and b.merchant = 'lost' then
    b.merchant := 'escort';
  elsif step = 'home' and b.merchant = 'escort' then
    b.merchant := 'home';
  elsif step = 'accept' and b.merchant = 'home' then
    b.merchant := 'stand';
  elsif step = 'handin' and b.merchant = 'stand' then
    if b.wood < public.stand_wood() then
      raise exception 'Not enough wood' using errcode = 'P0001';
    end if;
    b.wood := b.wood - public.stand_wood();
    b.merchant := 'open';
  else
    raise exception 'Puul is not ready for "%"', step using errcode = 'P0001';
  end if;
  return public.save_base(b);
end $$;

revoke execute on function public.merchant_step(text) from public, anon;
grant execute on function public.merchant_step(text) to authenticated;
