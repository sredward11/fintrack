import { useState } from 'react';
import { Button, Text, View } from 'react-native';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export default function TesteTokenBancario() {
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState('');
  async function testar() {
    setOcupado(true);
    setMensagem('Validando sessao e geracao do token...');
    try {
      const { data: sessao, error: erroSessao } = await supabase.auth.getSession();
      if (erroSessao) throw erroSessao;
      if (!sessao.session) throw new Error('Entre na sua conta antes de testar.');
      const { data, error } = await supabase.functions.invoke('bank-connect-token', {
        body: {},
        headers: { Authorization: `Bearer ${sessao.session.access_token}` },
      });
      if (error instanceof FunctionsHttpError) {
        const resposta = await error.context.json().catch(() => null);
        const detalhe = typeof resposta?.error === 'string' ? resposta.error
          : typeof resposta?.message === 'string' ? resposta.message : 'Erro HTTP na funcao.';
        throw new Error(`HTTP ${error.context.status}: ${detalhe}`);
      }
      if (error) throw error;
      if (typeof data?.connect_token !== 'string' || !data.connect_token) {
        throw new Error('A funcao respondeu sem um token valido.');
      }
      // Never display, log, persist or copy the token.
      setMensagem('Token gerado com sucesso. Autenticacao e chamada ao Pluggy validadas.');
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Falha inesperada no teste.');
    } finally { setOcupado(false); }
  }
  return <View style={{ width: '100%', maxWidth: 500, gap: 8, paddingVertical: 12 }}>
    <Button title={ocupado ? 'Testando...' : 'Testar conexao com Pluggy'}
      disabled={ocupado} onPress={() => void testar()} />
    {!!mensagem && <Text selectable>{mensagem}</Text>}
  </View>;
}
