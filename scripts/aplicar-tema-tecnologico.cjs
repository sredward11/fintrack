const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const names = ['app/index.tsx', 'src/components/BancosTeste.tsx', 'src/components/LancamentosPorDia.tsx', 'src/components/ActionButton.tsx', 'src/theme/index.ts'];
const originals = new Map();
for (const name of names) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) throw new Error(`Arquivo ausente: ${name}. Nenhuma alteracao feita.`);
  originals.set(name, fs.readFileSync(file, 'utf8'));
}
if (originals.get('src/theme/index.ts').includes('FINTRACK_TECH_V2')) {
  console.log('Tema tecnologico ja aplicado.'); process.exit(0);
}
for (const name of names.slice(0, 4)) {
  if (!originals.get(name).includes('colors')) throw new Error(`Base diferente do redesign anterior: ${name}. Nenhuma alteracao feita.`);
}
const next = new Map(originals);
next.set('src/theme/index.ts', `// FINTRACK_TECH_V2
export const colors = {
  background: '#080F1D', surface: '#121E31', ink: '#ECF3FF', muted: '#A7B8D0',
  primary: '#56D9F5', soft: '#19354A', border: '#30445F',
  income: '#60E0AE', expense: '#FF929C',
};
`);
// Give otherwise unstyled text a readable color; preserve every callback and data expression.
for (const name of names.slice(0, 3)) {
  let s = originals.get(name);
  s = s.replace(/<Text>/g, '<Text style={{ color: colors.ink }}>');
  s = s.replace(/<Text selectable>/g, '<Text selectable style={{ color: colors.ink }}>');
  s = s.replace(/<TextInput /g, '<TextInput placeholderTextColor={colors.muted} ');
  if (name === 'app/index.tsx') {
    s = s.replace("brand: { paddingVertical: 18, gap: 5 }", "brand: { paddingVertical: 20, paddingHorizontal: 22, gap: 7, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: colors.primary, borderRadius: 18 }");
    s = s.replace("titulo: { fontSize: 38, fontWeight: '800', color: colors.ink }", "titulo: { fontSize: 40, fontWeight: '800', color: colors.ink, letterSpacing: -1 }");
    s = s.replace("borderRadius: 16, padding: 20, gap: 10", "borderRadius: 16, padding: 20, gap: 10, borderTopWidth: 3, borderTopColor: colors.primary");
    s = s.replace('stroke="#e5e7eb"', 'stroke={colors.border}');
    s = s.replace("const cores = ['#2563eb', '#ef4444', '#f59e0b', '#16a34a', '#9333ea', '#0891b2', '#db2777', '#64748b', '#84cc16'];", "const cores = ['#56D9F5', '#FF929C', '#FFD278', '#60E0AE', '#C4A0FF', '#83B5FF', '#F5A2DD', '#A7B8D0', '#B6E57D'];");
  }
  next.set(name, s);
}
let button = originals.get('src/components/ActionButton.tsx');
button = button.replace("color: '#FFFFFF'", "color: '#071522'");
button = button.replace("backgroundColor: '#FFF0F1', borderColor: '#E9B7BB'", "backgroundColor: '#351E2B', borderColor: '#754253'");
next.set('src/components/ActionButton.tsx', button);
// Confirm all functions and state before the UI are untouched.
for (const [name, start, end] of [
  ['app/index.tsx', '  const [session', '  if (iniciando)'],
  ['src/components/BancosTeste.tsx', '  const [token', '  return <View'],
]) {
  const a = originals.get(name), b = next.get(name);
  if (a.indexOf(start) < 0 || a.indexOf(end) < 0) throw new Error(`Estrutura diferente: ${name}. Nenhuma alteracao feita.`);
  const functional = (s) => s.slice(s.indexOf(start), s.indexOf(end));
  // Palette is presentation-only, even though defined before rendering.
  const stripPalette = (s) => s.replace(/const cores = \[[^\]]*\];/, 'const cores = [];');
  if (stripPalette(functional(a)) !== stripPalette(functional(b))) throw new Error(`Validacao de preservacao falhou: ${name}`);
}
const backup = path.join(path.dirname(root), `fintrack-backup-tech-${Date.now()}`);
for (const name of names) {
  const dest = path.join(backup, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, originals.get(name), 'utf8');
}
for (const name of names) fs.writeFileSync(path.join(root, name), next.get(name), 'utf8');
console.log('Tema tecnologico aplicado. Backup fora do projeto:', backup);
console.log('Valide TypeScript, testes, web e celular antes de commitar.');
