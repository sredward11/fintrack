import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ActivityIndicator,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  Platform,
} from 'react-native';
import { supabase } from '../src/lib/supabase';

type Tipo = 'income' | 'expense';

type Categoria = {
  id: string;
  name: string;
  type: Tipo;
};

type Lancamento = {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: Tipo;
  category_id: string;
};

function dataLocalHoje() {
  const agora = new Date();
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function dataValida(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T12:00:00Z`);
  return !Number.isNaN(data.getTime()) &&
    data.toISOString().slice(0, 10) === valor;
}

export default function HomeScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [iniciando, setIniciando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mensagem, setMensagem] = useState('');

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [tipo, setTipo] = useState<Tipo>('expense');
  const [categoriaId, setCategoriaId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(dataLocalHoje());
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const usuarioId = session?.user.id;

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: resultado, error }) => {
      if (error) setMensagem(error.message);
      setSession(resultado.session);
      setIniciando(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_evento, novaSession) => {
        setSession(novaSession);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!usuarioId) {
      setCategorias([]);
      setLancamentos([]);
      setCategoriaId('');
      setEditandoId(null);
      return;
    }

    let ativo = true;

    async function carregar() {
      const [resultadoCategorias, resultadoLancamentos] = await Promise.all([
        supabase
          .from('categories')
          .select('id, name, type')
          .order('name'),
        supabase
          .from('transactions')
          .select('id, description, amount, date, type, category_id')
          .eq('user_id', usuarioId!)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false }),
      ]);

      if (!ativo) return;

      if (resultadoCategorias.error) {
        setMensagem(`Erro nas categorias: ${resultadoCategorias.error.message}`);
      } else {
        setCategorias((resultadoCategorias.data ?? []) as Categoria[]);
      }

      if (resultadoLancamentos.error) {
        setMensagem(`Erro nos lançamentos: ${resultadoLancamentos.error.message}`);
      } else {
        setLancamentos((resultadoLancamentos.data ?? []) as Lancamento[]);
      }
    }

    void carregar();
    return () => { ativo = false; };
  }, [usuarioId]);

  const categoriasDoTipo = categorias.filter((item) => item.type === tipo);
  const categoriaSelecionada = categoriasDoTipo.some(
    (item) => item.id === categoriaId
  )
    ? categoriaId
    : '';

  async function autenticar(modo: 'cadastro' | 'login') {
    setMensagem('');

    if (!email.trim() || !senha) {
      setMensagem('Preencha e-mail e senha.');
      return;
    }

    setOcupado(true);
    try {
      const credenciais = { email: email.trim(), password: senha };
      const { data: resultado, error } = modo === 'cadastro'
        ? await supabase.auth.signUp(credenciais)
        : await supabase.auth.signInWithPassword(credenciais);

      if (error) {
        setMensagem(error.message);
      } else if (modo === 'cadastro' && !resultado.session) {
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

  async function salvarLancamento() {
  setMensagem('');

  if (!usuarioId) {
    setMensagem('Entre na sua conta antes de salvar.');
    return;
  }

  const texto = descricao.trim();
  const numero = Number(valor.trim().replace(',', '.'));

  if (texto.length < 2 || texto.length > 80) {
    setMensagem('A descrição deve ter entre 2 e 80 caracteres.');
    return;
  }
  if (
    !Number.isFinite(numero) ||
    numero <= 0 ||
    !/^\d+(?:[.,]\d{1,2})?$/.test(valor.trim())
  ) {
    setMensagem('Informe um valor positivo, com até duas casas decimais.');
    return;
  }
  if (!dataValida(data)) {
    setMensagem('Informe uma data válida no formato AAAA-MM-DD.');
    return;
  }
  if (!categoriaSelecionada) {
    setMensagem('Selecione uma categoria do tipo escolhido.');
    return;
  }

  setOcupado(true);

  try {
    const campos = {
      category_id: categoriaSelecionada,
      type: tipo,
      description: texto,
      amount: numero,
      date: data,
    };

    if (editandoId) {
      const { data: alterados, error } = await supabase
        .from('transactions')
        .update(campos)
        .eq('id', editandoId)
        .eq('user_id', usuarioId)
        .select('id');

      if (error) {
        setMensagem(`Erro ao editar: ${error.message}`);
        return;
      }
      if (alterados?.length !== 1) {
        setMensagem('Nenhum lançamento foi alterado. Atualize a página e confira o registro.');
        return;
      }
    } else {
      const { data: criados, error } = await supabase
        .from('transactions')
        .insert({ ...campos, user_id: usuarioId })
        .select('id');

      if (error) {
        setMensagem(`Erro ao salvar: ${error.message}`);
        return;
      }
      if (criados?.length !== 1) {
        setMensagem('Não foi possível confirmar a criação do lançamento.');
        return;
      }
    }

    const { data: lista, error: erroLista } = await supabase
      .from('transactions')
      .select('id, description, amount, date, type, category_id')
      .eq('user_id', usuarioId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (erroLista) {
      setMensagem(`Alteração feita, mas houve erro ao atualizar a lista: ${erroLista.message}`);
      return;
    }

    setLancamentos((lista ?? []) as Lancamento[]);
    setEditandoId(null);
    setDescricao('');
    setValor('');
    setMensagem(editandoId ? 'Lançamento editado.' : 'Lançamento salvo.');
  } catch (error) {
    setMensagem(error instanceof Error ? error.message : 'Falha inesperada.');
  } finally {
    setOcupado(false);
  }
}
function iniciarEdicao(item: Lancamento) {
  setEditandoId(item.id);
  setTipo(item.type);
  setCategoriaId(item.category_id);
  setDescricao(item.description);
  setValor(String(item.amount).replace('.', ','));
  setData(item.date);
  setMensagem(`Editando: ${item.description}`);
}

function confirmarExclusao(item: Lancamento) {
  const executar = () => void excluirLancamento(item.id);

  if (Platform.OS === 'web') {
    if (window.confirm(`Excluir "${item.description}"?`)) executar();
    return;
  }

  Alert.alert('Excluir lançamento?', item.description, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: executar },
  ]);
}
function cancelarEdicao() {
  setEditandoId(null);
  setDescricao('');
  setValor('');
  setData(dataLocalHoje());
  setCategoriaId('');
  setMensagem('');
}
async function excluirLancamento(id: string) {
  if (!usuarioId || ocupado) return;

  setOcupado(true);
  setMensagem('');

  try {
    const { data: excluidos, error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', usuarioId)
      .select('id');

    if (error) {
      setMensagem(`Erro ao excluir: ${error.message}`);
      return;
    }

    if (excluidos?.length !== 1) {
      setMensagem('Nenhum lançamento foi excluído. Atualize a página e confira o registro.');
      return;
    }

    setLancamentos((anteriores) =>
      anteriores.filter((item) => item.id !== id)
    );
    if (editandoId === id) cancelarEdicao();
    setMensagem('Lançamento excluído.');
  } catch (error) {
    setMensagem(error instanceof Error ? error.message : 'Falha inesperada.');
  } finally {
    setOcupado(false);
  }
}
  async function sair() {
    setOcupado(true);
    try {
      const { error } = await supabase.auth.signOut();
      setMensagem(error ? error.message : 'Sessão encerrada.');
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Falha ao sair.');
    } finally {
      setOcupado(false);
    }
  }

  if (iniciando) {
    return <View style={styles.container}><ActivityIndicator /></View>;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.subtitulo}>
  {editandoId ? 'Editar lançamento' : 'Novo lançamento'}
</Text>

      {session ? (
        <>
          <Text>Conectado: {session.user.email}</Text>
          <Text>Categorias visíveis: {categorias.length}</Text>
          <Button title="Sair" onPress={() => void sair()} disabled={ocupado} />

          <Text style={styles.subtitulo}>Novo lançamento</Text>
          <View style={styles.linha}>
            <Button title="Despesa" onPress={() => {
              setTipo('expense');
              setCategoriaId('');
            }} />
            <Button title="Receita" onPress={() => {
              setTipo('income');
              setCategoriaId('');
            }} />
          </View>
          <Text>Tipo selecionado: {tipo === 'expense' ? 'Despesa' : 'Receita'}</Text>

          <TextInput
            style={styles.campo}
            placeholder="Descrição"
            value={descricao}
            onChangeText={setDescricao}
            maxLength={80}
          />
          <TextInput
            style={styles.campo}
            placeholder="Valor, por exemplo: 25,90"
            keyboardType="decimal-pad"
            value={valor}
            onChangeText={setValor}
          />
          <TextInput
            style={styles.campo}
            placeholder="Data: AAAA-MM-DD"
            value={data}
            onChangeText={setData}
          />

          <Text style={styles.rotulo}>Categoria:</Text>
          <View style={styles.categorias}>
            {categoriasDoTipo.map((item) => (
              <View key={item.id} style={styles.botaoCategoria}>
                <Button
                  title={`${categoriaSelecionada === item.id ? '✓ ' : ''}${item.name}`}
                  onPress={() => setCategoriaId(item.id)}
                />
              </View>
            ))}
          </View>

          <Button
  title={editandoId ? 'Salvar alterações' : 'Salvar lançamento'}
  onPress={() => void salvarLancamento()}
  disabled={ocupado || categorias.length === 0}
/>
{editandoId && (
  <Button title="Cancelar edição" onPress={cancelarEdicao} disabled={ocupado} />
)}

          <Text style={styles.subtitulo}>Meus lançamentos</Text>
          {lancamentos.length === 0 && <Text>Nenhum lançamento ainda.</Text>}
          {lancamentos.map((item) => (
            <View key={item.id} style={styles.lancamento}>
              <Text style={styles.descricao}>{item.description}</Text>
              <Text>
                {item.type === 'income' ? 'Receita' : 'Despesa'} · {item.date}
              </Text>
              <Text>
                {categorias.find((cat) => cat.id === item.category_id)?.name ??
                  'Categoria não encontrada'}
              </Text>
              <Text>R$ {Number(item.amount).toFixed(2).replace('.', ',')}</Text>
              <View style={styles.linha}>
  <Button
    title="Editar"
    onPress={() => iniciarEdicao(item)}
    disabled={ocupado}
  />
  <Button
    title="Excluir"
    onPress={() => confirmarExclusao(item)}
    disabled={ocupado}
  />
</View>
            </View>
          ))}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  titulo: { fontSize: 26, fontWeight: 'bold' },
  subtitulo: { fontSize: 20, fontWeight: 'bold', marginTop: 18 },
  rotulo: { fontWeight: 'bold', alignSelf: 'flex-start' },
  linha: { flexDirection: 'row', gap: 12 },
  campo: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    padding: 12,
  },
  categorias: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    maxWidth: 500,
  },
  botaoCategoria: { marginBottom: 4 },
  lancamento: {
    width: '100%',
    maxWidth: 500,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  descricao: { fontWeight: 'bold' },
  mensagem: { textAlign: 'center', marginTop: 8 },
});