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

create or replace function public.cleanup_orphan_retailers()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and old.retailer_id = new.retailer_id
     and old.owner = new.owner then
    return null;
  end if;

  -- Rimuove il vecchio rivenditore se non è più referenziato da alcun prodotto
  if (tg_op = 'DELETE' or tg_op = 'UPDATE') then
    delete from public.retailers r
    where r.id = old.retailer_id
      and r.owner = old.owner
      and not exists (
        select 1
        from public.listino_prezzi_raw l
        where l.retailer_id = r.id
          and l.owner = r.owner
      );
  end if;

  return null;
end;
$$;

create or replace function public.cleanup_orphan_categories()
returns trigger
language plpgsql
as $$
begin
  -- Ottimizzazione: se l'update non cambia la categoria o l'owner, non fare nulla
  if tg_op = 'UPDATE'
     and old.category_id is not distinct from new.category_id
     and old.owner = new.owner then
    return null;
  end if;

  -- Rimuove la vecchia categoria se non è più referenziata da alcun prodotto dello stesso owner
  if (tg_op = 'DELETE' or tg_op = 'UPDATE') and old.category_id is not null then
    delete from public.categories c
    where c.id = old.category_id
      and c.owner = old.owner
      and not exists (
        select 1
        from public.listino_prezzi_raw l
        where l.category_id = c.id
          and l.owner = c.owner
      );
  end if;

  return null;
end;
$$;

