import Button from './ActionButton';
import { colors } from '../theme';
import { StyleSheet, Text, View } from 'react-native';
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
  style: 'currency',
  currency: 'BRL',
}).format(n);

export default function LancamentosPorDia({
  itens,
  categorias,
  ocupado,
  onEditar,
  onExcluir,
}: Props) {
  return (
    <View style={styles.lista}>
      {agruparPorDia(itens).map((grupo) => (
        <View key={grupo.data} style={styles.grupo}>
          <Text style={styles.dia}>{formatarDia(grupo.data)}</Text>

          {grupo.lancamentos.map((item) => {
            const importado = item.source === 'open_finance';
            const categoria = categorias.find((c) => c.id === item.category_id)?.name
              ?? 'Categoria não encontrada';

            return (
              <View key={item.id} style={styles.cartao}>
                <Text style={styles.descricao}>{item.description}</Text>
                <Text style={{ color: colors.ink }}>{item.type === 'income' ? 'Receita' : 'Despesa'}</Text>
                <Text style={{ color: colors.ink }}>{categoria}</Text>
                <Text style={[styles.amount, { color: item.type === 'income' ? colors.income : colors.expense }]}>{item.type === 'income' ? '+ ' : '− '}{moeda(Number(item.amount))}</Text>

                {importado ? (
                  <View style={styles.origem}>
                    <Text style={styles.origemTitulo}>Importado do banco</Text>
                    <Text style={styles.origemTexto}>
                      {item.account_name || 'Conta bancária'} · somente leitura
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.manual}>Lançamento manual</Text>
                )}

                <View style={styles.botoes}>
                  <Button
                    title={importado ? 'Alterar categoria' : 'Editar'}
                    onPress={() => onEditar(item)}
                    disabled={ocupado}
                  />

                  {!importado && (
                    <Button
                      title="Excluir"
                      onPress={() => onExcluir(item)}
                      disabled={ocupado}
                    />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
 lista: { width: '100%', gap: 22 }, grupo: { gap: 10 }, dia: { fontSize: 14, fontWeight: '700', color: colors.muted, marginTop: 8 },
 cartao: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 20, gap: 7 },
 descricao: { fontWeight: '700', fontSize: 17, color: colors.ink }, amount: { fontWeight: '700', fontSize: 24, marginVertical: 5 },
 manual: { color: colors.muted, fontSize: 12 }, origem: { borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 10, marginTop: 4 },
 origemTitulo: { color: colors.primary, fontWeight: '700', fontSize: 12 }, origemTexto: { color: colors.muted, fontSize: 12, lineHeight: 18 },
 botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
});
