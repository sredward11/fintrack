# FinTrack

Aplicativo de finanças pessoais desenvolvido com React Native e Expo. O projeto permite registrar lançamentos manuais, acompanhar o resumo mensal e importar transações de uma conexão bancária de teste por meio do Pluggy Sandbox.

## Funcionalidades

- Cadastro, login, logout e sessão persistente com Supabase Auth
- Isolamento de dados por usuário com Row Level Security
- Criação, edição e exclusão de receitas e despesas manuais
- Categorias separadas por tipo de lançamento
- Painel mensal com receitas, despesas, saldo e gráfico por categoria
- Busca, filtros e agrupamento dos lançamentos por dia
- Exportação mensal em CSV no navegador e no celular
- Conexão de teste com Pluggy Bank Sandbox
- Importação bancária idempotente, sem duplicar lançamentos
- Recategorização de lançamentos importados sem alterar valor, data ou descrição
- Sincronização incremental da conexão bancária
- Revogação do consentimento e remoção dos dados importados
- Preservação dos lançamentos manuais ao desconectar o banco
- Testes automatizados para regras financeiras, agrupamento e Open Finance

## Tecnologias

- React Native
- Expo e Expo Router
- TypeScript
- Supabase Auth, Postgres, RLS e Edge Functions
- Pluggy Connect e Pluggy Sandbox
- react-native-svg
- Node.js Test Runner

## Segurança e privacidade

- O `PLUGGY_CLIENT_SECRET` permanece somente nos Secrets das Edge Functions.
- O aplicativo usa apenas a chave pública do Supabase.
- As Edge Functions validam a sessão e a propriedade da conexão bancária.
- Dados bancários reais não são necessários para a demonstração.
- A demonstração recomendada usa apenas dados sintéticos do Pluggy Bank Sandbox.
- O acesso bancário é somente leitura e pode ser revogado pelo usuário.

## Pré-requisitos

- Node.js e npm
- Expo Go para testar em dispositivo físico
- Projeto próprio no Supabase
- Aplicação de desenvolvimento no Pluggy

## Configuração local

1. Instale as dependências:

```bash
npm ci
```

2. Crie o arquivo `.env` na raiz a partir deste modelo:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=URL_DO_SEU_PROJETO
EXPO_PUBLIC_SUPABASE_KEY=CHAVE_PUBLICA_DO_SEU_PROJETO
EXPO_PUBLIC_OPEN_FINANCE_SANDBOX=true
```

3. Nunca coloque no `.env` do aplicativo:

```text
PLUGGY_CLIENT_SECRET
SUPABASE_SERVICE_ROLE_KEY
sb_secret_...
```

4. Aplique o schema e a migração no seu próprio projeto Supabase:

```text
supabase/schema.sql
supabase/migrations/202610060001_openfinance.sql
```

5. Cadastre nos Secrets das Edge Functions:

```text
PLUGGY_CLIENT_ID
PLUGGY_CLIENT_SECRET
```

6. Publique as funções no projeto correto:

```bash
npx supabase functions deploy bank-connect-token --project-ref SEU_REFERENCE_ID
npx supabase functions deploy bank-sync --project-ref SEU_REFERENCE_ID
npx supabase functions deploy bank-disconnect --project-ref SEU_REFERENCE_ID
```

7. Inicie o aplicativo:

```bash
npx expo start
```

## Verificações automáticas

```bash
npx tsc --noEmit
node --test tests/finance.test.cjs tests/grouping.test.cjs tests/openfinance.test.cjs
npx expo-doctor
```

O conjunto atual contém 52 casos automatizados. Os testes locais não substituem a validação das Edge Functions publicadas, do RLS e do fluxo no aparelho.

## Demonstração com dados sintéticos

No widget, selecione apenas o conector Sandbox / Pluggy Bank.

```text
Usuário: user-ok
Senha: password-ok
MFA, quando solicitado: 123456
```

Roteiro sugerido:

1. Entrar no aplicativo.
2. Criar um lançamento manual.
3. Conferir painel, gráfico, busca e filtros.
4. Conectar o Pluggy Bank Sandbox.
5. Sincronizar e mostrar os lançamentos importados.
6. Sincronizar novamente e confirmar ausência de duplicação.
7. Alterar somente a categoria de um importado.
8. Exportar o CSV.
9. Desconectar o banco e confirmar que os importados foram removidos e os manuais preservados.

## Capturas de tela

Adicione as imagens na pasta `docs` antes da entrega:

| Login | Painel | Lançamentos | Conexão Sandbox |
| --- | --- | --- | --- |
| `docs/login.png` | `docs/painel.png` | `docs/lancamentos.png` | `docs/bancos.png` |

## Estrutura principal

```text
app/                             Tela principal e fluxo do aplicativo
src/components/                  Componentes de interface
src/domain/                      Regras financeiras e agrupamento
supabase/functions/              Edge Functions do Open Finance
supabase/migrations/             Migrações incrementais do banco
tests/                           Testes automatizados
docs/                            Capturas para o README
```

## Limitações

- Integração demonstrada com o Pluggy Bank Sandbox e dados sintéticos.
- O ambiente Sandbox pode variar os dados retornados.
- O projeto não executa pagamentos, transferências ou qualquer movimentação financeira.
- Antes de uso real, são necessárias revisões adicionais de segurança, privacidade, conformidade e operação.

## Autor

Carlos Eduardo Mendonça de Morais

## Contexto acadêmico

Projeto desenvolvido como atividade acadêmica de Programação para Dispositivos Móveis. 
