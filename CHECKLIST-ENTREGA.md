# Checklist final de entrega

## Código e testes

- [ ] `npx tsc --noEmit` termina sem erros
- [ ] Os 52 testes automatizados passam
- [ ] `npx expo-doctor` termina sem problemas
- [ ] Cadastro, login, logout e sessão persistente foram testados
- [ ] CRUD manual foi testado
- [ ] Painel, gráfico, busca, filtros, agrupamento e CSV foram testados
- [ ] Duas contas não enxergam dados uma da outra

## Open Finance Sandbox

- [ ] O widget abre sem sobreposição
- [ ] O Pluggy Bank Sandbox conecta
- [ ] A primeira sincronização importa lançamentos
- [ ] A segunda sincronização não duplica lançamentos
- [ ] Um importado permite apenas recategorização
- [ ] A categoria corrigida permanece após sincronizar novamente
- [ ] Desconectar revoga o consentimento no Pluggy
- [ ] Desconectar remove os importados
- [ ] Desconectar preserva os manuais

## Segurança

- [ ] `.env` não está versionado
- [ ] `supabase/.temp` não está versionado
- [ ] Nenhum backup ou ZIP está versionado
- [ ] Nenhum Client Secret ou chave secreta aparece no Git
- [ ] Os Secrets do Pluggy existem apenas no Supabase
- [ ] A demonstração usa dados sintéticos

## Documentação e GitHub

- [ ] README revisado
- [ ] Capturas adicionadas em `docs/`
- [ ] Commits organizados
- [ ] Árvore de trabalho limpa
- [ ] Repositório remoto criado vazio
- [ ] Branch principal publicada
- [ ] README renderiza corretamente no GitHub
