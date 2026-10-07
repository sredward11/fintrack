-- Apenas leitura: execute depois da migracao.
select source, count(*) as quantidade
from public.transactions group by source;
select relname as tabela, relrowsecurity as rls_ativo
from pg_class where oid in ('public.transactions'::regclass, 'public.bank_connections'::regclass);
select count(*) as conexoes from public.bank_connections;
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'transactions'
and column_name in ('source','connection_id','external_id','account_name')
order by column_name;
