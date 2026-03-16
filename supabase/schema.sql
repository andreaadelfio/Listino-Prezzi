create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.retailers (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.listino_prezzi_raw (
  id bigint generated always as identity primary key,
  prodotto text not null,
  retailer_id bigint not null references public.retailers(id) on delete restrict,
  categoria text,
  prezzo text not null,
  prezzo_valore numeric(10, 2),
  prezzo_unita text,
  is_new boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists idx_retailers_name on public.retailers(name);
create index if not exists idx_listino_prodotto on public.listino_prezzi_raw(prodotto);
create index if not exists idx_listino_categoria on public.listino_prezzi_raw(categoria);
create index if not exists idx_listino_retailer on public.listino_prezzi_raw(retailer_id);

drop trigger if exists trg_retailers_updated_at on public.retailers;
create trigger trg_retailers_updated_at
before update on public.retailers
for each row execute function public.set_updated_at();

drop trigger if exists trg_listino_updated_at on public.listino_prezzi_raw;
create trigger trg_listino_updated_at
before update on public.listino_prezzi_raw
for each row execute function public.set_updated_at();

create or replace view public.listino_prezzi_raw_excel as
select
  l.id,
  l.prodotto,
  r.name as rivenditore,
  concat(l.prodotto, '-', r.name) as prod_riv,
  l.categoria,
  l.prezzo,
  case when l.is_new then 'Y' else 'N' end as is_new,
  l.prezzo_valore,
  l.prezzo_unita,
  l.created_at,
  l.updated_at
from public.listino_prezzi_raw l
join public.retailers r on r.id = l.retailer_id;

alter table public.retailers enable row level security;
alter table public.listino_prezzi_raw enable row level security;

drop policy if exists "public can read retailers" on public.retailers;
create policy "public can read retailers"
on public.retailers
for select
to anon, authenticated
using (true);

drop policy if exists "public can insert retailers" on public.retailers;
create policy "public can insert retailers"
on public.retailers
for insert
to anon, authenticated
with check (true);

drop policy if exists "public can update retailers" on public.retailers;
create policy "public can update retailers"
on public.retailers
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "public can delete retailers" on public.retailers;
create policy "public can delete retailers"
on public.retailers
for delete
to anon, authenticated
using (true);

drop policy if exists "public can read listino" on public.listino_prezzi_raw;
create policy "public can read listino"
on public.listino_prezzi_raw
for select
to anon, authenticated
using (true);

drop policy if exists "public can insert listino" on public.listino_prezzi_raw;
create policy "public can insert listino"
on public.listino_prezzi_raw
for insert
to anon, authenticated
with check (true);

drop policy if exists "public can update listino" on public.listino_prezzi_raw;
create policy "public can update listino"
on public.listino_prezzi_raw
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "public can delete listino" on public.listino_prezzi_raw;
create policy "public can delete listino"
on public.listino_prezzi_raw
for delete
to anon, authenticated
using (true);
