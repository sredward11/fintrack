// Integra regras testadas sem substituir autenticação, CRUD ou configuração.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'app/index.tsx');
let s = fs.readFileSync(file, 'utf8');
if (s.includes("from '../src/domain/finance'")) {
  console.log('Integração já aplicada. Nenhuma alteração feita.');
  process.exit(0);
}
function removerFuncao(nome) {
  const inicio = s.indexOf(`function ${nome}(`);
  if (inicio < 0) throw new Error(`Não encontrei ${nome}. Nenhum arquivo será salvo.`);
  const proxima = s.indexOf('\nfunction ', inicio + 1);
  const componente = s.indexOf('\nexport default function ', inicio + 1);
  const fim = proxima >= 0 && proxima < componente ? proxima : componente;
  if (fim < 0) throw new Error('Estrutura diferente da versão entregue. Nenhum arquivo será salvo.');
  s = s.slice(0, inicio) + s.slice(fim + 1);
}
for (const nome of ['dataValida', 'campoCsv', 'montarCsv']) removerFuncao(nome);
const inicioResumo = s.indexOf('  const receitas = doMes.filter(');
const fimResumo = s.indexOf('  const gastosPorCategoria =', inicioResumo);
if (inicioResumo < 0 || fimResumo < 0) throw new Error('Resumo não encontrado. Nenhum arquivo será salvo.');
s = s.slice(0, inicioResumo) + '  const { receitas, despesas } = resumoMensal(lancamentos, mes);\n' + s.slice(fimResumo);
const antigo = `    const numero = Number(valorTexto.replace(',', '.'));`;
if (!s.includes(antigo)) throw new Error('Validação monetária não encontrada. Nenhum arquivo será salvo.');
s = s.replace(antigo, '    const centavos = valorEmCentavos(valorTexto);\n    const numero = (centavos ?? 0) / 100;');
const inicioValor = s.indexOf('    if (!/^\\d+(?:[.,]\\d{1,2})?$/.test(valorTexto)');
const fimValor = s.indexOf("      setMensagem('Informe um valor positivo", inicioValor);
if (inicioValor < 0 || fimValor < 0) throw new Error('Validação diferente. Nenhum arquivo será salvo.');
s = s.slice(0, inicioValor) + '    if (centavos === null) {\n' + s.slice(fimValor);
s = "import { dataValida, montarCsv, resumoMensal, valorEmCentavos } from '../src/domain/finance';\n" + s;
const backup = path.join(root, '..', `fintrack-index-antes-testes-${Date.now()}.tsx`);
fs.copyFileSync(file, backup);
fs.writeFileSync(file, s, 'utf8');
console.log('Regras integradas ao app. Backup fora do projeto:', backup);
