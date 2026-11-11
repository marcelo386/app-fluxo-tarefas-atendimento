# Produto: Fluxo (App Fluxo Tarefas)

Quadro de tarefas no estilo Trello. Roda local: interface React/Vite, API Node e banco SQLite. Não exige login.

## Como usar

- **Abrir o app:** `npm run dev` e acessar http://127.0.0.1:5173. A página inicial é a apresentação; "Abrir meus quadros" leva ao app (`/quadro`).
- **Quadro:** um por projeto. Crie com o "+" da barra lateral. Renomear e excluir pelos ícones de lápis e lixeira. Excluir um quadro apaga suas listas e cartões.
- **Lista:** uma etapa do trabalho (ex.: "A fazer"). Use "Adicionar lista" no quadro. O menu da lista tem "Renomear lista" e "Excluir lista" (apaga os cartões dela).
- **Cartão:** uma tarefa, com título e descrição opcional. "Adicionar cartão" na lista. O menu do cartão tem "Editar cartão", "Mover para" (escolhe a lista de destino) e "Excluir cartão". Também dá para arrastar o cartão entre listas.
- **Atendimento:** o item "Atendimento" da barra lateral abre tickets de suporte em formato de conversa. Para abrir um, informe título e descrição. Um ticket pode ficar Aberto, Em atendimento ou Resolvido.

## Limites conhecidos

- Títulos: quadro e lista até 120 caracteres, cartão até 200. Descrição do cartão até 2000.
- Sem contas, login, equipes ou compartilhamento de quadros.
- Os dados ficam no banco SQLite local (`server/dados/`); não há nuvem.

## Onde está o código de produto

Quadros, listas e cartões: `client/src/TelaQuadro.jsx`, `Lista.jsx`, `Cartao.jsx`, `ordem.js` e `server/src/quadros.js`. Telas, componentes e estilos: `client/src/*.jsx`, `componentes/` e os `.css` (veja a política). A API está descrita no `README.md`.
