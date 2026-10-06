create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('income', 'expense')),
  icon text not null,
  color text not null
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id),
  type text not null check (type in ('income', 'expense')),
  description text not null check (char_length(description) between 2 and 80),
  amount numeric(12, 2) not null check (amount > 0),
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create index transactions_user_date_idx
  on public.transactions (user_id, date desc);

alter table public.categories enable row level security;
alter table public.transactions enable row level security;

create policy "Categorias: leitura para usuários logados"
  on public.categories for select to authenticated
  using (true);

create policy "Transações: ler as próprias"
  on public.transactions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Transações: criar as próprias"
  on public.transactions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Transações: editar as próprias"
  on public.transactions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Transações: excluir as próprias"
  on public.transactions for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.categories to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;

insert into public.categories (name, type, icon, color) values
  ('Alimentação', 'expense', 'restaurant', '#F97316'),
  ('Transporte', 'expense', 'bus', '#3B82F6'),
  ('Moradia', 'expense', 'home', '#8B5CF6'),
  ('Saúde', 'expense', 'medkit', '#EF4444'),
  ('Lazer', 'expense', 'game-controller', '#EC4899'),
  ('Educação', 'expense', 'school', '#0EA5E9'),
  ('Compras', 'expense', 'cart', '#F59E0B'),
  ('Contas', 'expense', 'receipt', '#64748B'),
  ('Outros', 'expense', 'ellipsis-horizontal', '#94A3B8'),
  ('Salário', 'income', 'cash', '#16A34A'),
  ('Freelance', 'income', 'briefcase', '#0D9488'),
  ('Investimentos', 'income', 'trending-up', '#65A30D'),
  ('Presentes', 'income', 'gift', '#DB2777'),
  ('Outros', 'income', 'ellipsis-horizontal', '#94A3B8');