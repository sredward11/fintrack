const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'app/index.tsx');
let s = fs.readFileSync(file, 'utf8');
if (s.includes("from '../src/components/BancosTeste'")) {
  console.log('Widget ja integrado.'); process.exit(0);
}
const antigo = "import TesteTokenBancario from '../src/components/TesteTokenBancario';";
if (!s.includes(antigo) || !s.includes('<TesteTokenBancario />')) {
  throw new Error('Tela diferente da esperada. Nenhum arquivo alterado.');
}
s = s.replace(antigo, "import BancosTeste from '../src/components/BancosTeste';")
  .replace('<TesteTokenBancario />', '<BancosTeste />');
fs.copyFileSync(file, path.join(root, '..', `fintrack-antes-widget-${Date.now()}.tsx`));
fs.writeFileSync(file, s, 'utf8');
console.log('Widget integrado. Backup fora do projeto.');
