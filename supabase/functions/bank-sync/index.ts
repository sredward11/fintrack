import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildRange, describeItemProblem, mapTransaction, type PluggyTransaction } from '../_shared/openfinance.ts';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
class SafeError extends Error { constructor(public status: number, message: string) { super(message); } }
let cached: { key: string; until: number } | null = null;
async function pluggy(path: string, key: string) {
  const response = await fetch(`https://api.pluggy.ai${path}`, {
    headers: { 'X-API-KEY': key, Accept: 'application/json' }, signal: AbortSignal.timeout(30000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new SafeError(502, `Pluggy respondeu HTTP ${response.status}.`);
  if (!body || typeof body !== 'object') throw new SafeError(502, 'Resposta inválida do Pluggy.');
  return body;
}
async function apiKey() {
  if (cached && cached.until > Date.now()) return cached.key;
  const clientId = Deno.env.get('PLUGGY_CLIENT_ID')?.trim();
  const clientSecret = Deno.env.get('PLUGGY_CLIENT_SECRET')?.trim();
  if (!clientId || !clientSecret) throw new SafeError(500, 'Segredos Pluggy ausentes.');
  const response = await fetch('https://api.pluggy.ai/auth', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }), signal: AbortSignal.timeout(20000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || typeof body?.apiKey !== 'string') throw new SafeError(502, 'Falha na autenticação do agregador.');
  cached = { key: body.apiKey, until: Date.now() + 105 * 60000 };
  return cached.key;
}
async function allTransactions(key: string, accountId: string, from: string, to: string) {
  let path = `/v2/transactions?accountId=${encodeURIComponent(accountId)}&dateFrom=${from}&dateTo=${to}`;
  const result: PluggyTransaction[] = [];
  for (let page = 0; page < 50 && path; page++) {
    const body = await pluggy(path, key);
    if (!Array.isArray(body.results)) throw new SafeError(502, 'Lista de transações inválida.');
    result.push(...body.results);
    path = typeof body.next === 'string' && body.next ? `/v2/transactions${body.next}` : '';
  }
  return result;
}
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Entre na sua conta.' }, 401);
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.item_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.item_id))
      throw new SafeError(400, 'Item ID inválido.');
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anon || !service) throw new SafeError(500, 'Configuração Supabase ausente.');
    const authClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: userError } = await authClient.auth.getUser(auth.slice(7));
    if (userError || !user) throw new SafeError(401, 'Sessão inválida ou expirada.');
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const key = await apiKey();
    const item = await pluggy(`/items/${encodeURIComponent(body.item_id)}`, key);
    if (item.clientUserId !== user.id) throw new SafeError(403, 'Esta conexão não pertence à sua conta.');
    const problem = describeItemProblem(String(item.status ?? ''), item.executionStatus ?? null);
    if (problem) throw new SafeError(problem.httpStatus, problem.message);
    const connectorName = typeof item.connector?.name === 'string' ? item.connector.name : 'Pluggy Bank';
    const { data: existing, error: existingError } = await admin.from('bank_connections')
      .select('id,user_id,last_synced_at').eq('pluggy_item_id', body.item_id).maybeSingle();
    if (existingError) throw existingError;
    if (existing && existing.user_id !== user.id) throw new SafeError(403, 'Conexão já vinculada a outra conta.');
    const { data: connection, error: connectionError } = await admin.from('bank_connections').upsert({
      ...(existing?.id ? { id: existing.id } : {}), user_id: user.id, pluggy_item_id: body.item_id,
      connector_name: connectorName, status: 'connected', error_message: null,
    }, { onConflict: 'pluggy_item_id' }).select('id,last_synced_at').single();
    if (connectionError) throw connectionError;
    const range = buildRange(connection.last_synced_at ?? existing?.last_synced_at ?? null, new Date());
    const accountsBody = await pluggy(`/accounts?itemId=${encodeURIComponent(body.item_id)}`, key);
    if (!Array.isArray(accountsBody.results)) throw new SafeError(502, 'Lista de contas inválida.');
    const { data: categories, error: categoriesError } = await admin.from('categories').select('id,name,type');
    if (categoriesError) throw categoriesError;
    const categoryMap = new Map((categories ?? []).map((c) => [`${c.type}:${c.name}`, c.id]));
    const rows: Record<string, unknown>[] = [];
    const skipped: Record<string, number> = {};
    for (const account of accountsBody.results) {
      if (typeof account?.id !== 'string' || !['BANK', 'CREDIT'].includes(account.type)) continue;
      const transactions = await allTransactions(key, account.id, range.from, range.to);
      for (const transaction of transactions) {
        const mapped = mapTransaction(transaction, account.type);
        if ('skip' in mapped) { skipped[mapped.skip] = (skipped[mapped.skip] ?? 0) + 1; continue; }
        const categoryId = categoryMap.get(`${mapped.row.type}:${mapped.row.categoryName}`)
          ?? categoryMap.get(`${mapped.row.type}:Outros`);
        if (!categoryId) { skipped.category_missing = (skipped.category_missing ?? 0) + 1; continue; }
        rows.push({ user_id: user.id, connection_id: connection.id, external_id: mapped.row.external_id,
          source: 'open_finance', account_name: String(account.marketingName ?? account.name ?? connectorName),
          category_id: categoryId, type: mapped.row.type, description: mapped.row.description,
          amount: mapped.row.amount, date: mapped.row.date });
      }
    }
    let imported = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const { data, error } = await admin.from('transactions').upsert(rows.slice(i, i + 200), {
        onConflict: 'user_id,external_id', ignoreDuplicates: true,
      }).select('id');
      if (error) throw error;
      imported += data?.length ?? 0;
    }
    const syncedAt = new Date().toISOString();
    const { error: updateError } = await admin.from('bank_connections')
      .update({ last_synced_at: syncedAt, status: 'connected', error_message: null }).eq('id', connection.id);
    if (updateError) throw updateError;
    return json({ connection_id: connection.id, imported, fetched: rows.length, skipped, synced_at: syncedAt });
  } catch (error) {
    const status = error instanceof SafeError ? error.status : 500;
    const message = error instanceof SafeError ? error.message : 'Falha ao sincronizar a conexão.';
    console.error(JSON.stringify({ event: 'bank_sync_failure', status, message }));
    return json({ error: message }, status);
  }
});
