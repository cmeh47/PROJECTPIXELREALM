-- Boar hunting: the Boar Woods' three boars, meat left on the ground after a hunt, the player's
-- inventory (wood and boar meat, 20 slots, stacks of 99) and coins from selling meat to the butcher.
--
-- Apply it after the save_base and heroes migrations (`supabase db push`, or paste it into the SQL
-- editor). Like the rest of the base, the app never writes these columns: it calls the functions below.

alter table public.bases
  add column meat integer not null default 0 check (meat >= 0),
  -- Meat dropped in the woods that hasn't been picked up yet. Picking up moves it into the inventory.
  add column ground_meat integer not null default 0 check (ground_meat >= 0),
  add column coins integer not null default 0 check (coins >= 0),
  -- When each of the three boars is back in the woods after being hunted (null: it's there now).
  add column boars_back_at timestamptz[] not null default array[null, null, null]::timestamptz[];

-- Inventory rules, shared by every function that adds to it.
create or replace function public.inv_slots() returns integer language sql immutable as $$ select 20 $$;
create or replace function public.inv_stack() returns integer language sql immutable as $$ select 99 $$;
create or replace function public.meat_price() returns integer language sql immutable as $$ select 5 $$;
create or replace function public.boar_respawn() returns interval language sql immutable as $$ select interval '2 minutes' $$;

-- Slots a pile of n items takes: one per started stack of 99.
create or replace function public.slots_for(n integer) returns integer language sql immutable as $$
  select (n + public.inv_stack() - 1) / public.inv_stack()
$$;
create or replace function public.slots_used(wood integer, meat integer) returns integer language sql immutable as $$
  select public.slots_for(wood) + public.slots_for(meat)
$$;

-- The base as the app sees it, now with the inventory, coins and the boars.
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
    updated_at = b.updated_at
  where owner = b.owner;
  return public.base_json(b);
end $$;

-- Chopping now needs room in the inventory for the wood.
create or replace function public.chop() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b public.bases := public.my_base();
begin
  if b.last_chop_at is not null then
    b.chop_budget := least(5, b.chop_budget + extract(epoch from now() - b.last_chop_at) / 0.42);
  end if;
  if b.chop_budget < 1 then
    raise exception 'Chopping too fast' using errcode = 'P0001';
  end if;
  if public.slots_used(b.wood + 1, b.meat) > public.inv_slots() then
    raise exception 'Inventory full' using errcode = 'P0001';
  end if;
  b.chop_budget := b.chop_budget - 1;
  b.wood := b.wood + 1;
  b.last_chop_at := now();
  return public.save_base(b);
end $$;

-- The end of a battle with boar `idx` (0 to 2). 'won' drops 1 meat on the ground, 2 when the
-- finishing hit was Perfect, and the boar is gone for two minutes. Battle results are still trusted
-- from the app; the respawn timer stops a script from hunting faster than the woods allow.
create or replace function public.boar_hunt(idx integer, result text, perfect boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b public.bases := public.my_base();
begin
  if idx < 0 or idx > 2 then
    raise exception 'No such boar' using errcode = 'P0001';
  end if;
  if b.boars_back_at[idx + 1] is not null and now() < b.boars_back_at[idx + 1] then
    raise exception 'That boar is not back yet' using errcode = 'P0001';
  end if;
  if result <> 'won' then
    raise exception 'Unknown result %', result using errcode = 'P0001';
  end if;
  b.boars_back_at[idx + 1] := now() + public.boar_respawn();
  b.ground_meat := b.ground_meat + case when perfect then 2 else 1 end;
  return public.save_base(b);
end $$;

-- Tapping meat on the ground: it goes into the inventory if there's room for it.
create or replace function public.pick_up_meat(n integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b public.bases := public.my_base();
begin
  if n < 1 or n > b.ground_meat then
    raise exception 'No meat there' using errcode = 'P0001';
  end if;
  if public.slots_used(b.wood, b.meat + n) > public.inv_slots() then
    raise exception 'Inventory full' using errcode = 'P0001';
  end if;
  b.ground_meat := b.ground_meat - n;
  b.meat := b.meat + n;
  return public.save_base(b);
end $$;

-- Selling every boar meat you carry to the butcher, once his shop is open.
create or replace function public.sell_meat() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b public.bases := public.my_base();
begin
  if b.butcher <> 'shop' then
    raise exception 'The butcher is not buying yet' using errcode = 'P0001';
  end if;
  if b.meat < 1 then
    raise exception 'No meat to sell' using errcode = 'P0001';
  end if;
  b.coins := b.coins + b.meat * public.meat_price();
  b.meat := 0;
  return public.save_base(b);
end $$;

revoke execute on function public.boar_hunt(integer, text, boolean), public.pick_up_meat(integer), public.sell_meat() from public, anon;
grant execute on function public.boar_hunt(integer, text, boolean), public.pick_up_meat(integer), public.sell_meat() to authenticated;
