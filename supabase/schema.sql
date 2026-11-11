-- Modelo de datos y políticas RLS para Event Wishlists

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  slug text not null unique,
  title text not null,
  budget numeric,
  currency text not null default 'MXN',
  description text,
  event_date date,
  accent_color text,
  emoji text,
  created_at timestamptz not null default now(),
  constraint lists_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  title text not null,
  url text not null,
  price numeric,
  note text,
  image_url text,
  is_favorite boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Migración idempotente para proyectos que ya ejecutaron el esquema inicial
alter table public.lists add column if not exists description text;
alter table public.lists add column if not exists event_date date;
alter table public.lists add column if not exists accent_color text;
alter table public.lists add column if not exists emoji text;

alter table public.items add column if not exists is_favorite boolean not null default false;
alter table public.items add column if not exists sort_order integer not null default 0;

create index if not exists items_list_id_idx on public.items(list_id);

alter table public.lists enable row level security;
alter table public.items enable row level security;

-- Lectura pública para visitantes en /l/:slug
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'lists' and policyname = 'Public read lists'
  ) then
    create policy "Public read lists" on public.lists for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'items' and policyname = 'Public read items'
  ) then
    create policy "Public read items" on public.items for select using (true);
  end if;

  -- Escritura restringida al dueño (auth.uid() = user_id)
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'lists' and policyname = 'Owner insert lists'
  ) then
    create policy "Owner insert lists" on public.lists for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'lists' and policyname = 'Owner update lists'
  ) then
    create policy "Owner update lists" on public.lists for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'lists' and policyname = 'Owner delete lists'
  ) then
    create policy "Owner delete lists" on public.lists for delete using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'items' and policyname = 'Owner insert items'
  ) then
    create policy "Owner insert items" on public.items for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'items' and policyname = 'Owner update items'
  ) then
    create policy "Owner update items" on public.items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'items' and policyname = 'Owner delete items'
  ) then
    create policy "Owner delete items" on public.items for delete using (auth.uid() = user_id);
  end if;
end $$;
