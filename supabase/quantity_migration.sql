alter table public.listino_prezzi_raw
add column if not exists quantity integer;

update public.listino_prezzi_raw
set quantity = 1
where quantity is null or quantity < 1;

alter table public.listino_prezzi_raw
alter column quantity set default 1;

alter table public.listino_prezzi_raw
alter column quantity set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'listino_prezzi_raw_quantity_check'
      and conrelid = 'public.listino_prezzi_raw'::regclass
  ) then
    alter table public.listino_prezzi_raw
    add constraint listino_prezzi_raw_quantity_check
    check (quantity >= 1);
  end if;
end
$$;
