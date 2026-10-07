const { test } = require('node:test');
const a = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const ts = require('typescript'); const Module = require('node:module');
const file = path.resolve(__dirname, '../supabase/functions/_shared/openfinance.ts');
const m = new Module(file, module); m.filename = file; m.paths = module.paths;
m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, file);
const { toBrazilDate: date, cleanDescription: clean, suggestCategory: cat, mapTransaction: map, buildRange: range, describeItemProblem: problem } = m.exports;
const tx = (extra = {}) => ({ id: 't1', description: 'Compra mercado', currencyCode: 'BRL', amount: -45.9, date: '2026-09-10T00:00:00Z', type: 'DEBIT', status: 'POSTED', ...extra });
const now = new Date('2026-09-19T12:00:00Z');
const cases = [
 ['meia noite preservada', () => a.equal(date('2026-09-10T00:00:00Z'), '2026-09-10')],
 ['hora convertida', () => a.equal(date('2026-09-10T01:30:00Z'), '2026-09-09')],
 ['data inválida', () => a.equal(date('ontem'), null)],
 ['espaços normalizados', () => a.equal(clean('  PIX   ENVIADO '), 'PIX ENVIADO')],
 ['limite descrição', () => a.equal(clean('x'.repeat(200)).length, 80)],
 ['descrição curta', () => a.equal(clean('a'), 'Transação bancária')],
 ['categoria fornecida', () => a.equal(cat('expense', 'Health', 'Mercado'), 'Saúde')],
 ['categoria pela descrição', () => a.equal(cat('expense', null, 'IFOOD pedido'), 'Alimentação')],
 ['categoria fallback', () => a.equal(cat('expense', null, 'XYZ'), 'Outros')],
 ['receita investimento', () => a.equal(cat('income', null, 'Rendimentos CDB'), 'Investimentos')],
 ['despesa positiva', () => a.equal(map(tx(), 'BANK').row.amount, 45.9)],
 ['receita pelo tipo', () => a.equal(map(tx({ type: 'CREDIT', amount: 100 }), 'BANK').row.type, 'income')],
 ['sinal conta', () => a.equal(map(tx({ type: undefined, amount: 100 }), 'BANK').row.type, 'income')],
 ['sinal cartão', () => a.equal(map(tx({ type: undefined, amount: 100 }), 'CREDIT').row.type, 'expense')],
 ['pendente ignorado', () => a.equal(map(tx({ status: 'PENDING' }), 'BANK').skip, 'pending')],
 ['moeda estrangeira', () => a.equal(map(tx({ currencyCode: 'USD' }), 'BANK').skip, 'foreign_currency')],
 ['valor zero', () => a.equal(map(tx({ amount: 0 }), 'BANK').skip, 'invalid')],
 ['pagamento fatura conta', () => a.equal(map(tx({ description: 'PAGAMENTO DE FATURA CARTÃO' }), 'BANK').skip, 'card_bill_payment')],
 ['pagamento recebido cartão', () => a.equal(map(tx({ description: 'Pagamento recebido', type: 'CREDIT' }), 'CREDIT').skip, 'card_payment_received')],
 ['estorno mantido', () => a.equal(map(tx({ description: 'Estorno loja', type: 'CREDIT' }), 'CREDIT').row.type, 'income')],
 ['janela inicial', () => a.equal(range(null, now).from, '2026-06-21')],
 ['janela incremental e status', () => { a.equal(range('2026-09-15T10:00:00Z', now).from, '2026-09-08'); a.equal(problem('UPDATED'), null); a.equal(problem('UPDATING').httpStatus, 409); a.equal(problem('LOGIN_ERROR').httpStatus, 422); }],
];
for (const [name, fn] of cases) test(name, fn);
