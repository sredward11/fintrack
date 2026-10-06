import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../src/lib/supabase';

export default function HomeScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [iniciando, setIniciando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [categorias, setCategorias] = useState<number | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) setMensagem(error.message);
      setSession(data.session);
      setIniciando(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_evento, novaSession) => {
      setSession(novaSession);
      if (!novaSession) setCategorias(null);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    let ativo = true;

    async function carregarCategorias() {
      const { count, error } = await supabase
        .from('categories')
        .select('*', { count: 'exact', head: true });

      if (!ativo) return;
      if (error) setMensagem(`Erro ao ler categorias: ${error.message}`);
      else setCategorias(count ?? 0);
    }

    void carregarCategorias();
    return () => { ativo = false; };
  }, [session]);

  async function autenticar(modo: 'cadastro' | 'login') {
    setMensagem('');

    if (!email.trim() || !senha) {
      setMensagem('Preencha e-mail e senha.');
      return;
    }

    setOcupado(true);
    try {
      const credenciais = { email: email.trim(), password: senha };
      const { data, error } = modo === 'cadastro'
        ? await supabase.auth.signUp(credenciais)
        : await supabase.auth.signInWithPassword(credenciais);

      if (error) {
        setMensagem(error.message);
      } else if (modo === 'cadastro' && !data.session) {
        setMensagem('Cadastro recebido. Confirme o e-mail e depois faça login.');
      } else {
        setMensagem(modo === 'cadastro' ? 'Cadastro concluído.' : 'Login concluído.');
      }
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Falha inesperada.');
    } finally {
      setOcupado(false);
    }
  }

  async function sair() {
    setOcupado(true);
    const { error } = await supabase.auth.signOut();
    setOcupado(false);
    setMensagem(error ? error.message : 'Sessão encerrada.');
  }

  if (iniciando) {
    return <View style={styles.container}><ActivityIndicator /></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>FinTrack</Text>

      {session ? (
        <>
          <Text>Conectado: {session.user.email}</Text>
          <Text>
            Categorias visíveis: {categorias === null ? 'consultando...' : categorias}
          </Text>
          <Button title="Sair" onPress={() => void sair()} disabled={ocupado} />
        </>
      ) : (
        <>
          <TextInput
            style={styles.campo}
            placeholder="E-mail"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.campo}
            placeholder="Senha"
            secureTextEntry
            value={senha}
            onChangeText={setSenha}
          />
          <Button
            title="Criar conta"
            onPress={() => void autenticar('cadastro')}
            disabled={ocupado}
          />
          <Button
            title="Entrar"
            onPress={() => void autenticar('login')}
            disabled={ocupado}
          />
        </>
      )}

      {!!mensagem && <Text style={styles.mensagem}>{mensagem}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  titulo: { fontSize: 26, fontWeight: 'bold' },
  campo: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    padding: 12,
  },
  mensagem: { textAlign: 'center', marginTop: 8 },
});