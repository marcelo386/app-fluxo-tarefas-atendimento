// Lógica pura do atendimento (sem React), testada sem navegador.

export const STATUS = {
  open: "Aberto",
  in_progress: "Em atendimento",
  resolved: "Resolvido",
};

export const rotuloStatus = (status) => STATUS[status] ?? status;

const inicioDoDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const DIA = 24 * 60 * 60 * 1000;

/** Grupo de data estilo ChatGPT: Hoje, Ontem, Últimos 7 dias, Mais antigos. */
export function grupoDaData(iso, agora = new Date()) {
  const dias = Math.round((inicioDoDia(agora) - inicioDoDia(new Date(iso))) / DIA);
  if (dias <= 0) return "Hoje";
  if (dias === 1) return "Ontem";
  if (dias <= 7) return "Últimos 7 dias";
  return "Mais antigos";
}

/** Agrupa tickets (já ordenados do mais recente) mantendo a ordem dos grupos. */
export function agruparTickets(tickets, agora = new Date()) {
  const grupos = [];
  for (const t of tickets) {
    const titulo = grupoDaData(t.updatedAt, agora);
    const atual = grupos[grupos.length - 1];
    if (atual && atual.titulo === titulo) atual.tickets.push(t);
    else grupos.push({ titulo, tickets: [t] });
  }
  return grupos;
}

export const horaCurta = (iso) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Mudou algo na conversa que valha re-renderizar? Evita trocar o estado a cada consulta. */
export function conversaMudou(antes, depois) {
  if (!antes || !depois) return true;
  const a = antes.messages, b = depois.messages;
  return a.length !== b.length || a[a.length - 1]?.id !== b[b.length - 1]?.id
    || antes.ticket.status !== depois.ticket.status || antes.ticket.title !== depois.ticket.title;
}
