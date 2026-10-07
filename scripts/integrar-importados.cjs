const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const appFile = path.join(root, 'app/index.tsx');
const financeFile = path.join(root, 'src/domain/finance.ts');

let app = fs.readFileSync(appFile, 'utf8');
let finance = fs.readFileSync(financeFile, 'utf8');

if (app.includes('const [editandoImportado, setEditandoImportado]')) {
  console.log('Interface de importados ja integrada.');
  process.exit(0);
}

const required = [
  "const [editandoId, setEditandoId] = useState<string | null>(null);",
  ".select('id, description, amount, date, type, category_id')",
  'function iniciarEdicao(item: Lancamento) {',
  'const campos = { category_id: categoriaSelecionada, type: tipo,',
  "? await supabase.from('transactions').update(campos)",
  'title={editandoId ? \'Salvar alterações\' : \'Salvar lançamento\'}',
];

for (const text of required) {
  if (!app.includes(text)) {
    throw new Error(`Estrutura inesperada em app/index.tsx. Nao encontrei: ${text}`);
  }
}

if (!finance.includes("type Lancamento") && !finance.includes("interface Lancamento")) {
  throw new Error('Tipo Lancamento nao encontrado. Nenhum arquivo foi alterado.');
}

// 1. Expand the shared transaction type. Optional fields keep existing tests and fixtures valid.
const typeNeedle = "  type: Tipo; category_id: string };";
if (!finance.includes(typeNeedle)) {
  throw new Error('Formato do tipo Lancamento diferente do esperado. Nenhum arquivo foi alterado.');
}
finance = finance.replace(
  typeNeedle,
  "  type: Tipo; category_id: string; source?: 'manual' | 'open_finance'; account_name?: string | null };",
);

// 2. Load the origin fields in every transaction query used by the screen.
app = app.replaceAll(
  ".select('id, description, amount, date, type, category_id')",
  ".select('id, description, amount, date, type, category_id, source, account_name')",
);

// 3. Track whether the active edit is an imported entry.
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

// 4. Imported entries update category only. Manual entries keep the existing full edit.
app = app.replace(
  "const campos = { category_id: categoriaSelecionada, type: tipo,\n        description: texto, amount: numero, date: data };",
  "const campos = { category_id: categoriaSelecionada, type: tipo,\n        description: texto, amount: numero, date: data };\n      const camposEdicao = editandoImportado\n        ? { category_id: categoriaSelecionada }\n        : campos;",
);

app = app.replace(
  "? await supabase.from('transactions').update(campos)",
  "? await supabase.from('transactions').update(camposEdicao)",
);

// 5. Prevent impossible actions in the form while recategorizing an imported entry.
app = app.replace(
  '<Button title="Despesa" onPress={() => { setTipo(\'expense\'); setCategoriaId(\'\'); }} disabled={ocupado} />',
  '<Button title="Despesa" onPress={() => { setTipo(\'expense\'); setCategoriaId(\'\'); }} disabled={ocupado || editandoImportado} />',
);
app = app.replace(
  '<Button title="Receita" onPress={() => { setTipo(\'income\'); setCategoriaId(\'\'); }} disabled={ocupado} />',
  '<Button title="Receita" onPress={() => { setTipo(\'income\'); setCategoriaId(\'\'); }} disabled={ocupado || editandoImportado} />',
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

const stamp = Date.now();
fs.copyFileSync(appFile, path.join(root, '..', `fintrack-antes-importados-${stamp}.tsx`));
fs.copyFileSync(financeFile, path.join(root, '..', `finance-antes-importados-${stamp}.ts`));
fs.writeFileSync(appFile, app, 'utf8');
fs.writeFileSync(financeFile, finance, 'utf8');
console.log('Interface de importados integrada. Backups criados fora do projeto.');
