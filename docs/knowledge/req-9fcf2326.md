---
id: req-9fcf2326
title: Cartão arrastado para outra lista voltava ao lugar
type: bugfix
status: merged
requestId: req-9fcf2326
issue: 1
pr: 2
date: 2026-11-11
areas: [quadro]
files: [client/src/Cartao.jsx, client/src/Lista.jsx, client/src/TelaQuadro.jsx]
tags: [drag-and-drop, cartao, lista, dataTransfer, mover-cartao]
summary: O drop dependia de estado que o dragend podia limpar antes; o id do cartão passou a viajar no dataTransfer com um tipo próprio.
---

## Pedido

Ticket de teste (dados fictícios): ao arrastar um cartão para outra lista ele voltava para o lugar. Esperado: o cartão fica na lista de destino.

## Causa

Segundo o relatório do Copilot, o `onDrop` identificava o cartão pelo estado `arrastando` da tela, que o `dragend` podia limpar antes do drop. Sem o id, o drop não movia nada e o cartão parecia voltar. O id também ia como `text/plain`, um tipo genérico demais para distinguir o arrasto de um cartão do app.

## Solução

- `Cartao.jsx`: o `dragstart` grava o id do cartão em `dataTransfer` com o tipo próprio `application/x-fluxo-cartao`.
- `Lista.jsx`: o `onDrop` só aceita o arrasto se esse tipo estiver presente e passa o id lido do `dataTransfer` para `aoSoltar(lista.id, cartaoId)`.
- `TelaQuadro.jsx`: `soltar(listaId, cartaoArrastadoId)` usa o id recebido, ignora ids que não existem no quadro atual e a lista de destino inexistente, e então chama `aoSoltarCartao`.

Nenhuma mudança na API nem no banco.

## Como foi verificado

O Copilot relatou `npm run build` e `npm test` aprovados (28 testes) e uma conferência manual no Chromium, recarregando o quadro. O diff foi lido na revisão do PR. Não há teste automatizado novo para o arrasto.

## Para reutilizar

- Em arrastar e soltar, prefira levar a identidade do item no `dataTransfer` com um tipo próprio do app, em vez de depender só de estado React, que pode mudar entre `dragend` e `drop`.
- Eventos de arrasto não podem ser testados só com `npm test` (a lógica pura está em `client/src/ordem.js`); confira no navegador.
- Fluxo da entrega: issue `origin:app` → PR `copilot/req-9fcf2326-fix-cartao-move`, mergeado em 2026-11-11.
