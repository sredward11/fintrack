import { createClient } from 'npm:@supabase/supabase-js@2';
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
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Entre na sua conta.' }, 401);
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.connection_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.connection_id))
      throw new SafeError(400, 'Conexão inválida.');
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anon || !service) throw new SafeError(500, 'Configuração Supabase ausente.');
    const authClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: userError } = await authClient.auth.getUser(auth.slice(7));
    if (userError || !user) throw new SafeError(401, 'Sessão inválida ou expirada.');
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: connection, error } = await admin.from('bank_connections')
      .select('id,user_id,pluggy_item_id').eq('id', body.connection_id).eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    if (!connection) throw new SafeError(404, 'Conexão não encontrada para esta conta.');
    const response = await fetch(`https://api.pluggy.ai/items/${encodeURIComponent(connection.pluggy_item_id)}`, {
      method: 'DELETE', headers: { 'X-API-KEY': await apiKey() }, signal: AbortSignal.timeout(20000),
    });
    if (!response.ok && response.status !== 404)
      throw new SafeError(502, `Não foi possível revogar no Pluggy (HTTP ${response.status}).`);
    // Delete locally only after remote revocation (or confirmed already absent).
    const { error: deleteError } = await admin.from('bank_connections')
      .delete().eq('id', connection.id).eq('user_id', user.id);
    if (deleteError) throw deleteError;
    return json({ ok: true });
  } catch (error) {
    const status = error instanceof SafeError ? error.status : 500;
    const message = error instanceof SafeError ? error.message : 'Falha ao desconectar o banco.';
    console.error(JSON.stringify({ event: 'bank_disconnect_failure', status, message }));
    return json({ error: message }, status);
  }
});
