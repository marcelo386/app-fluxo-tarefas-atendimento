# Progresso: automação do atendimento

## Etapa 00: preparar o projeto e o acesso

- **Cópia:** https://github.com/marcelo386/app-fluxo-tarefas-atendimento (pública; origem: App-Fluxo-Tarefas-V1 do professor, sem remote para o original).
- **Pasta local:** `Documents/GitHub/CursoThulio/App-Fluxo-Tarefas-V1`.
- **Node:** v22.23.2 (o projeto pede >=22.13).
- **Instalar:** `npm install` (0 vulnerabilidades).
- **Abrir o app:** `npm run dev` → interface http://127.0.0.1:5173, API http://127.0.0.1:3001/api. Respondem 200 (`/` e `/api/saude`).
- **Build:** `npm run build` → OK (vite, 3,43 s).
- **Dados locais:** banco SQLite em `server/dados/` (fora do git), preservado. Não há `.env` no projeto.

## Acesso ao GitHub

- Actions habilitadas no repositório (`allowed_actions: all`).
- GitHub Copilot cloud agent: **não consegui confirmar** o plano pago pela CLI (o token não tem escopo para isso). Pendência: confirmar em github.com/settings/copilot.
- Secret `COPILOT_AGENT_TOKEN`: ainda não existe no repositório. Ele é separado de qualquer credencial local do backend e será criado em etapa própria. Nunca registrar o valor aqui.

## Ainda não feito (de propósito)

- Nenhuma configuração remota, nenhum ticket de teste.
- (Os agents em `.github/agents/` foram criados na Etapa 02.)

## Etapa 03: app, issue e coordenador

- **Fluxo:** ticket novo → o backend grava `requestId`/fase no SQLite e cria UMA issue `origin:app` (a mesma serve ao Copilot) → o workflow `native-agents.yml` roda `scripts/controlador.mjs`, que atribui a issue ao Copilot com `custom_agent=coordenador` → o controlador comenta o resumo interno e a mensagem do N1 na issue → o app lê esses comentários (só do `github-actions[bot]`) e mostra a mensagem no ticket.
- **Código:** `server/src/github.js` (ponte), `scripts/controlador.mjs`, `.github/workflows/native-agents.yml`, migração nova no fim de `server/src/db.js` (colunas `issue_number`, `request_id`, `pr_number`, `phase`, `sent_ids` em `ticket`).
- **Ligar:** copie `.env.example` para `.env`. `AGENT_RUNTIME=github-native` escolhe o caminho; `AGENT_DRY_RUN=true` (padrão) não faz nenhuma chamada. Nas Actions: variáveis `AGENT_RUNTIME` e `AGENT_DRY_RUN`, secret `COPILOT_AGENT_TOKEN` (só para atribuir; o resto usa o `GITHUB_TOKEN` efêmero).
- **Conferido localmente (dados fictícios, `fetch` falso, sem chamada paga):** ticket criado e lido, relação gravada em modo ensaio, corpo da atribuição, issue criada uma única vez mesmo após erro de rede, mensagem publicada uma só vez, comentário de terceiros ignorado, funções do controlador. `npm test` (28) e `npm run build` OK.
- **Não conferido:** execução real do workflow, atribuição real ao Copilot, ensaio nas Actions.
- **Motor antigo:** não existe nesta cópia; nada a suspender.
