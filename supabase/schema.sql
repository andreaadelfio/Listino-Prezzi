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

create or replace function public.sync_listino_selection_flags()
returns trigger
language plpgsql
as $$
begin
  new.selected := coalesce(new.selected, false);
  new.is_scratched := coalesce(new.is_scratched, false);

  if new.selected = false then
    new.is_scratched := false;
  end if;

  if new.quantity is null or new.quantity < 1 then
    new.quantity := 1;
  end if;

  return new;
end;
$$;

create table if not exists public.retailers (
  id bigint generated always as identity primary key,
  owner text not null default 'default',
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.listino_prezzi_raw (
  id bigint generated always as identity primary key,
  owner text not null default 'default',
  prodotto text not null,
  retailer_id bigint not null references public.retailers(id) on delete restrict,
  selected boolean not null default false,
  is_scratched boolean not null default false,
  quantity integer not null default 1,
  categoria text,
  prezzo text not null,
  prezzo_valore numeric(10, 2),
  prezzo_unita text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  constraint listino_prezzi_raw_quantity_check check (quantity >= 1),
  constraint listino_prezzi_raw_scratched_requires_selected check (not is_scratched or selected)
);

create unique index if not exists idx_retailers_owner_name_unique
on public.retailers(owner, name);

create index if not exists idx_listino_owner on public.listino_prezzi_raw(owner);
create index if not exists idx_listino_prodotto on public.listino_prezzi_raw(prodotto);
create index if not exists idx_listino_owner_prodotto on public.listino_prezzi_raw(owner, prodotto);
create index if not exists idx_listino_categoria on public.listino_prezzi_raw(categoria);
create index if not exists idx_listino_rivenditore on public.listino_prezzi_raw(retailer_id);

drop trigger if exists trg_rivenditores_updated_at on public.retailers;
create trigger trg_rivenditores_updated_at
before update on public.retailers
for each row execute function public.set_updated_at();

drop trigger if exists trg_listino_updated_at on public.listino_prezzi_raw;
create trigger trg_listino_updated_at
before update on public.listino_prezzi_raw
for each row execute function public.set_updated_at();

drop trigger if exists trg_listino_selection_flags on public.listino_prezzi_raw;
create trigger trg_listino_selection_flags
before insert or update on public.listino_prezzi_raw
for each row execute function public.sync_listino_selection_flags();

create or replace view public.listino_prezzi_raw_excel as
select
  l.id,
  l.owner,
  l.prodotto,
  l.selected,
  l.is_scratched,
  l.quantity,
  r.name as rivenditore,
  concat(l.prodotto, '-', r.name) as prod_riv,
  l.categoria,
  l.prezzo,
  l.prezzo_valore,
  l.prezzo_unita,
  l.created_at,
  l.updated_at
from public.listino_prezzi_raw l
join public.retailers r on r.id = l.retailer_id;

alter table public.retailers enable row level security;
alter table public.listino_prezzi_raw enable row level security;

drop policy if exists "public can read rivenditores" on public.retailers;
create policy "public can read rivenditores"
on public.retailers
for select
to anon, authenticated
using (true);

drop policy if exists "public can insert rivenditores" on public.retailers;
create policy "public can insert rivenditores"
on public.retailers
for insert
to anon, authenticated
with check (true);

drop policy if exists "public can update rivenditores" on public.retailers;
create policy "public can update rivenditores"
on public.retailers
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "public can delete rivenditores" on public.retailers;
create policy "public can delete rivenditores"
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
