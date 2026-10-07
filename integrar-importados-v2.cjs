const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const appFile = path.join(root, 'app', 'index.tsx');
const financeFile = path.join(root, 'src', 'domain', 'finance.ts');

if (!fs.existsSync(appFile) || !fs.existsSync(financeFile)) {
  throw new Error('Execute este script na raiz de fintrack.');
}

let app = fs.readFileSync(appFile, 'utf8');
let finance = fs.readFileSync(financeFile, 'utf8');

if (app.includes('const [editandoImportado, setEditandoImportado]')) {
  console.log('Interface de importados ja integrada. Nenhuma alteracao feita.');
  process.exit(0);
}

const required = [
  "const [editandoId, setEditandoId] = useState<string | null>(null);",
  ".select('id, description, amount, date, type, category_id')",
  'function iniciarEdicao(item: Lancamento) {',
  'const campos = { category_id: categoriaSelecionada, type: tipo,',
  "? await supabase.from('transactions').update(campos)",
];
for (const text of required) {
  if (!app.includes(text)) {
    throw new Error(`Estrutura inesperada em app/index.tsx. Nao encontrei: ${text}. Nenhum arquivo foi alterado.`);
  }
}

// Accepts single-line or multi-line definitions, but only edits the Lancamento block.
if (!/export type Lancamento\s*=\s*\{[\s\S]*?category_id:\s*string;?[\s\S]*?\};/.test(finance)) {
  throw new Error('Tipo Lancamento nao localizado com seguranca. Nenhum arquivo foi alterado.');
}

if (!/source\??:\s*['"]manual['"]\s*\|\s*['"]open_finance['"]/.test(finance)) {
  finance = finance.replace(
    /(export type Lancamento\s*=\s*\{[\s\S]*?category_id:\s*string;?)([\s\S]*?\};)/,
    "$1\n  source?: 'manual' | 'open_finance';\n  account_name?: string | null;$2",
  );
}

app = app.replaceAll(
  ".select('id, description, amount, date, type, category_id')",
  ".select('id, description, amount, date, type, category_id, source, account_name')",
);

app = app.replace(
  "const [editandoId, setEditandoId] = useState<string | null>(null);",
  "const [editandoId, setEditandoId] = useState<string | null>(null);\n  const [editandoImportado, setEditandoImportado] = useState(false);",
);

app = app.replace(
  "setEditandoId(null); setDescricao(''); setValor('');",
  "setEditandoId(null); setEditandoImportado(false); setDescricao(''); setValor('');",
);

app = app.replace(
  "setEditandoId(item.id); setTipo(item.type); setCategoriaId(item.category_id);",
  "setEditandoId(item.id); setEditandoImportado(item.source === 'open_finance'); setTipo(item.type); setCategoriaId(item.category_id);",
);

app = app.replace(
  "const campos = { category_id: categoriaSelecionada, type: tipo,\n        description: texto, amount: numero, date: data };",
  "const campos = { category_id: categoriaSelecionada, type: tipo,\n        description: texto, amount: numero, date: data };\n      const camposEdicao = editandoImportado\n        ? { category_id: categoriaSelecionada }\n        : campos;",
);

app = app.replace(
  "? await supabase.from('transactions').update(campos)",
  "? await supabase.from('transactions').update(camposEdicao)",
);

app = app.replace(
  "disabled={ocupado} />\n            <Button title=\"Receita\"",
  "disabled={ocupado || editandoImportado} />\n            <Button title=\"Receita\"",
);
app = app.replace(
  "setTipo('income'); setCategoriaId(''); }} disabled={ocupado} />",
  "setTipo('income'); setCategoriaId(''); }} disabled={ocupado || editandoImportado} />",
);
app = app.replace(
  'onChangeText={setDescricao} maxLength={80} />',
  'onChangeText={setDescricao} maxLength={80} editable={!editandoImportado} />',
);
app = app.replace(
  'keyboardType="decimal-pad" value={valor} onChangeText={setValor} />',
  'keyboardType="decimal-pad" value={valor} onChangeText={setValor} editable={!editandoImportado} />',
);
app = app.replace(
  'onChangeText={setData} />',
  'onChangeText={setData} editable={!editandoImportado} />',
);
app = app.replace(
  "<Text style={styles.subtitulo}>{editandoId ? 'Editar lançamento' : 'Novo lançamento'}</Text>",
  "<Text style={styles.subtitulo}>{editandoImportado ? 'Alterar categoria do importado' : editandoId ? 'Editar lançamento' : 'Novo lançamento'}</Text>",
);
app = app.replace(
  "title={editandoId ? 'Salvar alterações' : 'Salvar lançamento'}",
  "title={editandoImportado ? 'Salvar categoria' : editandoId ? 'Salvar alterações' : 'Salvar lançamento'}",
);

if (!app.includes(".select('id, description, amount, date, type, category_id, source, account_name')") ||
    !app.includes('const camposEdicao = editandoImportado')) {
  throw new Error('Validacao final falhou. Nenhum arquivo foi alterado.');
}

const stamp = Date.now();
fs.copyFileSync(appFile, path.join(root, '..', `fintrack-antes-importados-v2-${stamp}.tsx`));
fs.copyFileSync(financeFile, path.join(root, '..', `finance-antes-importados-v2-${stamp}.ts`));
fs.writeFileSync(appFile, app, 'utf8');
fs.writeFileSync(financeFile, finance, 'utf8');
console.log('Interface de importados integrada. Backups criados fora do projeto.');
