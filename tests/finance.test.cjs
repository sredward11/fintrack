const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const filename = path.resolve(__dirname, '../src/domain/finance.ts');
const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = module.paths;
mod._compile(output, filename);
const { dataValida, valorEmCentavos, resumoMensal, campoCsv, montarCsv } = mod.exports;
const item = (amount, type = 'expense', date = '2026-10-05') => ({
  id: 't1', description: 'Teste', amount, type, date, category_id: 'c1',
});
const categoria = [{ id: 'c1', name: 'Alimentação', type: 'expense' }];
const casos = [
  ['valor com vírgula', () => assert.equal(valorEmCentavos('25,90'), 2590)],
  ['valor com ponto', () => assert.equal(valorEmCentavos('25.90'), 2590)],
  ['valor inteiro', () => assert.equal(valorEmCentavos('25'), 2500)],
  ['uma casa decimal', () => assert.equal(valorEmCentavos('25,9'), 2590)],
  ['zero rejeitado', () => assert.equal(valorEmCentavos('0'), null)],
  ['negativo rejeitado', () => assert.equal(valorEmCentavos('-2'), null)],
  ['três casas rejeitadas', () => assert.equal(valorEmCentavos('1,999'), null)],
  ['texto rejeitado', () => assert.equal(valorEmCentavos('abc'), null)],
  ['limite do banco', () => assert.equal(valorEmCentavos('10000000000'), null)],
  ['data válida', () => assert.equal(dataValida('2026-10-05'), true)],
  ['ano bissexto', () => assert.equal(dataValida('2024-02-29'), true)],
  ['29 fevereiro inválido', () => assert.equal(dataValida('2026-02-29'), false)],
  ['31 abril inválido', () => assert.equal(dataValida('2026-04-31'), false)],
  ['formato inválido', () => assert.equal(dataValida('05/10/2026'), false)],
  ['resumo vazio', () => assert.equal(resumoMensal([], '2026-10').quantidade, 0)],
  ['soma de receitas', () => assert.equal(resumoMensal([item(10, 'income'), item(20, 'income')], '2026-10').receitas, 30)],
  ['soma de despesas', () => assert.equal(resumoMensal([item(10), item(20)], '2026-10').despesas, 30)],
  ['saldo negativo', () => assert.equal(resumoMensal([item(10, 'income'), item(20)], '2026-10').saldo, -10)],
  ['exclui outro mês', () => assert.equal(resumoMensal([item(10, 'income', '2026-09-01')], '2026-10').quantidade, 0)],
  ['precisão em centavos', () => assert.equal(resumoMensal([item(0.1), item(0.2)], '2026-10').despesas, 0.3)],
  ['escapa aspas CSV', () => assert.equal(campoCsv('Uma "compra"'), '"Uma ""compra"""')],
  ['neutraliza fórmula CSV', () => assert.equal(campoCsv('=1+1'), '"\'=1+1"')],
  ['CSV com BOM e cabeçalho', () => assert.ok(montarCsv([], []).startsWith('\uFEFFData;Tipo;Descricao;Categoria;Valor\r\n'))],
  ['CSV com categoria e decimal', () => assert.ok(montarCsv([item(25.9)], categoria).includes('"Alimentação";"25,90"'))],
];
for (const [nome, executar] of casos) test(nome, executar);
