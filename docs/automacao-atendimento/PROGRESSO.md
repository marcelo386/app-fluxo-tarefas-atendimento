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
- Arquivos `.github/agents/*.agent.md` ainda não existem.
