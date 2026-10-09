-- Listino Prezzi: schema `listino` nel progetto Supabase di MyFinance.
--
-- Fino a ottobre 2026 queste tabelle stavano in `public` di un progetto Supabase a parte
-- (supabase/schema.sql, ora storico). Sono state spostate in uno schema dedicato del
-- progetto MyFinance, per tenerle separate dalle tabelle della finanza in vista
-- dell'unione dei due siti. Migrazione: supabase/migrate_to_myfinance.py.
--
-- Si puo' rieseguire: non tocca i dati.
-- Dopo la prima esecuzione: Project Settings -> API -> "Exposed schemas": aggiungi `listino`.
--
-- ATTENZIONE: le policy sono rimaste quelle di prima, aperte a `anon` (chiunque abbia la
-- chiave publishable del sito, che e' pubblico, puo' leggere e modificare). Da chiudere
-- con il login, insieme a quelle di MyFinance.

create schema if not exists listino;

-- ---------------------------------------------------------------- tabelle

create table if not exists listino.retailers (
  id bigint generated always as identity primary key,
  owner text not null default 'default',
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists listino.categories (
  id bigint generated always as identity primary key,
  owner text not null default 'default',
  name text not null,
  icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists listino.product_vocabulary (
  id bigint generated always as identity primary key,
  owner text not null default 'default',
  word text not null,
  usage_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  constraint product_vocabulary_usage_count_check check (usage_count >= 1)
);

create table if not exists listino.listino_prezzi_raw (
  id bigint generated always as identity primary key,
  owner text not null default 'default',
  prodotto text not null,
  retailer_id bigint not null references listino.retailers(id) on delete restrict,
  category_id bigint references listino.categories(id) on delete restrict,
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

create unique index if not exists idx_retailers_owner_name_unique on listino.retailers(owner, name);
create unique index if not exists idx_retailers_one_default_per_owner on listino.retailers(owner) where is_default;
create index if not exists idx_retailers_name on listino.retailers(name);
create index if not exists idx_retailers_owner_default_name on listino.retailers(owner, is_default desc, name);
create unique index if not exists idx_categories_owner_name_unique on listino.categories(owner, name);
create unique index if not exists idx_product_vocabulary_owner_word_unique on listino.product_vocabulary(owner, lower(word));
create index if not exists idx_product_vocabulary_owner_word on listino.product_vocabulary(owner, word);
create index if not exists idx_listino_owner on listino.listino_prezzi_raw(owner);
create index if not exists idx_listino_prodotto on listino.listino_prezzi_raw(prodotto);
create index if not exists idx_listino_owner_prodotto on listino.listino_prezzi_raw(owner, prodotto);
create index if not exists idx_listino_category_id on listino.listino_prezzi_raw(category_id);
create index if not exists idx_listino_retailer on listino.listino_prezzi_raw(retailer_id);
create index if not exists idx_listino_owner_created_at_desc on listino.listino_prezzi_raw(owner, created_at desc);

-- La migrazione inserisce i dati al posto della riga seguente: prima dei trigger, che
-- altrimenti conterebbero di nuovo le parole del vocabolario.
-- @@DATI@@

-- ---------------------------------------------------------------- funzioni e trigger

create or replace function listino.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function listino.sync_listino_selection_flags()
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

create or replace function listino.cleanup_orphan_retailers()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and old.retailer_id = new.retailer_id
     and old.owner = new.owner then
    return null;
  end if;

  -- Rimuove il vecchio Store se non è più referenziato da alcun prodotto
  if (tg_op = 'DELETE' or tg_op = 'UPDATE') then
    delete from listino.retailers r
    where r.id = old.retailer_id
      and r.owner = old.owner
      and not exists (
        select 1
        from listino.listino_prezzi_raw l
        where l.retailer_id = r.id
          and l.owner = r.owner
      );
  end if;

  return null;
end;
$$;

create or replace function listino.cleanup_orphan_categories()
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
    delete from listino.categories c
    where c.id = old.category_id
      and c.owner = old.owner
      and not exists (
        select 1
        from listino.listino_prezzi_raw l
        where l.category_id = c.id
          and l.owner = c.owner
      );
  end if;

  return null;
end;
$$;

create or replace function listino.sync_product_vocabulary_from_listino()
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
    insert into listino.product_vocabulary (owner, word, created_by)
    values (new.owner, token, new.created_by)
    on conflict (owner, lower(word))
    do update set
      usage_count = listino.product_vocabulary.usage_count + 1,
      updated_at = now();
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_retailers_updated_at on listino.retailers;
create trigger trg_retailers_updated_at
before update on listino.retailers
for each row execute function listino.set_updated_at();

drop trigger if exists trg_categories_updated_at on listino.categories;
create trigger trg_categories_updated_at
before update on listino.categories
for each row execute function listino.set_updated_at();

drop trigger if exists trg_product_vocabulary_updated_at on listino.product_vocabulary;
create trigger trg_product_vocabulary_updated_at
before update on listino.product_vocabulary
for each row execute function listino.set_updated_at();

drop trigger if exists trg_listino_updated_at on listino.listino_prezzi_raw;
create trigger trg_listino_updated_at
before update on listino.listino_prezzi_raw
for each row execute function listino.set_updated_at();

drop trigger if exists trg_listino_selection_flags on listino.listino_prezzi_raw;
create trigger trg_listino_selection_flags
before insert or update on listino.listino_prezzi_raw
for each row execute function listino.sync_listino_selection_flags();

drop trigger if exists trg_listino_sync_product_vocabulary on listino.listino_prezzi_raw;
create trigger trg_listino_sync_product_vocabulary
after insert or update on listino.listino_prezzi_raw
for each row execute function listino.sync_product_vocabulary_from_listino();

drop trigger if exists trg_cleanup_orphan_retailers on listino.listino_prezzi_raw;
create trigger trg_cleanup_orphan_retailers
after delete or update on listino.listino_prezzi_raw
for each row execute function listino.cleanup_orphan_retailers();

drop trigger if exists trg_cleanup_orphan_categories on listino.listino_prezzi_raw;
create trigger trg_cleanup_orphan_categories
after delete or update on listino.listino_prezzi_raw
for each row execute function listino.cleanup_orphan_categories();

-- ---------------------------------------------------------------- accesso (come prima)

alter table listino.retailers enable row level security;
alter table listino.categories enable row level security;
alter table listino.product_vocabulary enable row level security;
alter table listino.listino_prezzi_raw enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['retailers', 'categories', 'product_vocabulary', 'listino_prezzi_raw'] loop
    execute format('drop policy if exists "accesso pubblico" on listino.%I', t);
    execute format(
      'create policy "accesso pubblico" on listino.%I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end
$$;

grant usage on schema listino to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema listino to anon, authenticated;
grant all on all tables in schema listino to service_role;
grant usage, select on all sequences in schema listino to anon, authenticated, service_role;
