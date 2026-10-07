export type Tipo = 'income' | 'expense';
export type Categoria = { id: string; name: string; type: Tipo };
export type Lancamento = { id: string; description: string; amount: number; date: string; type: Tipo; category_id: string
  source?: 'manual' | 'open_finance';
  account_name?: string | null; };
export function dataValida(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T12:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}
export function valorEmCentavos(texto: string): number | null {
  const s = texto.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(s)) return null;
  const [inteiro, decimal = ''] = s.replace(',', '.').split('.');
  const n = Number(inteiro) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(n) && n > 0 && n <= 999999999999 ? n : null;
}
export function resumoMensal(itens: Lancamento[], mes: string) {
  const selecionados = /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)
    ? itens.filter((t) => t.date.slice(0, 7) === mes) : [];
  const receitasCentavos = selecionados.filter((t) => t.type === 'income')
    .reduce((n, t) => n + Math.round(Number(t.amount) * 100), 0);
  const despesasCentavos = selecionados.filter((t) => t.type === 'expense')
    .reduce((n, t) => n + Math.round(Number(t.amount) * 100), 0);
  return { receitas: receitasCentavos / 100, despesas: despesasCentavos / 100,
    saldo: (receitasCentavos - despesasCentavos) / 100, quantidade: selecionados.length };
}
export function campoCsv(valor: string) {
  const seguro = /^[\s]*[=+@-]/.test(valor) || /^[\t\r\n]/.test(valor) ? `'${valor}` : valor;
  return `"${seguro.replace(/"/g, '""')}"`;
}
export function montarCsv(itens: Lancamento[], categorias: Categoria[]) {
  const linhas = ['Data;Tipo;Descricao;Categoria;Valor'];
  for (const t of itens) {
    const nome = categorias.find((c) => c.id === t.category_id)?.name ?? '';
    linhas.push([t.date, t.type === 'income' ? 'Receita' : 'Despesa', t.description,
      nome, Number(t.amount).toFixed(2).replace('.', ',')].map(campoCsv).join(';'));
  }
  return '\uFEFF' + linhas.join('\r\n') + '\r\n';
}
