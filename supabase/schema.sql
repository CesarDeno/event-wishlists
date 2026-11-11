-- Modelo de datos y políticas RLS para Event Wishlists

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  slug text not null unique,
  title text not null,
  budget numeric,
  currency text not null default 'MXN',
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
  created_at timestamptz not null default now()
);

create index if not exists items_list_id_idx on public.items(list_id);

alter table public.lists enable row level security;
alter table public.items enable row level security;

-- Lectura pública para visitantes en /l/:slug
create policy "Public read lists"
  on public.lists for select
  using (true);

create policy "Public read items"
  on public.items for select
  using (true);

-- Escritura restringida al dueño (auth.uid() = user_id)
create policy "Owner insert lists"
  on public.lists for insert
  with check (auth.uid() = user_id);

create policy "Owner update lists"
  on public.lists for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Owner delete lists"
  on public.lists for delete
  using (auth.uid() = user_id);

create policy "Owner insert items"
  on public.items for insert
  with check (auth.uid() = user_id);

create policy "Owner update items"
  on public.items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Owner delete items"
  on public.items for delete
  using (auth.uid() = user_id);

