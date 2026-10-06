import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ActivityIndicator, Alert, Button, Platform, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabase } from '../src/lib/supabase';

type Tipo = 'income' | 'expense';
type Categoria = { id: string; name: string; type: Tipo };
type Lancamento = {
  id: string; description: string; amount: number; date: string;
  type: Tipo; category_id: string;
};

function hojeLocal() {
  const agora = new Date();
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);
}
function dataValida(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T12:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}
function campoCsv(valor: string) {
  // Prevent spreadsheet formula execution when opening exported user text.
  const seguro = /^[=+@\-\t\r]/.test(valor) ? `'${valor}` : valor;
  return `"${seguro.replace(/"/g, '""')}"`;
}
function montarCsv(itens: Lancamento[], categorias: Categoria[]) {
  const linhas = ['Data;Tipo;Descricao;Categoria;Valor'];
  for (const item of itens) {
    const categoria = categorias.find((c) => c.id === item.category_id)?.name ?? '';
    linhas.push([item.date, item.type === 'income' ? 'Receita' : 'Despesa',
      item.description, categoria, Number(item.amount).toFixed(2).replace('.', ',')]
      .map(campoCsv).join(';'));
  }
  return '﻿' + linhas.join('\r\n') + '\r\n';
}
function moeda(valor: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
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
  const [data, setData] = useState(hojeLocal());
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mes, setMes] = useState(hojeLocal().slice(0, 7));
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'all' | Tipo>('all');
  const usuarioId = session?.user.id;

  useEffect(() => {
    let ativo = true;
    void supabase.auth.getSession().then(({ data: resultado, error }) => {
      if (!ativo) return;
      if (error) setMensagem(error.message);
      setSession(resultado.session);
      setIniciando(false);
    }).catch((error: unknown) => {
      if (!ativo) return;
      setMensagem(error instanceof Error ? error.message : 'Falha ao iniciar sessão.');
      setIniciando(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_evento, novaSession) => {
      setSession(novaSession);
    });
    return () => { ativo = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!usuarioId) {
      setCategorias([]); setLancamentos([]); setCategoriaId(''); setEditandoId(null);
      return;
    }
    let ativo = true;
    async function carregar() {
      const [cats, trans] = await Promise.all([
        supabase.from('categories').select('id, name, type').order('name'),
        supabase.from('transactions')
          .select('id, description, amount, date, type, category_id')
          .eq('user_id', usuarioId!).order('date', { ascending: false })
          .order('created_at', { ascending: false }),
      ]);
      if (!ativo) return;
      if (cats.error) setMensagem(`Erro nas categorias: ${cats.error.message}`);
      else setCategorias((cats.data ?? []) as Categoria[]);
      if (trans.error) setMensagem(`Erro nos lançamentos: ${trans.error.message}`);
      else setLancamentos((trans.data ?? []) as Lancamento[]);
    }
    void carregar().catch((error: unknown) => {
      if (ativo) setMensagem(error instanceof Error ? error.message : 'Falha ao carregar dados.');
    });
    return () => { ativo = false; };
  }, [usuarioId]);

  const categoriasDoTipo = categorias.filter((c) => c.type === tipo);
  const categoriaSelecionada = categoriasDoTipo.some((c) => c.id === categoriaId)
    ? categoriaId : '';
  const mesValido = /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);
  const doMes = useMemo(() => mesValido
    ? lancamentos.filter((item) => item.date.slice(0, 7) === mes) : [],
    [lancamentos, mes, mesValido]);
  const receitas = doMes.filter((item) => item.type === 'income')
    .reduce((total, item) => total + Number(item.amount), 0);
  const despesas = doMes.filter((item) => item.type === 'expense')
    .reduce((total, item) => total + Number(item.amount), 0);
  const gastosPorCategoria = categorias.filter((c) => c.type === 'expense')
    .map((c) => ({ id: c.id, nome: c.name,
      valor: doMes.filter((t) => t.type === 'expense' && t.category_id === c.id)
        .reduce((n, t) => n + Number(t.amount), 0) }))
    .filter((c) => c.valor > 0);
  const cores = ['#2563eb', '#ef4444', '#f59e0b', '#16a34a', '#9333ea', '#0891b2', '#db2777', '#64748b', '#84cc16'];
  let angulo = 0;
  const fatias = gastosPorCategoria.map((c, i) => {
    const inicio = angulo;
    const proporcao = despesas > 0 ? c.valor / despesas : 0;
    angulo += proporcao;
    return { ...c, inicio, proporcao, cor: cores[i % cores.length] };
  });
  const exibidos = doMes.filter((item) =>
    (filtro === 'all' || item.type === filtro) &&
    item.description.toLocaleLowerCase('pt-BR').includes(busca.trim().toLocaleLowerCase('pt-BR'))
  );

  async function exportarCsv() {
    if (!usuarioId || !mesValido) return;
    setOcupado(true); setMensagem('');
    try {
      // Fetch the entire selected month, not just the locally cached first page.
      const inicio = `${mes}-01`;
      const proximo = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 1))
        .toISOString().slice(0, 10);
      const itens: Lancamento[] = [];
      for (let pagina = 0; ; pagina++) {
        const { data: lote, error } = await supabase.from('transactions')
          .select('id, description, amount, date, type, category_id')
          .eq('user_id', usuarioId).gte('date', inicio).lt('date', proximo)
          .order('date', { ascending: false }).order('id')
          .range(pagina * 500, pagina * 500 + 499);
        if (error) throw new Error(error.message);
        itens.push(...((lote ?? []) as Lancamento[]));
        if ((lote ?? []).length < 500) break;
      }
      const csv = montarCsv(itens, categorias);
      const nome = `fintrack-${mes}.csv`;
      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = nome; document.body.appendChild(link);
        link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        if (!(await Sharing.isAvailableAsync())) throw new Error('Compartilhamento indisponível neste dispositivo.');
        const arquivo = new File(Paths.cache, nome);
        arquivo.create({ overwrite: true });
        arquivo.write(csv);
        await Sharing.shareAsync(arquivo.uri, { mimeType: 'text/csv', dialogTitle: 'Exportar FinTrack' });
      }
      setMensagem(`CSV preparado: ${itens.length} lançamento(s) de ${mes}.`);
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Falha ao exportar CSV.');
    } finally { setOcupado(false); }
  }

  async function autenticar(modo: 'cadastro' | 'login') {
    setMensagem('');
    if (!email.trim() || !senha) { setMensagem('Preencha e-mail e senha.'); return; }
    setOcupado(true);
    try {
      const credenciais = { email: email.trim(), password: senha };
      const { data: resultado, error } = modo === 'cadastro'
        ? await supabase.auth.signUp(credenciais)
        : await supabase.auth.signInWithPassword(credenciais);
      if (error) setMensagem(error.message);
      else if (modo === 'cadastro' && !resultado.session)
        setMensagem('Cadastro recebido. Confirme o e-mail e depois faça login.');
      else setMensagem(modo === 'cadastro' ? 'Cadastro concluído.' : 'Login concluído.');
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Falha inesperada.');
    } finally { setOcupado(false); }
  }

  function cancelarEdicao() {
    setEditandoId(null); setDescricao(''); setValor('');
    setData(hojeLocal()); setCategoriaId(''); setMensagem('');
  }
  function iniciarEdicao(item: Lancamento) {
    setEditandoId(item.id); setTipo(item.type); setCategoriaId(item.category_id);
    setDescricao(item.description); setValor(String(item.amount).replace('.', ','));
    setData(item.date); setMensagem(`Editando: ${item.description}`);
  }
  async function atualizarLista(id: string) {
    const { data: lista, error } = await supabase.from('transactions')
      .select('id, description, amount, date, type, category_id')
      .eq('user_id', id).order('date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Operação feita, mas falhou a atualização da lista: ${error.message}`);
    setLancamentos((lista ?? []) as Lancamento[]);
  }
  async function salvarLancamento() {
    setMensagem('');
    if (!usuarioId) { setMensagem('Entre na sua conta antes de salvar.'); return; }
    const texto = descricao.trim();
    const valorTexto = valor.trim();
    const numero = Number(valorTexto.replace(',', '.'));
    if (texto.length < 2 || texto.length > 80) {
      setMensagem('A descrição deve ter entre 2 e 80 caracteres.'); return;
    }
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(valorTexto) ||
        !Number.isFinite(numero) || numero <= 0 || numero > 9999999999.99) {
      setMensagem('Informe um valor positivo com até duas casas decimais.'); return;
    }
    if (!dataValida(data)) { setMensagem('Informe uma data válida AAAA-MM-DD.'); return; }
    if (!categoriaSelecionada) { setMensagem('Selecione uma categoria do tipo escolhido.'); return; }
    setOcupado(true);
    try {
      const campos = { category_id: categoriaSelecionada, type: tipo,
        description: texto, amount: numero, date: data };
      const resultado = editandoId
        ? await supabase.from('transactions').update(campos)
            .eq('id', editandoId).eq('user_id', usuarioId).select('id')
        : await supabase.from('transactions').insert({ ...campos, user_id: usuarioId }).select('id');
      if (resultado.error) { setMensagem(resultado.error.message); return; }
      if (resultado.data?.length !== 1) {
        setMensagem('Nenhuma linha foi alterada. Atualize e confira o registro.'); return;
      }
      const foiEdicao = Boolean(editandoId);
      await atualizarLista(usuarioId);
      cancelarEdicao();
      setMensagem(foiEdicao ? 'Lançamento editado.' : 'Lançamento salvo.');
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Falha inesperada.');
    } finally { setOcupado(false); }
  }
  async function excluirLancamento(id: string) {
    if (!usuarioId || ocupado) return;
    setOcupado(true); setMensagem('');
    try {
      const { data: excluidos, error } = await supabase.from('transactions')
        .delete().eq('id', id).eq('user_id', usuarioId).select('id');
      if (error) { setMensagem(`Erro ao excluir: ${error.message}`); return; }
      if (excluidos?.length !== 1) {
        setMensagem('Nenhum lançamento foi excluído. Atualize e confira o registro.'); return;
      }
      setLancamentos((anteriores) => anteriores.filter((item) => item.id !== id));
      if (editandoId === id) cancelarEdicao();
      setMensagem('Lançamento excluído.');
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Falha inesperada.');
    } finally { setOcupado(false); }
  }
  function confirmarExclusao(item: Lancamento) {
    const executar = () => void excluirLancamento(item.id);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Excluir "${item.description}"?`)) executar();
      return;
    }
    Alert.alert('Excluir lançamento?', item.description, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: executar },
    ]);
  }
  async function sair() {
    setOcupado(true);
    try {
      const { error } = await supabase.auth.signOut();
      setMensagem(error ? error.message : 'Sessão encerrada.');
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Falha ao sair.');
    } finally { setOcupado(false); }
  }

  if (iniciando) return <View style={styles.container}><ActivityIndicator /></View>;
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.titulo}>FinTrack</Text>
      {session ? (
        <>
          <Text>Conectado: {session.user.email}</Text>
          <Text>Categorias visíveis: {categorias.length}</Text>
          <Button title="Sair" onPress={() => void sair()} disabled={ocupado} />

          <Text style={styles.subtitulo}>Painel mensal</Text>
          <TextInput style={styles.campo} placeholder="Mês: AAAA-MM" value={mes}
            onChangeText={setMes} maxLength={7} />
          {!mesValido ? <Text>Informe um mês válido no formato AAAA-MM.</Text> : (
            <View style={styles.cartao}>
              <Text>Receitas: {moeda(receitas)}</Text>
              <Text>Despesas: {moeda(despesas)}</Text>
              <Text>Saldo: {moeda(receitas - despesas)}</Text>
              <Text>Lançamentos no mês: {doMes.length}</Text>
            </View>
          )}
          {mesValido && (
            <>
              <Text style={styles.subtitulo}>Despesas por categoria</Text>
              {despesas > 0 ? (
                <View style={styles.cartao}>
                  <Svg width={180} height={180} viewBox="0 0 180 180" accessibilityLabel="Gráfico de despesas por categoria">
                    <Circle cx={90} cy={90} r={65} stroke="#e5e7eb" strokeWidth={26} fill="none" />
                    {fatias.map((f) => (
                      <Circle key={f.id} cx={90} cy={90} r={65} fill="none"
                        stroke={f.cor} strokeWidth={26} strokeDasharray={`${f.proporcao * 408.407} 408.407`}
                        strokeDashoffset={-f.inicio * 408.407}
                        />
                    ))}
                  </Svg>
                  {fatias.map((f) => (
                    <Text key={f.id} style={{ color: f.cor }}>
                      {f.nome}: {moeda(f.valor)} ({Math.round(f.proporcao * 100)}%)
                    </Text>
                  ))}
                </View>
              ) : <Text>Sem despesas neste mês.</Text>}
              <Button title="Exportar CSV do mês" onPress={() => void exportarCsv()} disabled={ocupado} />
            </>
          )}

          <Text style={styles.subtitulo}>{editandoId ? 'Editar lançamento' : 'Novo lançamento'}</Text>
          <View style={styles.linha}>
            <Button title="Despesa" onPress={() => { setTipo('expense'); setCategoriaId(''); }} disabled={ocupado} />
            <Button title="Receita" onPress={() => { setTipo('income'); setCategoriaId(''); }} disabled={ocupado} />
          </View>
          <Text>Tipo selecionado: {tipo === 'expense' ? 'Despesa' : 'Receita'}</Text>
          <TextInput style={styles.campo} placeholder="Descrição" value={descricao}
            onChangeText={setDescricao} maxLength={80} />
          <TextInput style={styles.campo} placeholder="Valor, por exemplo: 25,90"
            keyboardType="decimal-pad" value={valor} onChangeText={setValor} />
          <TextInput style={styles.campo} placeholder="Data: AAAA-MM-DD" value={data}
            onChangeText={setData} />
          <Text style={styles.rotulo}>Categoria:</Text>
          <View style={styles.categorias}>
            {categoriasDoTipo.map((item) => (
              <View key={item.id} style={styles.botaoCategoria}>
                <Button title={`${categoriaSelecionada === item.id ? '✓ ' : ''}${item.name}`}
                  onPress={() => setCategoriaId(item.id)} disabled={ocupado} />
              </View>
            ))}
          </View>
          <Button title={editandoId ? 'Salvar alterações' : 'Salvar lançamento'}
            onPress={() => void salvarLancamento()} disabled={ocupado || categorias.length === 0} />
          {editandoId && <Button title="Cancelar edição" onPress={cancelarEdicao} disabled={ocupado} />}

          <Text style={styles.subtitulo}>Meus lançamentos no mês</Text>
          <TextInput style={styles.campo} placeholder="Buscar pela descrição"
            value={busca} onChangeText={setBusca} />
          <View style={styles.linha}>
            <Button title="Todos" onPress={() => setFiltro('all')} />
            <Button title="Receitas" onPress={() => setFiltro('income')} />
            <Button title="Despesas" onPress={() => setFiltro('expense')} />
          </View>
          <Text>Filtro: {filtro === 'all' ? 'Todos' : filtro === 'income' ? 'Receitas' : 'Despesas'}</Text>
          {exibidos.length === 0 && <Text>Nenhum lançamento para este filtro e mês.</Text>}
          {exibidos.map((item) => (
            <View key={item.id} style={styles.cartao}>
              <Text style={styles.descricao}>{item.description}</Text>
              <Text>{item.type === 'income' ? 'Receita' : 'Despesa'} · {item.date}</Text>
              <Text>{categorias.find((cat) => cat.id === item.category_id)?.name ?? 'Categoria não encontrada'}</Text>
              <Text>{moeda(Number(item.amount))}</Text>
              <View style={styles.linha}>
                <Button title="Editar" onPress={() => iniciarEdicao(item)} disabled={ocupado} />
                <Button title="Excluir" onPress={() => confirmarExclusao(item)} disabled={ocupado} />
              </View>
            </View>
          ))}
        </>
      ) : (
        <>
          <TextInput style={styles.campo} placeholder="E-mail" autoCapitalize="none"
            keyboardType="email-address" value={email} onChangeText={setEmail} />
          <TextInput style={styles.campo} placeholder="Senha" secureTextEntry
            value={senha} onChangeText={setSenha} />
          <Button title="Criar conta" onPress={() => void autenticar('cadastro')} disabled={ocupado} />
          <Button title="Entrar" onPress={() => void autenticar('login')} disabled={ocupado} />
        </>
      )}
      {!!mensagem && <Text style={styles.mensagem}>{mensagem}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  titulo: { fontSize: 26, fontWeight: 'bold' },
  subtitulo: { fontSize: 20, fontWeight: 'bold', marginTop: 18 },
  rotulo: { fontWeight: 'bold', alignSelf: 'flex-start' },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  campo: { width: '100%', maxWidth: 360, borderWidth: 1, borderColor: '#999', borderRadius: 8, padding: 12 },
  categorias: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, maxWidth: 500 },
  botaoCategoria: { marginBottom: 4 },
  cartao: { width: '100%', maxWidth: 500, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, gap: 4 },
  descricao: { fontWeight: 'bold' },
  mensagem: { textAlign: 'center', marginTop: 8 },
});
