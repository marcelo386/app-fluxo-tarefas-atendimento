import assert from "node:assert/strict";
import { test } from "node:test";
import { agruparTickets, conversaMudou, grupoDaData, rotuloStatus } from "../src/tickets.js";

const agora = new Date(2026, 10, 11, 15, 0, 0); // 11/11/2026 15h local
const dia = (n, h = 10) => new Date(2026, 10, 11 - n, h).toISOString();

test("grupoDaData separa hoje, ontem, semana e antigos", () => {
  assert.equal(grupoDaData(dia(0, 8), agora), "Hoje");
  assert.equal(grupoDaData(dia(1, 23), agora), "Ontem");
  assert.equal(grupoDaData(dia(5), agora), "Últimos 7 dias");
  assert.equal(grupoDaData(dia(30), agora), "Mais antigos");
});

test("agruparTickets mantém a ordem e junta vizinhos do mesmo grupo", () => {
  const t = (id, n) => ({ id, updatedAt: dia(n) });
  const grupos = agruparTickets([t("a", 0), t("b", 0), t("c", 1), t("d", 20)], agora);
  assert.deepEqual(grupos.map((g) => [g.titulo, g.tickets.map((x) => x.id)]), [["Hoje", ["a", "b"]], ["Ontem", ["c"]], ["Mais antigos", ["d"]]]);
  assert.deepEqual(agruparTickets([], agora), []);
});

test("rotuloStatus traduz e devolve o valor desconhecido", () => {
  assert.equal(rotuloStatus("resolved"), "Resolvido");
  assert.equal(rotuloStatus("xyz"), "xyz");
});

test("conversaMudou detecta mensagem nova ou status diferente", () => {
  const base = { ticket: { status: "open", title: "t" }, messages: [{ id: "1" }] };
  assert.equal(conversaMudou(base, { ...base, messages: [{ id: "1" }] }), false);
  assert.equal(conversaMudou(base, { ...base, messages: [{ id: "1" }, { id: "2" }] }), true);
  assert.equal(conversaMudou(base, { ...base, ticket: { status: "resolved", title: "t" } }), true);
  assert.equal(conversaMudou(null, base), true);
});
