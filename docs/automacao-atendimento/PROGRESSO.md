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

## Etapa 05: entrega e retomada

- **Fluxo:** o Copilot abre o PR (corpo com `Refs #N`; o controlador troca `Fixes/Closes #N` por `Refs #N` para a issue não fechar sozinha) → Revisor confere → o job `build` (`build.yml`) roda no commit atual → com revisão ok + build verde, `AUTO_MERGE=false` (padrão) deixa o PR para a demonstração e `AUTO_MERGE=true` integra exatamente esse commit, sem bypass das regras da branch → só depois do merge na `main` o N1 publica a resposta (id estável `entrega`, dizendo que o código foi integrado e que o app local precisa de `git pull` e reinício) e a issue é fechada. Dúvida de uso sem código recebe a resposta (`final`) e fecha a issue; esclarecimento pendente (`waiting-customer`) mantém o caso aberto.
- **Falhas:** build ou revisão (`revisor-falha`) reprovada → o controlador pede UMA correção ao Copilot, no mesmo PR, com o erro curto e o `requestId`. Se falhar de novo, fica `pendente-instrutor` e o instrutor decide. Merge recusado pela branch também vira pendência; nunca há bypass. Falha depois do merge só repete resposta/fechamento.
- **Retomar:** o controlador não guarda estado próprio; relê issue, comentários e PR e cada mensagem tem id estável, então rodar de novo não duplica nada. Para retomar um caso (ou depois de aprovar manualmente as Actions de um PR do Copilot, ou de um merge manual), use Actions → native-agents → Run workflow com o número da issue. Também reagem sozinhos: build terminado (`workflow_run`), push na `main` (merge) e eventos do PR.
- **Atenção:** PRs do Copilot exigem aprovação manual das Actions ("Approve workflows to run"), então o `build` e o controlador só rodam nesse PR depois dela.
- **Conferido (transporte simulado, sem rede):** entrega sem merge, merge do commit conferido, resposta única e fechamento, retomada sem duplicar, mensagem de entrega chegando ao ticket, merge recusado, uma rodada de correção e dúvida de uso sem código.
- **Não conferido:** execução real do `build.yml` e do novo controlador nas Actions (ainda não enviados ao GitHub).

## Chat ao vivo e respostas reais do N1

- **Sincronia:** com o chat aberto e o ticket em andamento, a tela chama `POST /api/tickets/:id/sync` a cada 6 s (e no botão **Atualizar**). O backend lê os comentários da issue e o relatório JSON do PR do Copilot (como dado, só PR `copilot/…` do repositório) e publica cada update do N1 assim que ele aparece, sem esperar as Actions. A mesma mensagem nunca duplica (chave `requestId:idDoUpdate`, igual à do controlador). Limite de 1 busca a cada 2 s por ticket.
- **Por que antes chegava tudo no fim:** o coordenador só criava o relatório no último commit. Agora o prompt manda criar o relatório no primeiro marco e rodar `report_progress` a cada marco.
- **Respostas reais:** o N1 não pode mandar aviso genérico ("recebemos/registramos"); cada mensagem precisa citar o que foi entendido, encontrado ou feito naquele marco. O app não tem nenhuma resposta automática.
- **Ainda não faz:** mensagens digitadas no chat depois de abrir o ticket ficam só no app; não são enviadas à issue nem ao agente.

## Base de conhecimento (`docs/knowledge/`)

- **O que é:** uma entrada Markdown (frontmatter + Pedido, Causa, Solução, Como foi verificado, Para reutilizar) por pedido resolvido, no próprio repositório. Formato e regras em `docs/knowledge/README.md`; modelo em `_modelo.md`.
- **Consulta:** todos os agentes leem e buscam na base antes de trabalhar e citam o `id` usado.
- **Escrita:** o Coordenador cria `docs/knowledge/<requestId>.md` no mesmo PR (também em pedidos sem código). O controlador só libera a integração quando o arquivo existe no commit do PR.
- **Retroativo:** PRs/issues já fechados: PR #2 + issue #1 → `req-9fcf2326.md` (único caso até agora).
- **Limites:** PR feito por pessoa, ou issue fechada fora do fluxo, não gera entrada sozinho (usar `pr-<número>.md` à mão). Pedido sem código fica em PR rascunho que não é integrado, então a entrada dele só chega à `main` se alguém integrar o PR.
