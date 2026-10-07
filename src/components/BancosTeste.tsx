import { useState } from 'react';
import { Button, Text, View } from 'react-native';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import WidgetBanco from './WidgetBanco';
export default function BancosTeste() {
  const [token, setToken] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [itemId, setItemId] = useState('');
  const [mensagem, setMensagem] = useState('');
  async function abrir() {
    setOcupado(true); setMensagem('Preparando conexão de teste...');
    try {
      const { data: sessao, error: erroSessao } = await supabase.auth.getSession();
      if (erroSessao) throw erroSessao;
      if (!sessao.session) throw new Error('Entre na sua conta.');
      const { data, error } = await supabase.functions.invoke('bank-connect-token', {
        body: {}, headers: { Authorization: `Bearer ${sessao.session.access_token}` },
      });
      if (error instanceof FunctionsHttpError) {
        const body = await error.context.json().catch(() => null);
        throw new Error(`HTTP ${error.context.status}: ${typeof body?.error === 'string' ? body.error : 'Falha no servidor.'}`);
      }
      if (error) throw error;
      if (typeof data?.connect_token !== 'string' || !data.connect_token) throw new Error('Resposta sem token.');
      setToken(data.connect_token); setMensagem('Escolha somente Pluggy Bank nesta etapa.');
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Falha ao abrir conexão.');
    } finally { setOcupado(false); }
  }
  return <View style={{ width: '100%', maxWidth: 500, gap: 8, paddingVertical: 12 }}>
    <Text style={{ fontWeight: 'bold' }}>Conexão bancária de teste</Text>
    <Text>Use somente Pluggy Bank. Este marco cria uma conexão no Pluggy, mas não importa lançamentos nem salva a conexão no Supabase.</Text>
    <Button title={ocupado ? 'Preparando...' : 'Conectar Pluggy Bank'}
      disabled={ocupado || !!token || !!itemId} onPress={() => void abrir()} />
    {!!mensagem && <Text selectable>{mensagem}</Text>}
    {!!itemId && <Text selectable>Item ID: {itemId}</Text>}
    {token && <WidgetBanco token={token}
      onSuccess={(id) => { setItemId(id); setToken(null); setMensagem('Conexão criada. Guarde o Item ID para o próximo marco. Não reconecte desnecessariamente.'); }}
      onClose={() => setToken(null)}
      onError={(message) => { setMensagem(message); setToken(null); }} />}
  </View>;
}