create table if not exists public.retailers (
  id bigint generated always as identity primary key,
  owner text not null default 'default',
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.retailers
add column if not exists is_default boolean not null default false;

update public.retailers
set is_default = true
where lower(name) = 'lidl';

create table if not exists public.categories (
  id bigint generated always as identity primary key,
  owner text not null default 'default',
  name text not null,
  icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.categories
add column if not exists icon text;

create table if not exists public.product_vocabulary (
  id bigint generated always as identity primary key,
  owner text not null default 'default',
  word text not null,
  usage_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  constraint product_vocabulary_usage_count_check check (usage_count >= 1)
);

create table if not exists public.listino_prezzi_raw (
  id bigint generated always as identity primary key,
  owner text not null default 'default',
  prodotto text not null,
  retailer_id bigint not null references public.retailers(id) on delete restrict,
  category_id bigint references public.categories(id) on delete restrict,
  selected boolean not null default false,
  is_scratched boolean not null default false,
  quantity integer not null default 1,
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

create unique index if not exists idx_retailers_one_default_per_owner
on public.retailers(owner)
where is_default;

create index if not exists idx_retailers_name
on public.retailers(name);

create index if not exists idx_retailers_owner_default_name
on public.retailers(owner, is_default desc, name);

create unique index if not exists idx_categories_owner_name_unique
on public.categories(owner, name);

create unique index if not exists idx_product_vocabulary_owner_word_unique
on public.product_vocabulary(owner, lower(word));

create index if not exists idx_product_vocabulary_owner_word
on public.product_vocabulary(owner, word);

alter table public.listino_prezzi_raw
add column if not exists category_id bigint;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listino_prezzi_raw'
      and column_name = 'categoria'
  ) then
    insert into public.categories (owner, name)
    select distinct l.owner, l.categoria
    from public.listino_prezzi_raw l
    where l.categoria is not null
      and btrim(l.categoria) <> ''
    on conflict (owner, name) do nothing;

    update public.listino_prezzi_raw l
    set category_id = c.id
    from public.categories c
    where l.category_id is null
      and c.owner = l.owner
      and c.name = l.categoria;

    alter table public.listino_prezzi_raw
    drop column if exists categoria;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'listino_prezzi_raw_category_id_fkey'
  ) then
    alter table public.listino_prezzi_raw
    add constraint listino_prezzi_raw_category_id_fkey
    foreign key (category_id) references public.categories(id) on delete restrict;
  end if;
end
$$;

create index if not exists idx_listino_owner on public.listino_prezzi_raw(owner);
create index if not exists idx_listino_prodotto on public.listino_prezzi_raw(prodotto);
create index if not exists idx_listino_owner_prodotto on public.listino_prezzi_raw(owner, prodotto);
drop index if exists idx_listino_categoria;
drop index if exists idx_listino_rivenditore;
drop index if exists idx_listino_retailer;
create index if not exists idx_listino_category_id on public.listino_prezzi_raw(category_id);
create index if not exists idx_listino_retailer on public.listino_prezzi_raw(retailer_id);
create index if not exists idx_listino_owner_created_at_desc on public.listino_prezzi_raw(owner, created_at desc);

create or replace function public.sync_product_vocabulary_from_listino()
returns trigger
language plpgsql
as $$
declare
  token text;
begin
  if tg_op = 'UPDATE'
     and old.prodotto is not distinct from new.prodotto
     and old.owner = new.owner then
    return new;
  end if;

  for token in
    select distinct lower(btrim(value))
    from regexp_split_to_table(coalesce(new.prodotto, ''), '[^[:alpha:]]+') as value
    where btrim(value) <> ''
      and btrim(value) !~ '[0-9]'
      and char_length(btrim(value)) >= 5
  loop
    insert into public.product_vocabulary (owner, word, created_by)
    values (new.owner, token, new.created_by)
    on conflict (owner, lower(word))
    do update set
      usage_count = public.product_vocabulary.usage_count + 1,
      updated_at = now();
  end loop;

  return new;
end;
$$;

insert into public.product_vocabulary (owner, word, created_by)
select distinct
  l.owner,
  lower(btrim(token.value)) as word,
  l.created_by
from public.listino_prezzi_raw l
cross join regexp_split_to_table(coalesce(l.prodotto, ''), '[^[:alpha:]]+') as token(value)
where btrim(token.value) <> ''
  and btrim(token.value) !~ '[0-9]'
  and char_length(btrim(token.value)) >= 5
on conflict (owner, lower(word))
do nothing;

drop trigger if exists trg_retailers_updated_at on public.retailers;
drop trigger if exists trg_rivenditores_updated_at on public.retailers;
create trigger trg_retailers_updated_at
before update on public.retailers
for each row execute function public.set_updated_at();

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists trg_product_vocabulary_updated_at on public.product_vocabulary;
create trigger trg_product_vocabulary_updated_at
before update on public.product_vocabulary
for each row execute function public.set_updated_at();

drop trigger if exists trg_listino_updated_at on public.listino_prezzi_raw;
create trigger trg_listino_updated_at
before update on public.listino_prezzi_raw
for each row execute function public.set_updated_at();

drop trigger if exists trg_listino_selection_flags on public.listino_prezzi_raw;
create trigger trg_listino_selection_flags
before insert or update on public.listino_prezzi_raw
for each row execute function public.sync_listino_selection_flags();

drop trigger if exists trg_listino_sync_product_vocabulary on public.listino_prezzi_raw;
create trigger trg_listino_sync_product_vocabulary
after insert or update on public.listino_prezzi_raw
for each row execute function public.sync_product_vocabulary_from_listino();

drop trigger if exists trg_cleanup_orphan_retailers on public.listino_prezzi_raw;
create trigger trg_cleanup_orphan_retailers
after delete or update on public.listino_prezzi_raw
for each row execute function public.cleanup_orphan_retailers();

drop trigger if exists trg_cleanup_orphan_categories on public.listino_prezzi_raw;
create trigger trg_cleanup_orphan_categories
after delete or update on public.listino_prezzi_raw
for each row execute function public.cleanup_orphan_categories();

drop view if exists public.listino_prezzi_raw_excel;

alter table public.retailers enable row level security;
alter table public.categories enable row level security;
alter table public.product_vocabulary enable row level security;
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

drop policy if exists "public can read categories" on public.categories;
create policy "public can read categories"
on public.categories
for select
to anon, authenticated
using (true);

drop policy if exists "public can insert categories" on public.categories;
create policy "public can insert categories"
on public.categories
for insert
to anon, authenticated
with check (true);

drop policy if exists "public can update categories" on public.categories;
create policy "public can update categories"
on public.categories
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "public can delete categories" on public.categories;
create policy "public can delete categories"
on public.categories
for delete
to anon, authenticated
using (true);

drop policy if exists "public can read product vocabulary" on public.product_vocabulary;
create policy "public can read product vocabulary"
on public.product_vocabulary
for select
to anon, authenticated
using (true);

drop policy if exists "public can insert product vocabulary" on public.product_vocabulary;
create policy "public can insert product vocabulary"
on public.product_vocabulary
for insert
to anon, authenticated
with check (true);

drop policy if exists "public can update product vocabulary" on public.product_vocabulary;
create policy "public can update product vocabulary"
on public.product_vocabulary
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "public can delete product vocabulary" on public.product_vocabulary;
create policy "public can delete product vocabulary"
on public.product_vocabulary
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
