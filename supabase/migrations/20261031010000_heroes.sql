-- Each player's hero, made once on the character creation screen: a name, a class, and a look.
--
-- Like the base, the app never writes this table. It reads it with get_hero() and makes the hero
-- with create_hero(), which checks every field on the server. Apply it after the save_base migration
-- (`supabase db push`, or paste it into the SQL editor).

create table public.heroes (
  owner uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 12),
  class text not null check (class in ('warrior', 'mage')),
  sex text not null check (sex in ('male', 'female')),
  -- Indexes into the app's lists (src/sprites/hero.ts): SKIN_TONES, HAIR_STYLES, HAIR_COLORS.
  skin smallint not null check (skin between 0 and 3),
  hair smallint not null check (hair between 0 and 3),
  hair_color smallint not null check (hair_color between 0 and 4),
  created_at timestamptz not null default now()
);

alter table public.heroes enable row level security;

-- Players can read their own hero. Only create_hero() writes.
create policy "Read your own hero" on public.heroes for select using (owner = auth.uid());

create or replace function public.hero_json(h public.heroes) returns jsonb language sql stable as $$
  select case when h.owner is null then null else jsonb_build_object(
    'name', h.name,
    'class', h.class,
    'sex', h.sex,
    'skin', h.skin,
    'hair', h.hair,
    'hair_color', h.hair_color
  ) end
$$;

-- The caller's hero, or null if they haven't made one yet.
create or replace function public.get_hero() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  h public.heroes;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into h from public.heroes where owner = me;
  return public.hero_json(h);
end $$;

-- Makes the caller's hero. A player has one hero; asking again is refused.
create or replace function public.create_hero(name text, class text, sex text, skin integer, hair integer, hair_color integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  clean text := btrim(regexp_replace(coalesce(name, ''), '\s+', ' ', 'g'));
  h public.heroes;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  -- Letters (any language), digits, spaces, apostrophes and hyphens; 1 to 12 characters.
  if clean !~ '^[[:alpha:][:digit:]'' -]{1,12}$' then
    raise exception 'Names are 1 to 12 letters, numbers, spaces, apostrophes or hyphens' using errcode = 'P0001';
  end if;
  insert into public.heroes (owner, name, class, sex, skin, hair, hair_color)
    values (me, clean, create_hero.class, create_hero.sex, create_hero.skin, create_hero.hair, create_hero.hair_color)
    on conflict (owner) do nothing
    returning * into h;
  if h.owner is null then
    raise exception 'You already have a hero' using errcode = 'P0001';
  end if;
  return public.hero_json(h);
end $$;

revoke execute on function public.hero_json(public.heroes) from public, anon, authenticated;
revoke execute on function public.get_hero(), public.create_hero(text, text, text, integer, integer, integer) from public, anon;
grant execute on function public.get_hero(), public.create_hero(text, text, text, integer, integer, integer) to authenticated;
