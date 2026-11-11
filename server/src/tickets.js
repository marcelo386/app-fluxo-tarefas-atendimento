// Atendimento: tickets de suporte, cada um uma conversa (mensagens do usuário e dos agentes).
// Contrato JSON em inglês, sem exigir login (como os quadros).
// Agentes autônomos respondem com POST /api/tickets/:id/messages { author: "agent", content }.
import { randomUUID } from "node:crypto";
import { invalido, naoEncontrado, texto } from "./http.js";
import { transacao } from "./db.js";
import { iniciarIssue } from "./github.js";

export const STATUS = ["open", "in_progress", "resolved"];
export const AUTORES = ["user", "agent"];

const saidaTicket = (t) => ({
  id: t.id, title: t.title, status: t.status, createdAt: t.created_at, updatedAt: t.updated_at,
  ...(t.preview !== undefined ? { preview: t.preview } : {}),
});
const saidaMensagem = (m) => ({ id: m.id, ticketId: m.ticket_id, author: m.author, content: m.content, createdAt: m.created_at });

export function rotasDeTickets(app, db, github = { nativo: false }) {
  const buscar = (id) => {
    const t = db.prepare("SELECT * FROM ticket WHERE id = ?").get(id);
    if (!t) throw naoEncontrado("Ticket");
    return t;
  };
  const mensagens = (ticketId) =>
    db.prepare("SELECT * FROM ticket_message WHERE ticket_id = ? ORDER BY created_at, rowid").all(ticketId).map(saidaMensagem);
  const inserirMensagem = (ticketId, author, content) => {
    const m = { id: randomUUID(), ticket_id: ticketId, author, content, created_at: new Date().toISOString() };
    db.prepare("INSERT INTO ticket_message (id, ticket_id, author, content, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(m.id, m.ticket_id, m.author, m.content, m.created_at);
    db.prepare("UPDATE ticket SET updated_at = ? WHERE id = ?").run(m.created_at, ticketId);
    return m;
  };

  // Mais recente primeiro; `preview` é o começo da última mensagem.
  app.get("/api/tickets", () => ({
    tickets: db.prepare(
      `SELECT t.*, (SELECT substr(content, 1, 120) FROM ticket_message m WHERE m.ticket_id = t.id ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS preview
       FROM ticket t ORDER BY t.updated_at DESC, t.rowid DESC`,
    ).all().map(saidaTicket),
  }));

  // Abrir um ticket = título + descrição (como uma issue); a descrição vira a primeira mensagem do usuário.
  app.post("/api/tickets", ({ corpo }) => {
    const title = texto(corpo, "title", { max: 120 });
    const content = texto(corpo, "description", { max: 4000 }); // a descrição é a primeira mensagem
    const agora = new Date().toISOString();
    const id = randomUUID();
    const primeira = transacao(db, () => {
      db.prepare("INSERT INTO ticket (id, title, status, created_at, updated_at) VALUES (?, ?, 'open', ?, ?)").run(id, title, agora, agora);
      return inserirMensagem(id, "user", content);
    });
    if (github.nativo) void iniciarIssue(db, id, github); // grava requestId/fase já; a rede roda depois
    return { ticket: saidaTicket(buscar(id)), messages: [saidaMensagem(primeira)] };
  });

  app.get("/api/tickets/:id", ({ params }) => {
    const t = buscar(params.id);
    return { ticket: saidaTicket(t), messages: mensagens(t.id) };
  });

  app.post("/api/tickets/:id/messages", ({ params, corpo }) => {
    const t = buscar(params.id);
    const content = texto(corpo, "content", { max: 4000 });
    const author = corpo.author ?? "user";
    if (!AUTORES.includes(author)) throw invalido(`author deve ser um de: ${AUTORES.join(", ")}.`);
    // Quem escreve num ticket resolvido o reabre.
    if (t.status === "resolved") db.prepare("UPDATE ticket SET status = 'open' WHERE id = ?").run(t.id);
    const message = transacao(db, () => inserirMensagem(t.id, author, content));
    return { message: saidaMensagem(message), ticket: saidaTicket(buscar(t.id)) };
  });

  app.patch("/api/tickets/:id", ({ params, corpo }) => {
    const t = buscar(params.id);
    const title = texto(corpo, "title", { max: 120, opcional: true }) ?? t.title;
    const status = corpo.status ?? t.status;
    if (!STATUS.includes(status)) throw invalido(`status deve ser um de: ${STATUS.join(", ")}.`);
    db.prepare("UPDATE ticket SET title = ?, status = ? WHERE id = ?").run(title, status, t.id);
    return { ticket: saidaTicket(buscar(t.id)) };
  });

  app.delete("/api/tickets/:id", ({ params }) => {
    const t = buscar(params.id);
    db.prepare("DELETE FROM ticket WHERE id = ?").run(t.id); // mensagens caem em cascata
    return { ok: true };
  });
}
