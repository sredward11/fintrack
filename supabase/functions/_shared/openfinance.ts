export type Direction = 'income' | 'expense';
export type AccountKind = 'BANK' | 'CREDIT';
export interface PluggyTransaction {
  id: string; description: string; currencyCode: string; amount: number;
  date: string; category?: string | null; type?: 'CREDIT' | 'DEBIT';
  status?: 'POSTED' | 'PENDING';
}
export interface ImportRow {
  external_id: string; type: Direction; description: string;
  amount: number; date: string; categoryName: string;
}
export type SkipReason = 'pending' | 'foreign_currency' | 'invalid' | 'card_bill_payment' | 'card_payment_received';
export type MapResult = { row: ImportRow } | { skip: SkipReason };
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export function toBrazilDate(iso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(iso)) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // Reject dates that JS silently normalizes, such as February 31.
  const day = iso.slice(0, 10);
  const check = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== day) return null;
  const midnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
  return new Date(d.getTime() - (midnight ? 0 : 3 * 3600000)).toISOString().slice(0, 10);
}
export function cleanDescription(text: string) {
  const s = text.replace(/\s+/g, ' ').trim().slice(0, 80);
  return s.length >= 2 ? s : 'Transação bancária';
}
const expense: [string, string][] = [
  ['Alimentação', 'eating out|restaurant|grocer|supermarket|food|bakery|padaria|aliment|mercado|restaurante|ifood|pizza|delivery'],
  ['Transporte', 'transport|taxi|uber|fuel|combust|posto|estaciona|parking|pedagio|metro|onibus'],
  ['Saúde', 'health|pharmacy|farmacia|drogaria|hospital|clinica|medic|odonto'],
  ['Educação', 'education|school|curso|escola|faculdade|universidade|livraria'],
  ['Lazer', 'entertainment|netflix|spotify|cinema|steam|viagem|hotel'],
  ['Moradia', 'aluguel|mortgage|condominio|housing|iptu|reforma'],
  ['Contas', 'utilities|bills|energia|internet|telecom|telefone|seguro|imposto|tarifa|boleto'],
  ['Compras', 'shopping|retail|clothing|electronics|amazon|shopee|loja'],
];
const income: [string, string][] = [
  ['Salário', 'salary|payroll|salario|folha de pagamento|proventos|remuneracao'],
  ['Investimentos', 'investment|dividend|rendimento|juros|resgate|cdb|tesouro'],
  ['Freelance', 'freelance|prestacao de servico|honorarios'],
  ['Presentes', 'gift|presente'],
];
export function suggestCategory(type: Direction, category: string | null | undefined, description: string) {
  const rules = type === 'income' ? income : expense;
  const match = (s: string) => rules.find(([, words]) => words.split('|').some((w) => normalize(s).includes(w)))?.[0];
  return (category ? match(category) : undefined) ?? match(description) ?? 'Outros';
}
export function mapTransaction(tx: PluggyTransaction, kind: AccountKind): MapResult {
  if (tx.status === 'PENDING') return { skip: 'pending' };
  if (tx.currencyCode !== 'BRL') return { skip: 'foreign_currency' };
  const amount = Math.round(Math.abs(tx.amount) * 100) / 100;
  const date = toBrazilDate(tx.date);
  if (!tx.id || !date || !Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99) return { skip: 'invalid' };
  const type: Direction = tx.type === 'CREDIT' ? 'income' : tx.type === 'DEBIT' ? 'expense'
    : kind === 'CREDIT' ? (tx.amount >= 0 ? 'expense' : 'income') : (tx.amount >= 0 ? 'income' : 'expense');
  const text = normalize(tx.description);
  if (kind === 'BANK' && type === 'expense' && /(pag|pgto)\w*\.?\s*(de\s*)?(da\s*)?fatura|fatura\s*(do\s*)?cart/.test(text)) return { skip: 'card_bill_payment' };
  if (kind === 'CREDIT' && type === 'income' && /pagamento (recebido|efetuado)|payment received|(pag|pgto)\w*\.?\s*fatura/.test(text)) return { skip: 'card_payment_received' };
  return { row: { external_id: tx.id, type, description: cleanDescription(tx.description), amount, date, categoryName: suggestCategory(type, tx.category, tx.description) } };
}
export function buildRange(lastSyncedAt: string | null, now: Date) {
  const last = lastSyncedAt ? new Date(lastSyncedAt) : null;
  const valid = last && !Number.isNaN(last.getTime()) && last.getTime() <= now.getTime();
  const start = valid ? last!.getTime() - 7 * 86400000 : now.getTime() - 90 * 86400000;
  return { from: new Date(start).toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}
export function describeItemProblem(status: string, executionStatus?: string | null) {
  if (status === 'UPDATED') return null;
  if (status === 'LOGIN_ERROR') return { httpStatus: 422, message: executionStatus === 'USER_AUTHORIZATION_REVOKED' ? 'Consentimento revogado. Conecte novamente.' : 'Não foi possível autenticar a conexão.' };
  if (status === 'OUTDATED') return { httpStatus: 502, message: 'Conexão desatualizada. Tente novamente.' };
  return { httpStatus: 409, message: 'Conexão ainda não pronta para importação.' };
}
