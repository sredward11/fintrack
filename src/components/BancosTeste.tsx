import { useEffect, useState } from 'react';
import { Alert, Button, Platform, Text, TextInput, View } from 'react-native';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import WidgetBanco from './WidgetBanco';
type Connection = { id: string; connector_name: string; pluggy_item_id: string; last_synced_at: string | null };
export default function BancosTeste() {
  const [token, setToken] = useState<string | null>(null);
  const [itemId, setItemId] = useState('');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function loadConnections() {
    const { data, error } = await supabase.from('bank_connections')
      .select('id,connector_name,pluggy_item_id,last_synced_at').order('created_at');
    if (error) throw error;
    setConnections((data ?? []) as Connection[]);
  }
  useEffect(() => { void loadConnections().catch(() => setMessage('Não foi possível listar conexões.')); }, []);
  async function invoke(name: string, body: object) {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error('Entre na sua conta.');
    const result = await supabase.functions.invoke(name, {
      body, headers: { Authorization: `Bearer ${session.session.access_token}` },
    });
    if (result.error instanceof FunctionsHttpError) {
      const detail = await result.error.context.json().catch(() => null);
      throw new Error(typeof detail?.error === 'string' ? detail.error : `HTTP ${result.error.context.status}`);
    }
    if (result.error) throw result.error;
    return result.data;
  }
  async function openWidget() {
    setBusy(true); setMessage('Preparando conexão de teste...');
    try {
      const data = await invoke('bank-connect-token', {});
      if (typeof data?.connect_token !== 'string') throw new Error('Resposta sem token.');
      setToken(data.connect_token); setMessage('Escolha somente Sandbox / Pluggy Bank.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao abrir conexão.'); }
    finally { setBusy(false); }
  }
  async function sync(id = itemId.trim()) {
    if (!id) { setMessage('Informe o Item ID criado pelo widget.'); return; }
    setBusy(true); setMessage('Sincronizando lançamentos de teste...');
    try {
      const data = await invoke('bank-sync', { item_id: id });
      await loadConnections();
      setItemId(id);
      setMessage(`Sincronização concluída: ${Number(data?.imported ?? 0)} novo(s), ${Number(data?.fetched ?? 0)} válido(s). Atualize a página para recarregar o painel.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha na sincronização.'); }
    finally { setBusy(false); }
  }
  async function disconnect(connection: Connection) {
    setBusy(true); setMessage('Revogando consentimento e removendo dados importados...');
    try {
      await invoke('bank-disconnect', { connection_id: connection.id });
      await loadConnections();
      setItemId('');
      setMessage('Banco desconectado. Atualize a página para recarregar o painel sem os dados importados.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao desconectar.'); }
    finally { setBusy(false); }
  }
  function confirmDisconnect(connection: Connection) {
    const run = () => void disconnect(connection);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Desconectar o banco e apagar todos os lançamentos importados?')) run();
      return;
    }
    Alert.alert('Desconectar banco?', 'O consentimento será revogado e todos os lançamentos importados serão apagados. Lançamentos manuais serão preservados.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desconectar', style: 'destructive', onPress: run },
    ]);
  }
  return <View style={{ width: '100%', maxWidth: 500, gap: 8, paddingVertical: 12 }}>
    <Text style={{ fontWeight: 'bold' }}>Contas bancárias de teste</Text>
    <Text>Somente leitura. Use apenas Sandbox / Pluggy Bank nesta etapa.</Text>
    {connections.map((c) => <View key={c.id} style={{ borderWidth: 1, borderColor: '#ddd', padding: 8, gap: 4 }}>
      <Text>{c.connector_name}</Text><Text>Última sincronização: {c.last_synced_at ?? 'nunca'}</Text>
      <Button title="Sincronizar novamente" disabled={busy} onPress={() => void sync(c.pluggy_item_id)} />
      <Button title="Desconectar e apagar importados" disabled={busy} onPress={() => confirmDisconnect(c)} />
    </View>)}
    {connections.length === 0 && <>
      <Button title={busy ? 'Preparando...' : 'Conectar Pluggy Bank'} disabled={busy || !!token}
        onPress={() => void openWidget()} />
      <TextInput value={itemId} onChangeText={setItemId} autoCapitalize="none"
        placeholder="Cole aqui o Item ID já criado" style={{ borderWidth: 1, borderColor: '#999', padding: 10 }} />
      <Button title="Salvar conexão e sincronizar" disabled={busy} onPress={() => void sync()} />
    </>}
    {!!message && <Text selectable>{message}</Text>}
    {token && <WidgetBanco token={token}
      onSuccess={(id) => { setItemId(id); setToken(null); setMessage('Conexão criada. Clique em Salvar conexão e sincronizar.'); }}
      onClose={() => setToken(null)}
      onError={(m) => { setToken(null); setMessage(m); }} />}
  </View>;
}
