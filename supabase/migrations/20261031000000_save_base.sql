-- Saves each player's base: wood, the four Shroomies, and how far they are with the old butcher.
--
-- The app never writes this table. It reads and changes it only through the functions below, which
-- run as the database owner, act on the signed-in player's own row, and check every rule (enough
-- wood, the right step of the story) on the server. The rebuild timer runs on the server's clock.
--
-- Apply it with the Supabase CLI (`supabase db push`) or paste it into the SQL editor.

create table public.bases (
  owner uuid primary key references auth.users (id) on delete cascade,
  wood integer not null default 0 check (wood >= 0),
  -- One status per Shroomie, in map order: 'wild', 'gone' (beaten) or 'critter' (tamed).
  shroomies text[] not null default array['wild', 'wild', 'wild', 'wild'],
  -- The butcher's story: 'hostile', 'spared' (beaten, offering the job), 'quest' (gathering wood),
  -- 'building' (rebuilding since build_started_at) or 'shop' (finished, and he's shown you round).
  butcher text not null default 'hostile' check (butcher in ('hostile', 'spared', 'quest', 'building', 'shop')),
  build_started_at timestamptz,
  -- Chopping budget: refills at one swing per 0.42 s (the game's swing time), holding up to 5, so
  -- a burst of queued swings goes through but a script can't mint wood faster than a player.
  chop_budget real not null default 5,
  last_chop_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bases enable row level security;

-- Players can read their own base. There are no insert, update or delete policies: only the
-- functions below change it.
create policy "Read your own base" on public.bases for select using (owner = auth.uid());

-- How long the butcher takes to rebuild, and how much wood he needs.
create or replace function public.hut_build_interval() returns interval language sql immutable as $$ select interval '10 minutes' $$;
create or replace function public.hut_wood() returns integer language sql immutable as $$ select 10 $$;

-- The base as the app sees it, plus the server's clock so the app can show the timer correctly.
create or replace function public.base_json(b public.bases) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'wood', b.wood,
    'shroomies', to_jsonb(b.shroomies),
    'butcher', b.butcher,
    'build_started_at', b.build_started_at,
    'build_done', b.butcher = 'building' and now() >= b.build_started_at + public.hut_build_interval(),
    'server_now', now()
  )
$$;

-- Locks and returns the caller's base, creating it on first use.
create or replace function public.my_base() returns public.bases
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  b public.bases;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  insert into public.bases (owner) values (me) on conflict (owner) do nothing;
  select * into b from public.bases where owner = me for update;
  return b;
end $$;

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
    updated_at = b.updated_at
  where owner = b.owner;
  return public.base_json(b);
end $$;

-- ---------- What the app calls ----------

create or replace function public.get_base() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return public.base_json(public.my_base());
end $$;

-- One swing at a tree: +1 wood, paid from the chopping budget.
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
  b.chop_budget := b.chop_budget - 1;
  b.wood := b.wood + 1;
  b.last_chop_at := now();
  return public.save_base(b);
end $$;

-- The end of a battle with Shroomie `idx` (0 to 3): 'won' (+3 wood) or 'tamed' (it becomes a critter).
create or replace function public.shroomie_battle(idx integer, result text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b public.bases := public.my_base();
begin
  if idx < 0 or idx > 3 or b.shroomies[idx + 1] <> 'wild' then
    raise exception 'That Shroomie is not wild' using errcode = 'P0001';
  end if;
  if result = 'won' then
    b.shroomies[idx + 1] := 'gone';
    b.wood := b.wood + 3;
  elsif result = 'tamed' then
    b.shroomies[idx + 1] := 'critter';
  else
    raise exception 'Unknown result %', result using errcode = 'P0001';
  end if;
  return public.save_base(b);
end $$;

-- The prototype's RESET button: once no Shroomie is wild, they all come back and wood goes to 0.
-- Critters stay critters, and the butcher's story is kept.
create or replace function public.reset_base() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b public.bases := public.my_base();
begin
  if 'wild' = any (b.shroomies) then
    raise exception 'Clear the base first' using errcode = 'P0001';
  end if;
  select array_agg(case when s = 'critter' then 'critter' else 'wild' end order by i)
    into b.shroomies from unnest(b.shroomies) with ordinality as t (s, i);
  b.wood := 0;
  return public.save_base(b);
end $$;

-- Each step of the butcher's story only moves forward from the step before it.
create or replace function public.butcher_step(step text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b public.bases := public.my_base();
begin
  if step = 'beaten' and b.butcher = 'hostile' then
    b.butcher := 'spared';
  elsif step = 'accept' and b.butcher = 'spared' then
    b.butcher := 'quest';
  elsif step = 'handin' and b.butcher = 'quest' then
    if b.wood < public.hut_wood() then
      raise exception 'Not enough wood' using errcode = 'P0001';
    end if;
    b.wood := b.wood - public.hut_wood();
    b.butcher := 'building';
    b.build_started_at := now();
  elsif step = 'opened' and b.butcher = 'building' and now() >= b.build_started_at + public.hut_build_interval() then
    b.butcher := 'shop';
  else
    raise exception 'The butcher is not ready for "%"', step using errcode = 'P0001';
  end if;
  return public.save_base(b);
end $$;

-- Only signed-in players may call the app functions; the helpers stay private.
revoke execute on function public.my_base(), public.save_base(public.bases), public.base_json(public.bases) from public, anon, authenticated;
revoke execute on function public.get_base(), public.chop(), public.shroomie_battle(integer, text), public.reset_base(), public.butcher_step(text) from public, anon;
grant execute on function public.get_base(), public.chop(), public.shroomie_battle(integer, text), public.reset_base(), public.butcher_step(text) to authenticated;
