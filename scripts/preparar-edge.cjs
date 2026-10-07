const fs = require('node:fs');
const ts = require('typescript');
const file = 'tsconfig.json';
const source = fs.readFileSync(file, 'utf8');
const parsed = ts.parseConfigFileTextToJson(file, source);
if (parsed.error) throw new Error('tsconfig invalido. Nenhuma alteracao feita.');
const config = parsed.config;
const exclude = config.exclude ?? ['node_modules', 'bower_components', 'jspm_packages'];
if (!exclude.includes('supabase/functions')) {
  config.exclude = [...exclude, 'supabase/functions'];
  fs.writeFileSync('tsconfig.antes-edge.json', source);
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
}
console.log('App separado das funcoes Deno. Testes continuam lendo as regras diretamente.');
