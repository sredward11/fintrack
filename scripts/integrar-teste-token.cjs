const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'app/index.tsx');
let s = fs.readFileSync(file, 'utf8');
if (s.includes("from '../src/components/TesteTokenBancario'")) {
  console.log('Teste ja integrado.'); process.exit(0);
}
const alvo = '<Text>Categorias visiveis: {categorias.length}</Text>';
// Match the exact accented line from the previously delivered app.
const linha = '<Text>Categorias visíveis: {categorias.length}</Text>';
if (!s.includes(linha)) throw new Error('Ponto de insercao nao encontrado. Nenhum arquivo alterado.');
s = s.replace(linha, linha + '\n          <TesteTokenBancario />');
s = "import TesteTokenBancario from '../src/components/TesteTokenBancario';\n" + s;
fs.copyFileSync(file, path.join(root, '..', `fintrack-antes-teste-token-${Date.now()}.tsx`));
fs.writeFileSync(file, s, 'utf8');
console.log('Botao integrado. Backup fora do projeto.');
