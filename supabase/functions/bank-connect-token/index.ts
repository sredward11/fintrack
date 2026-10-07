import { createClient } from 'npm:@supabase/supabase-js@2';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors,
    'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
class SafeError extends Error {
  constructor(public stage: string, public code: string, public httpStatus = 502,
    public upstreamStatus?: number) { super(`${stage}: ${code}`); }
}
let cached: { key: string; until: number } | null = null;
const allowedCodes = new Set(['CLIENT_KEYS_UNAUTHORIZED', 'CLIENT_DISABLED']);
async function postPluggy(stage: string, endpoint: string, body: unknown, key?: string) {
  let response: Response;
  try {
    response = await fetch(`https://api.pluggy.ai/${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json',
        ...(key ? { 'X-API-KEY': key } : {}) },
      body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    throw new SafeError(stage, name === 'TimeoutError' || name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR');
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const code = typeof result?.codeDescription === 'string' && allowedCodes.has(result.codeDescription)
      ? result.codeDescription : 'UPSTREAM_HTTP_ERROR';
    throw new SafeError(stage, code, 502, response.status);
  }
  if (!result || typeof result !== 'object') throw new SafeError(stage, 'INVALID_JSON');
  return result;
}
async function apiKey() {
  if (cached && cached.until > Date.now()) return cached.key;
  const clientId = Deno.env.get('PLUGGY_CLIENT_ID')?.trim();
  const clientSecret = Deno.env.get('PLUGGY_CLIENT_SECRET')?.trim();
  if (!clientId || !clientSecret) throw new SafeError('config', 'MISSING_PLUGGY_SECRETS', 500);
  const result = await postPluggy('pluggy_auth', 'auth', { clientId, clientSecret });
  if (typeof result.apiKey !== 'string' || !result.apiKey) throw new SafeError('pluggy_auth', 'MISSING_API_KEY');
  cached = { key: result.apiKey, until: Date.now() + 105 * 60000 };
  return cached.key;
}
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const header = req.headers.get('Authorization') ?? '';
  if (!header.startsWith('Bearer ')) return json({ error: 'Entre na sua conta.' }, 401);
  const requestId = crypto.randomUUID();
  let stage = 'supabase_auth';
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !anon) throw new SafeError('config', 'MISSING_SUPABASE_CONFIG', 500);
    const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error } = await client.auth.getUser(header.slice(7));
    if (error || !user) return json({ error: 'Sessao invalida ou expirada.' }, 401);
    stage = 'pluggy_auth';
    const key = await apiKey();
    stage = 'connect_token';
    const result = await postPluggy(stage, 'connect_token', { options: { clientUserId: user.id } }, key);
    if (typeof result.accessToken !== 'string' || !result.accessToken)
      throw new SafeError(stage, 'MISSING_CONNECT_TOKEN');
    return json({ connect_token: result.accessToken });
  } catch (error) {
    const safe = error instanceof SafeError ? error : new SafeError(stage, 'UNEXPECTED_ERROR');
    // Only controlled codes and HTTP status: never raw errors, headers, bodies or secrets.
    console.error(JSON.stringify({ event: 'bank_connect_token_failure', requestId,
      stage: safe.stage, code: safe.code, upstreamStatus: safe.upstreamStatus ?? null }));
    return json({ error: `Falha em ${safe.stage}: ${safe.code}${safe.upstreamStatus ? ` (Pluggy HTTP ${safe.upstreamStatus})` : ''}`,
      diagnostic_id: requestId }, safe.httpStatus);
  }
});
