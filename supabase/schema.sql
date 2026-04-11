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
  quantity integer not null default 1 check (quantity >= 1),
  categoria text,
  prezzo text not null,
  prezzo_valore numeric(10, 2),
  prezzo_unita text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.listino_prezzi_raw
drop column if exists is_new;

alter table public.retailers
add column if not exists owner text;

alter table public.listino_prezzi_raw
add column if not exists owner text;

alter table public.listino_prezzi_raw
add column if not exists selected boolean;

alter table public.listino_prezzi_raw
add column if not exists is_scratched boolean;

alter table public.listino_prezzi_raw
add column if not exists quantity integer;

update public.retailers
set owner = 'default'
where owner is null or btrim(owner) = '';

update public.listino_prezzi_raw l
set owner = coalesce(nullif(btrim(r.owner), ''), 'default')
from public.retailers r
where l.retailer_id = r.id
  and (l.owner is null or btrim(l.owner) = '');

update public.listino_prezzi_raw
set owner = 'default'
where owner is null or btrim(owner) = '';

update public.listino_prezzi_raw
set selected = false
where selected is null;

update public.listino_prezzi_raw
set is_scratched = false
where is_scratched is null
   or selected = false;

update public.listino_prezzi_raw
set quantity = 1
where quantity is null or quantity < 1;

alter table public.retailers
alter column owner set default 'default';

alter table public.retailers
alter column owner set not null;

alter table public.listino_prezzi_raw
alter column owner set default 'default';

alter table public.listino_prezzi_raw
alter column owner set not null;

alter table public.listino_prezzi_raw
alter column selected set default false;

alter table public.listino_prezzi_raw
alter column selected set not null;

alter table public.listino_prezzi_raw
alter column is_scratched set default false;

alter table public.listino_prezzi_raw
alter column is_scratched set not null;

alter table public.listino_prezzi_raw
alter column quantity set default 1;

alter table public.listino_prezzi_raw
alter column quantity set not null;

alter table public.retailers
drop constraint if exists retailers_name_key;

create unique index if not exists idx_retailers_owner_name_unique
on public.retailers(owner, name);

drop index if exists idx_rivenditores_name;
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

  return new;
end;
$$;

drop trigger if exists trg_listino_selection_flags on public.listino_prezzi_raw;
create trigger trg_listino_selection_flags
before insert or update on public.listino_prezzi_raw
for each row execute function public.sync_listino_selection_flags();

alter table public.listino_prezzi_raw
drop constraint if exists listino_prezzi_raw_scratched_requires_selected;

alter table public.listino_prezzi_raw
add constraint listino_prezzi_raw_scratched_requires_selected
check (not is_scratched or selected);

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
