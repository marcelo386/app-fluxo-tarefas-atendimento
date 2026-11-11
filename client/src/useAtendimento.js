import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import { conversaMudou } from "./tickets.js";

const INTERVALO_CONVERSA = 3000; // novas respostas de agentes aparecem sem recarregar
const INTERVALO_LISTA = 8000;

/** Estado do atendimento: lista de tickets, ticket aberto (ou null = novo) e envio de mensagens. */
export function useAtendimento(ativo) {
  const [tickets, setTickets] = useState(null);
  const [ticketId, setTicketId] = useState(null);
  const [conversa, setConversa] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [tentativa, setTentativa] = useState(0);
  const ticketAtual = useRef(null);
  ticketAtual.current = ticketId;

  const carregarLista = useCallback(async () => {
    try {
      const dados = await api.tickets.listar();
      setTickets(dados?.tickets ?? []);
    } catch (e) {
      setErro(e.message);
      setTickets((atual) => atual ?? []);
    }
  }, []);

  // Lista: carrega ao entrar na área e atualiza de tempos em tempos.
  useEffect(() => {
    if (!ativo) return;
    void carregarLista();
    const id = setInterval(() => { if (!document.hidden) void carregarLista(); }, INTERVALO_LISTA);
    return () => clearInterval(id);
  }, [ativo, carregarLista]);

  // Conversa aberta: carrega e consulta de novo para pegar respostas dos agentes.
  useEffect(() => {
    if (!ativo || !ticketId) return;
    let vivo = true;
    const buscar = async (primeira) => {
      try {
        const dados = await api.tickets.detalhe(ticketId);
        if (!vivo) return;
        setConversa((atual) => (atual?.ticket.id === ticketId && !conversaMudou(atual, dados) ? atual : dados));
        if (primeira) setErro(null);
      } catch (e) {
        if (vivo && primeira) setErro(e.message);
      }
    };
    void buscar(true);
    const id = setInterval(() => { if (!document.hidden) void buscar(false); }, INTERVALO_CONVERSA);
    return () => { vivo = false; clearInterval(id); };
  }, [ativo, ticketId, tentativa]);

  const abrir = useCallback((id) => {
    setErro(null);
    setConversa((atual) => (atual?.ticket.id === id ? atual : null));
    setTicketId(id);
  }, []);

  const novo = useCallback(() => {
    setErro(null);
    setConversa(null);
    setTicketId(null);
  }, []);

  /** Abre um ticket novo (título + descrição). Devolve true se abriu. */
  const abrirTicket = useCallback(async (titulo, descricao) => {
    setEnviando(true);
    setErro(null);
    try {
      const dados = await api.tickets.abrir(titulo, descricao);
      setConversa(dados);
      setTicketId(dados.ticket.id);
      void carregarLista();
      return true;
    } catch (e) {
      setErro(e.message);
      return false;
    } finally {
      setEnviando(false);
    }
  }, [carregarLista]);

  /** Envia mensagem no ticket aberto. Devolve true se enviou (o chamador limpa o rascunho só nesse caso). */
  const enviar = useCallback(async (conteudo) => {
    const id = ticketAtual.current;
    if (!id) return false;
    setEnviando(true);
    setErro(null);
    try {
      const dados = await api.tickets.enviar(id, conteudo);
      if (ticketAtual.current === id) {
        setConversa((atual) => (atual?.ticket.id === id ? { ticket: dados.ticket, messages: [...atual.messages, dados.message] } : atual));
      }
      void carregarLista();
      return true;
    } catch (e) {
      setErro(e.message);
      return false;
    } finally {
      setEnviando(false);
    }
  }, [carregarLista]);

  const mudarStatus = useCallback(async (status) => {
    const id = ticketAtual.current;
    if (!id) return;
    try {
      const dados = await api.tickets.mudar(id, { status });
      setConversa((atual) => (atual?.ticket.id === id ? { ...atual, ticket: dados.ticket } : atual));
      void carregarLista();
    } catch (e) {
      setErro(e.message);
    }
  }, [carregarLista]);

  const excluir = useCallback(async () => {
    const id = ticketAtual.current;
    if (!id) return;
    try {
      await api.tickets.excluir(id);
      setConversa(null);
      setTicketId(null);
      void carregarLista();
    } catch (e) {
      setErro(e.message);
    }
  }, [carregarLista]);

  const recarregar = useCallback(() => {
    setErro(null);
    setTentativa((t) => t + 1);
    void carregarLista();
  }, [carregarLista]);

  return { tickets, ticketId, conversa, enviando, erro, abrir, novo, abrirTicket, enviar, mudarStatus, excluir, recarregar };
}
