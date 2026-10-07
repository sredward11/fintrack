import type { Lancamento } from './finance';
export function agruparPorDia(itens: Lancamento[]) {
  const grupos = new Map<string, Lancamento[]>();
  for (const item of itens) {
    const lista = grupos.get(item.date) ?? [];
    lista.push(item);
    grupos.set(item.date, lista);
  }
  return [...grupos.entries()].sort(([a], [b]) => b.localeCompare(a))
    .map(([data, lancamentos]) => ({ data, lancamentos }));
}
export function formatarDia(data: string) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}
