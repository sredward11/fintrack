# Política de segurança

## Segredos

Não publique ou compartilhe:

- `PLUGGY_CLIENT_SECRET`
- chaves secretas ou `service_role` do Supabase
- tokens de sessão
- Connect Tokens do Pluggy
- senhas, credenciais bancárias ou arquivos `.env`

A chave pública do Supabase pode estar no aplicativo, mas o acesso aos dados depende das políticas de Row Level Security e da autenticação do usuário.

## Demonstração

Use somente o Pluggy Bank Sandbox e dados sintéticos. Não projete dados bancários reais.

## Relato de falha

Não abra uma issue pública contendo credenciais, tokens ou dados pessoais. Revogue imediatamente qualquer segredo exposto antes de continuar a investigação.
