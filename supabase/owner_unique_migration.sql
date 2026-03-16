alter table public.retailers
add column if not exists owner text;

alter table public.listino_prezzi_raw
add column if not exists owner text;

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

alter table public.retailers
alter column owner set default 'default';

alter table public.retailers
alter column owner set not null;

alter table public.listino_prezzi_raw
alter column owner set default 'default';

alter table public.listino_prezzi_raw
alter column owner set not null;

alter table public.retailers
drop constraint if exists retailers_name_key;

create unique index if not exists idx_retailers_owner_name_unique
on public.retailers(owner, name);

drop index if exists idx_rivenditores_name;
create index if not exists idx_listino_owner on public.listino_prezzi_raw(owner);
create index if not exists idx_listino_owner_prodotto on public.listino_prezzi_raw(owner, prodotto);
