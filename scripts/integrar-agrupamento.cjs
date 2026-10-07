const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'app/index.tsx');
let s = fs.readFileSync(file, 'utf8');
if (s.includes("from '../src/components/LancamentosPorDia'")) {
  console.log('Agrupamento ja aplicado.'); process.exit(0);
}
const inicio = s.indexOf('          {exibidos.map((item) => (');
const fim = s.indexOf('          ))}', inicio);
if (inicio < 0 || fim < 0) throw new Error('Trecho da lista nao encontrado. Nenhum arquivo foi alterado.');
const substituto = `          <LancamentosPorDia itens={exibidos} categorias={categorias}
            ocupado={ocupado} onEditar={iniciarEdicao} onExcluir={confirmarExclusao} />`;
s = s.slice(0, inicio) + substituto + s.slice(fim + '          ))}'.length);
s = "import LancamentosPorDia from '../src/components/LancamentosPorDia';\n" + s;
const backup = path.join(root, '..', `fintrack-antes-agrupamento-${Date.now()}.tsx`);
fs.copyFileSync(file, backup);
fs.writeFileSync(file, s, 'utf8');
console.log('Agrupamento aplicado. Backup fora do projeto:', backup);
