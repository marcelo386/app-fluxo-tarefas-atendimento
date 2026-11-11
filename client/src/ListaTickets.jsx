import { Botao } from "./componentes/Botao.jsx";
import { agruparTickets } from "./tickets.js";

/** Lista de conversas na lateral, agrupada por data, como no ChatGPT. */
export function ListaTickets({ tickets, ticketId, aoSelecionar, aoNovo }) {
  return (
    <div className="tickets-lateral">
      <Botao className="botao-bloco novo-ticket" icone="mais" onClick={aoNovo}>Novo ticket</Botao>

      {tickets === null ? (
        <p className="lateral-vazio">Carregando tickets…</p>
      ) : tickets.length === 0 ? (
        <p className="lateral-vazio">Nenhum ticket ainda. Descreva seu problema ao lado para abrir o primeiro.</p>
      ) : (
        <nav aria-label="Tickets de atendimento" className="tickets-grupos">
          {agruparTickets(tickets).map((grupo) => (
            <section key={grupo.titulo} className="tickets-grupo">
              <h3 className="tickets-grupo-titulo">{grupo.titulo}</h3>
              <ul className="lateral-lista">
                {grupo.tickets.map((t) => (
                  <li key={t.id}>
                    <div className="lateral-item" data-ativo={t.id === ticketId ? "" : undefined}>
                      <button
                        type="button"
                        className="lateral-escolha ticket-escolha"
                        aria-current={t.id === ticketId ? "page" : undefined}
                        title={t.title}
                        onClick={() => aoSelecionar(t.id)}
                      >
                        <span className="ticket-ponto" data-status={t.status} aria-hidden="true" />
                        <span className="ticket-titulo">{t.title}</span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      )}
    </div>
  );
}
