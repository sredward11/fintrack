const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const file = path.resolve(__dirname, '../src/domain/grouping.ts');
const m = new Module(file, module);
m.filename = file; m.paths = module.paths;
m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file);
const { agruparPorDia, formatarDia } = m.exports;
const item = (id, date) => ({ id, date, description: 'Teste', amount: 1, type: 'expense', category_id: 'c' });
test('lista vazia', () => assert.deepEqual(agruparPorDia([]), []));
test('mesmo dia agrupado', () => assert.equal(agruparPorDia([item('a', '2026-10-01'), item('b', '2026-10-01')])[0].lancamentos.length, 2));
test('dias separados', () => assert.equal(agruparPorDia([item('a', '2026-10-01'), item('b', '2026-10-02')]).length, 2));
test('mais recente primeiro', () => assert.equal(agruparPorDia([item('a', '2026-09-30'), item('b', '2026-10-01')])[0].data, '2026-10-01'));
test('nao altera entrada', () => { const entrada = [item('a', '2026-10-01')]; const antes = JSON.stringify(entrada); agruparPorDia(entrada); assert.equal(JSON.stringify(entrada), antes); });
test('data brasileira sem fuso horario', () => assert.equal(formatarDia('2026-10-01'), '01/10/2026'));
