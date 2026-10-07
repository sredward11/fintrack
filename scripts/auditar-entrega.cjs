const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

function run(command, args) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  execFileSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
}

function output(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', shell: process.platform === 'win32' }).trim();
}

if (!fs.existsSync('package.json') || !fs.existsSync('app/index.tsx')) {
  throw new Error('Execute na raiz de fintrack.');
}

const tracked = output('git', ['ls-files']).split(/\r?\n/).filter(Boolean);
const forbiddenNames = tracked.filter((file) =>
  /(^|\/)(\.env($|\.)|supabase\/\.temp\/|node_modules\/)/i.test(file) ||
  /backup|\.zip$|\.pem$|\.p12$|\.pfx$/i.test(file)
);
if (forbiddenNames.length) {
  console.error('\nArquivos proibidos ou suspeitos versionados:');
  forbiddenNames.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

const secretPatterns = [
  /sb_secret_[A-Za-z0-9_-]+/,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^\s]+/,
  /PLUGGY_CLIENT_SECRET\s*=\s*(?!COLE|SEU_|<)[^\s]+/,
];
const suspicious = [];
for (const file of tracked) {
  if (!fs.existsSync(file) || fs.statSync(file).size > 2_000_000) continue;
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
  if (secretPatterns.some((pattern) => pattern.test(text))) suspicious.push(file);
}
if (suspicious.length) {
  console.error('\nConteudo com padrao de segredo. Revise sem publicar os valores:');
  suspicious.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

run('npx', ['tsc', '--noEmit']);
run('node', ['--test', 'tests/finance.test.cjs', 'tests/grouping.test.cjs', 'tests/openfinance.test.cjs']);
run('npx', ['expo-doctor']);

const status = output('git', ['status', '--short']);
console.log('\nGit status:');
console.log(status || '(limpo)');
console.log('\nAuditoria automatica concluida. Revise manualmente README, capturas e fluxo no aparelho.');
