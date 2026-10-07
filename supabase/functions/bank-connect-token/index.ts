import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
let cached: { key: string; until: number } | null = null;
async function apiKey() {
  if (cached && cached.until > Date.now()) return cached.key;
  const clientId = Deno.env.get('PLUGGY_CLIENT_ID');
  const clientSecret = Deno.env.get('PLUGGY_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('CONFIG');
  const response = await fetch('https://api.pluggy.ai/auth', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }), signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('PLUGGY_AUTH');
  const body = await response.json();
  if (typeof body.apiKey !== 'string' || !body.apiKey) throw new Error('PLUGGY_AUTH');
  cached = { key: body.apiKey, until: Date.now() + 105 * 60000 };
  return cached.key;
}
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const header = req.headers.get('Authorization') ?? '';
  if (!header.startsWith('Bearer ')) return json({ error: 'Entre na sua conta.' }, 401);
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !anon) return json({ error: 'Servidor sem configuracao Supabase.' }, 500);
    const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error } = await client.auth.getUser(header.slice(7));
    if (error || !user) return json({ error: 'Sessao invalida ou expirada.' }, 401);
    // No user identifier or item identifier is accepted from the caller.
    const key = await apiKey();
    const response = await fetch('https://api.pluggy.ai/connect_token', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': key },
      body: JSON.stringify({ options: { clientUserId: user.id } }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return json({ error: 'Nao foi possivel gerar o token de conexao.' }, 502);
    const body = await response.json();
    if (typeof body.accessToken !== 'string' || !body.accessToken) return json({ error: 'Resposta invalida do agregador.' }, 502);
    return json({ connect_token: body.accessToken });
  } catch (error) {
    const kind = error instanceof Error ? error.message : '';
    return json({ error: kind === 'CONFIG' ? 'Configure os segredos Pluggy no servidor.' : 'Falha ao preparar conexao bancaria.' }, kind === 'CONFIG' ? 500 : 502);
  }
});
