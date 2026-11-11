import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { criarApp } from "../src/app.js";

let base, servidor;
const chamar = async (metodo, caminho, corpo) => {
  const r = await fetch(base + caminho, { method: metodo, headers: { "content-type": "application/json" }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  return { status: r.status, dados: r.status === 204 ? null : await r.json() };
};

before(async () => {
  ({ servidor } = criarApp());
  await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});
after(() => servidor.close());

test("seed: existe um ticket de exemplo com conversa", async () => {
  const { dados } = await chamar("GET", "/api/tickets");
  assert.ok(dados.tickets.length >= 1);
  const exemplo = dados.tickets.find((t) => t.id === "ticket-boas-vindas");
  assert.equal(exemplo.status, "resolved");
  assert.equal(typeof exemplo.preview, "string");
  const conversa = (await chamar("GET", "/api/tickets/ticket-boas-vindas")).dados;
  assert.deepEqual(conversa.messages.map((m) => m.author), ["user", "agent"]);
});

test("abrir ticket exige título e descrição; a descrição vira a primeira mensagem", async () => {
  const r = await chamar("POST", "/api/tickets", { title: "  Erro ao criar quadro  ", description: "  Não consigo criar um quadro\ncomo faço?  " });
  assert.equal(r.status, 201);
  assert.equal(r.dados.ticket.title, "Erro ao criar quadro");
  assert.equal(r.dados.ticket.status, "open");
  assert.equal(r.dados.messages.length, 1);
  assert.deepEqual([r.dados.messages[0].author, r.dados.messages[0].content], ["user", "Não consigo criar um quadro\ncomo faço?"]);
  assert.equal((await chamar("POST", "/api/tickets", { title: "Só título", description: "   " })).status, 400);
  assert.equal((await chamar("POST", "/api/tickets", { title: " ", description: "Só descrição" })).status, 400);
  assert.equal((await chamar("POST", "/api/tickets", {})).status, 400);
  assert.equal((await chamar("POST", "/api/tickets", { title: "a".repeat(121), description: "x" })).status, 400);
});

test("mensagens: usuário e agente, em ordem, e o ticket sobe na listagem", async () => {
  const { ticket } = (await chamar("POST", "/api/tickets", { title: "Primeira", description: "Primeira" })).dados;
  const outro = (await chamar("POST", "/api/tickets", { title: "Outro ticket", description: "Outro ticket" })).dados.ticket;
  assert.equal((await chamar("GET", "/api/tickets")).dados.tickets[0].id, outro.id);
  const resp = await chamar("POST", `/api/tickets/${ticket.id}/messages`, { content: "Olá, posso ajudar", author: "agent" });
  assert.equal(resp.status, 201);
  assert.equal(resp.dados.message.author, "agent");
  await chamar("POST", `/api/tickets/${ticket.id}/messages`, { content: "Obrigado" });
  const conversa = (await chamar("GET", `/api/tickets/${ticket.id}`)).dados;
  assert.deepEqual(conversa.messages.map((m) => [m.author, m.content]), [["user", "Primeira"], ["agent", "Olá, posso ajudar"], ["user", "Obrigado"]]);
  const lista = (await chamar("GET", "/api/tickets")).dados.tickets;
  assert.equal(lista[0].id, ticket.id);
  assert.equal(lista[0].preview, "Obrigado");
});

test("mensagem inválida: autor desconhecido, vazia ou ticket inexistente", async () => {
  const { ticket } = (await chamar("POST", "/api/tickets", { title: "x", description: "x" })).dados;
  assert.equal((await chamar("POST", `/api/tickets/${ticket.id}/messages`, { content: "oi", author: "robo" })).status, 400);
  assert.equal((await chamar("POST", `/api/tickets/${ticket.id}/messages`, { content: " " })).status, 400);
  assert.equal((await chamar("POST", "/api/tickets/nao-existe/messages", { content: "oi" })).status, 404);
  assert.equal((await chamar("GET", "/api/tickets/nao-existe")).status, 404);
});

test("status: editar, validar e reabrir ao receber mensagem", async () => {
  const { ticket } = (await chamar("POST", "/api/tickets", { title: "Preciso de ajuda", description: "Preciso de ajuda" })).dados;
  const resolvido = (await chamar("PATCH", `/api/tickets/${ticket.id}`, { status: "resolved" })).dados.ticket;
  assert.equal(resolvido.status, "resolved");
  assert.equal(resolvido.title, "Preciso de ajuda");
  assert.equal((await chamar("PATCH", `/api/tickets/${ticket.id}`, { status: "qualquer" })).status, 400);
  const renomeado = (await chamar("PATCH", `/api/tickets/${ticket.id}`, { title: "Novo nome" })).dados.ticket;
  assert.deepEqual([renomeado.title, renomeado.status], ["Novo nome", "resolved"]);
  const apos = (await chamar("POST", `/api/tickets/${ticket.id}/messages`, { content: "Ainda com problema" })).dados;
  assert.equal(apos.ticket.status, "open");
});

test("excluir ticket apaga as mensagens em cascata", async () => {
  const { ticket } = (await chamar("POST", "/api/tickets", { title: "Apagar", description: "Apagar" })).dados;
  assert.deepEqual((await chamar("DELETE", `/api/tickets/${ticket.id}`)).dados, { ok: true });
  assert.equal((await chamar("GET", `/api/tickets/${ticket.id}`)).status, 404);
  assert.equal((await chamar("DELETE", `/api/tickets/${ticket.id}`)).status, 404);
});
