import Button from '../src/components/ActionButton';
import { colors } from '../src/theme';
import BancosTeste from '../src/components/BancosTeste';
import LancamentosPorDia from '../src/components/LancamentosPorDia';
import { dataValida, montarCsv, resumoMensal, valorEmCentavos } from '../src/domain/finance';
import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ActivityIndicator, Alert, Platform, ScrollView,
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
  source?: 'manual' | 'open_finance';
  account_name?: string | null;
};

function hojeLocal() {
  const agora = new Date();
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);
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
  const [editandoImportado, setEditandoImportado] = useState(false);
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
          .select('id, description, amount, date, type, category_id, source, account_name')
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
  const { receitas, despesas } = resumoMensal(lancamentos, mes);
  const gastosPorCategoria = categorias.filter((c) => c.type === 'expense')
    .map((c) => ({ id: c.id, nome: c.name,
      valor: doMes.filter((t) => t.type === 'expense' && t.category_id === c.id)
        .reduce((n, t) => n + Number(t.amount), 0) }))
    .filter((c) => c.valor > 0);
  const cores = ['#56D9F5', '#FF929C', '#FFD278', '#60E0AE', '#C4A0FF', '#83B5FF', '#F5A2DD', '#A7B8D0', '#B6E57D'];
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
          .select('id, description, amount, date, type, category_id, source, account_name')
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
    setEditandoId(null); setEditandoImportado(false); setDescricao(''); setValor('');
    setData(hojeLocal()); setCategoriaId(''); setMensagem('');
  }
  function iniciarEdicao(item: Lancamento) {
    setEditandoId(item.id); setEditandoImportado(item.source === 'open_finance'); setTipo(item.type); setCategoriaId(item.category_id);
    setDescricao(item.description); setValor(String(item.amount).replace('.', ','));
    setData(item.date); setMensagem(`Editando: ${item.description}`);
  }
  async function atualizarLista(id: string) {
    const { data: lista, error } = await supabase.from('transactions')
      .select('id, description, amount, date, type, category_id, source, account_name')
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
    const centavos = valorEmCentavos(valorTexto);
    const numero = (centavos ?? 0) / 100;
    if (texto.length < 2 || texto.length > 80) {
      setMensagem('A descrição deve ter entre 2 e 80 caracteres.'); return;
    }
    if (centavos === null) {
      setMensagem('Informe um valor positivo com até duas casas decimais.'); return;
    }
    if (!dataValida(data)) { setMensagem('Informe uma data válida AAAA-MM-DD.'); return; }
    if (!categoriaSelecionada) { setMensagem('Selecione uma categoria do tipo escolhido.'); return; }
    setOcupado(true);
    try {
      const campos = { category_id: categoriaSelecionada, type: tipo,
        description: texto, amount: numero, date: data };
      const camposEdicao = editandoImportado
        ? { category_id: categoriaSelecionada }
        : campos;
      const resultado = editandoId
        ? await supabase.from('transactions').update(camposEdicao)
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
    <ScrollView style={styles.page} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.brand}><Text style={styles.eyebrow}>FINANÇAS PESSOAIS</Text><Text style={styles.titulo}>FinTrack</Text><Text style={styles.tagline}>Seu dinheiro, com mais clareza.</Text></View>
      {session ? (
        <>
          <Text style={styles.hint}>Conectado: {session.user.email}</Text>
          <Text style={{ color: colors.ink }}>Categorias visíveis: {categorias.length}</Text>
          <BancosTeste />
          <Button title="Sair" onPress={() => void sair()} disabled={ocupado} />

          <Text style={styles.subtitulo}>Painel mensal</Text>
          <Text style={styles.rotulo}>Período</Text>
<TextInput placeholderTextColor={colors.muted} style={styles.campo} placeholder="Mês: AAAA-MM" value={mes}
            onChangeText={setMes} maxLength={7} />
          {!mesValido ? <Text style={{ color: colors.ink }}>Informe um mês válido no formato AAAA-MM.</Text> : (
            <View style={styles.summary}>
<View style={styles.metric}><Text style={styles.hint}>Receitas</Text><Text style={[styles.metricValue, {color: colors.income}]}>{moeda(receitas)}</Text></View>
<View style={styles.metric}><Text style={styles.hint}>Despesas</Text><Text style={[styles.metricValue, {color: colors.expense}]}>{moeda(despesas)}</Text></View>
<View style={styles.metric}><Text style={styles.hint}>Saldo do mês</Text><Text style={styles.metricValue}>{moeda(receitas - despesas)}</Text></View>
<View style={styles.metric}><Text style={styles.hint}>Lançamentos</Text><Text style={styles.metricValue}>{doMes.length}</Text></View>
</View>
          )}
          {mesValido && (
            <>
              <Text style={styles.subtitulo}>Despesas por categoria</Text>
              {despesas > 0 ? (
                <View style={styles.cartao}>
                  <Svg width={180} height={180} viewBox="0 0 180 180" accessibilityLabel="Gráfico de despesas por categoria">
                    <Circle cx={90} cy={90} r={65} stroke={colors.border} strokeWidth={26} fill="none" />
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
              ) : <Text style={{ color: colors.ink }}>Sem despesas neste mês.</Text>}
              <Button title="Exportar CSV do mês" onPress={() => void exportarCsv()} disabled={ocupado} />
            </>
          )}

          <Text style={styles.subtitulo}>{editandoImportado ? 'Alterar categoria do importado' : editandoId ? 'Editar lançamento' : 'Novo lançamento'}</Text>
          <View style={styles.linha}>
            <Button title="Despesa" onPress={() => { setTipo('expense'); setCategoriaId(''); }} disabled={ocupado || editandoImportado} />
            <Button title="Receita" onPress={() => { setTipo('income'); setCategoriaId(''); }} disabled={ocupado || editandoImportado} />
          </View>
          <Text style={{ color: colors.ink }}>Tipo selecionado: {tipo === 'expense' ? 'Despesa' : 'Receita'}</Text>
          <Text style={styles.rotulo}>Descrição</Text>
<TextInput placeholderTextColor={colors.muted} style={styles.campo} placeholder="Descrição" value={descricao}
            onChangeText={setDescricao} maxLength={80} editable={!editandoImportado} />
          <Text style={styles.rotulo}>Valor (R$)</Text>
<TextInput placeholderTextColor={colors.muted} style={styles.campo} placeholder="Valor, por exemplo: 25,90"
            keyboardType="decimal-pad" value={valor} onChangeText={setValor} editable={!editandoImportado} />
          <Text style={styles.rotulo}>Data (AAAA-MM-DD)</Text>
<TextInput placeholderTextColor={colors.muted} style={styles.campo} placeholder="Data: AAAA-MM-DD" value={data}
            onChangeText={setData} editable={!editandoImportado} />
          <Text style={styles.rotulo}>Categoria:</Text>
          <View style={styles.categorias}>
            {categoriasDoTipo.map((item) => (
              <View key={item.id} style={styles.botaoCategoria}>
                <Button title={`${categoriaSelecionada === item.id ? '✓ ' : ''}${item.name}`}
                  onPress={() => setCategoriaId(item.id)} disabled={ocupado} />
              </View>
            ))}
          </View>
          <Button title={editandoImportado ? 'Salvar categoria' : editandoId ? 'Salvar alterações' : 'Salvar lançamento'}
            onPress={() => void salvarLancamento()} disabled={ocupado || categorias.length === 0} />
          {editandoId && <Button title="Cancelar edição" onPress={cancelarEdicao} disabled={ocupado} />}

          <Text style={styles.subtitulo}>Meus lançamentos no mês</Text>
          <Text style={styles.rotulo}>Buscar lançamentos</Text>
<TextInput placeholderTextColor={colors.muted} style={styles.campo} placeholder="Buscar pela descrição"
            value={busca} onChangeText={setBusca} />
          <View style={styles.linha}>
            <Button title="Todos" onPress={() => setFiltro('all')} />
            <Button title="Receitas" onPress={() => setFiltro('income')} />
            <Button title="Despesas" onPress={() => setFiltro('expense')} />
          </View>
          <Text style={{ color: colors.ink }}>Filtro: {filtro === 'all' ? 'Todos' : filtro === 'income' ? 'Receitas' : 'Despesas'}</Text>
          {exibidos.length === 0 && <Text style={{ color: colors.ink }}>Nenhum lançamento para este filtro e mês.</Text>}
          <LancamentosPorDia itens={exibidos} categorias={categorias}
            ocupado={ocupado} onEditar={iniciarEdicao} onExcluir={confirmarExclusao} />
        </>
      ) : (
        <>
          <Text style={styles.rotulo}>E-mail</Text>
<TextInput placeholderTextColor={colors.muted} style={styles.campo} placeholder="E-mail" autoCapitalize="none"
            keyboardType="email-address" value={email} onChangeText={setEmail} />
          <Text style={styles.rotulo}>Senha</Text>
<TextInput placeholderTextColor={colors.muted} style={styles.campo} placeholder="Senha" secureTextEntry
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
  page: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, width: '100%', maxWidth: 960, alignSelf: 'center', padding: 24, paddingTop: 48, paddingBottom: 64, gap: 14 },
  brand: { paddingVertical: 20, paddingHorizontal: 22, gap: 7, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: colors.primary, borderRadius: 18 }, eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  titulo: { fontSize: 40, fontWeight: '800', color: colors.ink, letterSpacing: -1 }, tagline: { fontSize: 16, color: colors.muted },
  hint: { color: colors.muted, fontSize: 13 }, subtitulo: { fontSize: 22, fontWeight: '700', marginTop: 24, color: colors.ink },
  rotulo: { fontWeight: '600', fontSize: 13, color: colors.muted, marginTop: 4 },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  campo: { width: '100%', minHeight: 50, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.ink, fontSize: 16 },
  categorias: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, botaoCategoria: { marginBottom: 2 },
  cartao: { width: '100%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 22, gap: 10, alignItems: 'center' },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { flexGrow: 1, flexBasis: 180, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 20, gap: 10, borderTopWidth: 3, borderTopColor: colors.primary },
  metricValue: { color: colors.ink, fontSize: 26, fontWeight: '700' }, descricao: { fontWeight: 'bold', color: colors.ink },
  mensagem: { color: colors.ink, backgroundColor: colors.soft, borderRadius: 12, padding: 16, fontSize: 14, lineHeight: 22, marginTop: 8 },
});
