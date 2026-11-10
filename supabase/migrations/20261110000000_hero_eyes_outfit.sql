-- Two more choices on the character creation screen: eye color and clothing color.
--
-- Apply it after the heroes migration (`supabase db push`, or paste it into the SQL editor). Heroes
-- made before this keep ink eyes and their class's own cloth color. It is safe to run twice.

alter table public.heroes
  -- Indexes into the app's lists (src/sprites/hero.ts): EYE_COLORS and OUTFIT_COLORS.
  add column if not exists eye_color smallint not null default 0 check (eye_color between 0 and 5),
  add column if not exists outfit_color smallint check (outfit_color between 0 and 5);

-- Each class starts in its own dye: sky (0) for the warrior, lavender (1) for the mage.
update public.heroes set outfit_color = case class when 'mage' then 1 else 0 end where outfit_color is null;
alter table public.heroes alter column outfit_color set not null;

create or replace function public.hero_json(h public.heroes) returns jsonb language sql stable as $$
  select case when h.owner is null then null else jsonb_build_object(
    'name', h.name,
    'class', h.class,
    'sex', h.sex,
    'skin', h.skin,
    'hair', h.hair,
    'hair_color', h.hair_color,
    'eye_color', h.eye_color,
    'outfit_color', h.outfit_color
  ) end
$$;

-- create_hero() gains the two choices. The first version is dropped so there is only one.
drop function if exists public.create_hero(text, text, text, integer, integer, integer);

create or replace function public.create_hero(name text, class text, sex text, skin integer, hair integer, hair_color integer, eye_color integer, outfit_color integer) returns jsonb
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
  insert into public.heroes (owner, name, class, sex, skin, hair, hair_color, eye_color, outfit_color)
    values (me, clean, create_hero.class, create_hero.sex, create_hero.skin, create_hero.hair, create_hero.hair_color, create_hero.eye_color, create_hero.outfit_color)
    on conflict (owner) do nothing
    returning * into h;
  if h.owner is null then
    raise exception 'You already have a hero' using errcode = 'P0001';
  end if;
  return public.hero_json(h);
end $$;

revoke execute on function public.hero_json(public.heroes) from public, anon, authenticated;
revoke execute on function public.create_hero(text, text, text, integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.create_hero(text, text, text, integer, integer, integer, integer, integer) to authenticated;

notify pgrst, 'reload schema';
