alter table public.listino_prezzi_raw
add column if not exists selected boolean;

alter table public.listino_prezzi_raw
add column if not exists is_scratched boolean;

update public.listino_prezzi_raw
set selected = false
where selected is null;

update public.listino_prezzi_raw
set is_scratched = false
where is_scratched is null
   or selected = false;

alter table public.listino_prezzi_raw
alter column selected set default false;

alter table public.listino_prezzi_raw
alter column selected set not null;

alter table public.listino_prezzi_raw
alter column is_scratched set default false;

alter table public.listino_prezzi_raw
alter column is_scratched set not null;

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
