-- FinTrack: migracao incremental. Execute uma vez no SQL Editor.
-- Nao recria categories/transactions nem remove lancamentos manuais.
begin;

create table public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pluggy_item_id text not null unique,
  connector_name text not null default 'Pluggy Bank',
  status text not null default 'connected',
  last_synced_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
alter table public.bank_connections enable row level security;
revoke all on public.bank_connections from anon, authenticated;
grant select on public.bank_connections to authenticated;
grant all on public.bank_connections to service_role;
create policy bank_connections_read_own on public.bank_connections
  for select to authenticated using ((select auth.uid()) = user_id);

alter table public.transactions
  add column source text not null default 'manual',
  add column connection_id uuid,
  add column external_id text,
  add column account_name text,
  add constraint transactions_source_check check (source in ('manual', 'open_finance')),
  add constraint transactions_origin_check check (
    (source = 'manual' and connection_id is null and external_id is null and account_name is null)
    or
    (source = 'open_finance' and connection_id is not null and external_id is not null and length(external_id) > 0)
  ),
  add constraint transactions_connection_owner_fk foreign key (connection_id, user_id)
    references public.bank_connections(id, user_id) on delete cascade,
  add constraint transactions_user_external_unique unique (user_id, external_id);
create index transactions_connection_idx on public.transactions(connection_id);

-- Restrictive policies combine with existing owner policies, rather than
-- accidentally opening another permissive path.
create policy transactions_manual_insert_only on public.transactions
  as restrictive for insert to authenticated
  with check (source = 'manual' and user_id = (select auth.uid()));
create policy transactions_manual_delete_only on public.transactions
  as restrictive for delete to authenticated
  using (source = 'manual' and user_id = (select auth.uid()));

-- Authenticated clients may change only the category of imported entries.
-- Server functions will use service_role AFTER verifying the authenticated
-- user and the owner of the Pluggy item. Never expose that key in the app.
create function public.fintrack_guard_transaction_update()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    if new.user_id is distinct from old.user_id
       or new.source is distinct from old.source
       or new.connection_id is distinct from old.connection_id
       or new.external_id is distinct from old.external_id
       or new.account_name is distinct from old.account_name then
      raise exception 'Origem e proprietario nao podem ser alterados pelo aplicativo.';
    end if;
    if old.source = 'open_finance' and
       (new.amount is distinct from old.amount
        or new.date is distinct from old.date
        or new.description is distinct from old.description
        or new.type is distinct from old.type
        or new.id is distinct from old.id
        or new.created_at is distinct from old.created_at) then
      raise exception 'Lancamento importado permite apenas recategorizacao.';
    end if;
  end if;
  return new;
end;
$$;
create trigger fintrack_guard_transaction_update
  before update on public.transactions
  for each row execute function public.fintrack_guard_transaction_update();
revoke all on function public.fintrack_guard_transaction_update() from public;
commit;
