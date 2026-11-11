import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Botao } from "./componentes/Botao.jsx";
import { Campo } from "./componentes/Campo.jsx";
import { Confirmar } from "./componentes/Confirmar.jsx";
import { Icone } from "./componentes/Icone.jsx";
import { horaCurta, rotuloStatus } from "./tickets.js";

const SUGESTOES = [
  "Não consigo mover um cartão entre listas",
  "Como renomear ou excluir um quadro?",
  "Encontrei um erro na tela e preciso de ajuda",
];

/** Caixa de mensagem arredondada: Enter envia, Shift+Enter quebra linha. */
function Compositor({ texto, aoMudar, aoEnviar, enviando, placeholder, autoFocus }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [texto]);

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  const pode = texto.trim().length > 0 && !enviando;
  const enviar = () => { if (pode) void aoEnviar(); };

  return (
    <form className="compositor" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
      <textarea
        ref={ref}
        className="compositor-texto"
        rows={1}
        value={texto}
        maxLength={4000}
        placeholder={placeholder}
        aria-label="Mensagem para o atendimento"
        onChange={(e) => aoMudar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            enviar();
          }
        }}
      />
      <button type="submit" className="compositor-enviar" disabled={!pode} aria-label="Enviar mensagem">
        <Icone nome="enviar" tamanho={18} />
      </button>
    </form>
  );
}

function Mensagem({ mensagem }) {
  const agente = mensagem.author === "agent";
  return (
    <article className="msg" data-autor={mensagem.author}>
      {agente ? (
        <span className="msg-avatar" aria-hidden="true"><Icone nome="agente" tamanho={18} /></span>
      ) : null}
      <div className="msg-corpo">
        <p className="msg-nome">
          {agente ? "Agente de suporte" : "Você"}
          <time dateTime={mensagem.createdAt}>{horaCurta(mensagem.createdAt)}</time>
        </p>
        <p className="msg-texto">{mensagem.content}</p>
      </div>
    </article>
  );
}

/** Área principal do atendimento: ticket novo (tela de boas-vindas) ou conversa aberta. */
export function TelaAtendimento({ ticketId, conversa, enviando, erro, aoAbrirTicket, aoEnviar, aoMudarStatus, aoExcluir, aoRecarregar }) {
  const [rascunho, setRascunho] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const fim = useRef(null);
  const qtd = conversa?.messages.length ?? 0;

  // Troca de ticket = rascunho novo.
  useEffect(() => { setRascunho(""); }, [ticketId]);

  // Rola para a última mensagem quando chega mensagem nova ou a conversa abre.
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [qtd, conversa?.ticket.id]);

  const enviar = async () => {
    const texto = rascunho.trim();
    if (!texto) return;
    setRascunho("");
    const ok = await aoEnviar(texto);
    if (!ok) setRascunho((atual) => atual || texto);
  };

  const aviso = erro ? (
    <div className="aviso chat-aviso" role="alert">
      <span className="aviso-texto"><Icone nome="alerta" tamanho={18} /><span>{erro}</span></span>
      <Botao icone="atualizar" onClick={aoRecarregar}>Tentar de novo</Botao>
    </div>
  ) : null;

  // Ticket novo: a primeira mensagem abre o ticket.
  if (!ticketId) {
    return (
      <section className="chat chat-novo" aria-label="Novo ticket de atendimento">
        <div className="chat-boasvindas">
          <span className="chat-selo" aria-hidden="true"><Icone nome="chat" tamanho={26} /></span>
          <h1>Como podemos ajudar?</h1>
          <p>Abra um ticket com um título e a descrição do problema. Um agente responde por aqui, como numa conversa.</p>
          {aviso}
          <form
            className="ticket-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const t = titulo.trim(), d = descricao.trim();
              if (!t || !d || enviando) return;
              if (await aoAbrirTicket(t, d)) { setTitulo(""); setDescricao(""); }
            }}
          >
            <Campo rotulo="Título" name="title" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} required autoFocus placeholder="Resuma o problema em uma frase" />
            <Campo rotulo="Descrição" name="description" value={descricao} onChange={(e) => setDescricao(e.target.value)} multilinha rows={6} maxLength={4000} required placeholder="O que aconteceu? Passos para reproduzir, o que você esperava e o que viu." />
            <div className="acoes">
              <Botao variante="primario" type="submit" icone="enviar" disabled={enviando || !titulo.trim() || !descricao.trim()}>Abrir ticket</Botao>
            </div>
          </form>
          <ul className="sugestoes" aria-label="Sugestões de título">
            {SUGESTOES.map((s) => (
              <li key={s}><button type="button" className="sugestao" onClick={() => setTitulo(s)}>{s}</button></li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  if (!conversa || conversa.ticket.id !== ticketId) {
    return (
      <section className="chat" aria-busy="true">
        {aviso}
        {erro ? null : <p className="carregando-line chat-carregando" role="status">Carregando conversa…</p>}
      </section>
    );
  }

  const { ticket, messages } = conversa;
  const aguardando = ticket.status !== "resolved" && messages[messages.length - 1]?.author === "user";

  return (
    <section className="chat" aria-label={`Ticket: ${ticket.title}`}>
      <header className="chat-topo">
        <div className="chat-titulo-bloco">
          <h1 className="chat-titulo" title={ticket.title}>{ticket.title}</h1>
          <span className="selo-status" data-status={ticket.status}>{rotuloStatus(ticket.status)}</span>
        </div>
        <div className="quadro-acoes">
          {ticket.status === "resolved" ? (
            <Botao onClick={() => aoMudarStatus("open")}>Reabrir</Botao>
          ) : (
            <Botao icone="check" onClick={() => aoMudarStatus("resolved")}>Marcar como resolvido</Botao>
          )}
          <Botao variante="fantasma" icone="lixeira" aria-label="Excluir ticket" onClick={() => setConfirmarExclusao(true)} />
        </div>
      </header>

      <div className="chat-rolagem">
        <div className="chat-coluna" role="log" aria-live="polite" aria-label="Mensagens do ticket">
          {messages.map((m) => <Mensagem key={m.id} mensagem={m} />)}
          {aguardando ? (
            <p className="chat-espera" role="status">
              <span className="pontinhos" aria-hidden="true"><i /><i /><i /></span>
              Aguardando resposta de um agente…
            </p>
          ) : null}
          <div ref={fim} />
        </div>
      </div>

      <div className="chat-rodape">
        {aviso}
        <Compositor
          key={ticket.id}
          texto={rascunho}
          aoMudar={setRascunho}
          aoEnviar={enviar}
          enviando={enviando}
          placeholder={ticket.status === "resolved" ? "Escreva para reabrir este ticket…" : "Escreva uma mensagem…"}
          autoFocus
        />
      </div>

      {confirmarExclusao ? (
        <Confirmar
          aberto
          titulo="Excluir ticket"
          descricao={`Excluir "${ticket.title}" apaga toda a conversa. Não dá para desfazer.`}
          rotuloConfirmar="Excluir ticket"
          aoConfirmar={() => { setConfirmarExclusao(false); void aoExcluir(); }}
          aoFechar={() => setConfirmarExclusao(false)}
        />
      ) : null}
    </section>
  );
}
