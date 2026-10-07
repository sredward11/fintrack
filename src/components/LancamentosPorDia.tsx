import { Button, StyleSheet, Text, View } from 'react-native';
import type { Categoria, Lancamento } from '../domain/finance';
import { agruparPorDia, formatarDia } from '../domain/grouping';

type Props = {
  itens: Lancamento[];
  categorias: Categoria[];
  ocupado: boolean;
  onEditar: (item: Lancamento) => void;
  onExcluir: (item: Lancamento) => void;
};
const moeda = (n: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL',
}).format(n);
export default function LancamentosPorDia({ itens, categorias, ocupado, onEditar, onExcluir }: Props) {
  return <View style={styles.lista}>
    {agruparPorDia(itens).map((grupo) => <View key={grupo.data} style={styles.grupo}>
      <Text style={styles.dia}>{formatarDia(grupo.data)}</Text>
      {grupo.lancamentos.map((item) => <View key={item.id} style={styles.cartao}>
        <Text style={styles.descricao}>{item.description}</Text>
        <Text>{item.type === 'income' ? 'Receita' : 'Despesa'}</Text>
        <Text>{categorias.find((c) => c.id === item.category_id)?.name ?? 'Categoria não encontrada'}</Text>
        <Text>{moeda(Number(item.amount))}</Text>
        <View style={styles.botoes}>
          <Button title="Editar" onPress={() => onEditar(item)} disabled={ocupado} />
          <Button title="Excluir" onPress={() => onExcluir(item)} disabled={ocupado} />
        </View>
      </View>)}
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  lista: { width: '100%', maxWidth: 500, gap: 16 },
  grupo: { gap: 8 },
  dia: { fontSize: 18, fontWeight: 'bold', marginTop: 8 },
  cartao: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, gap: 4 },
  descricao: { fontWeight: 'bold' },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
