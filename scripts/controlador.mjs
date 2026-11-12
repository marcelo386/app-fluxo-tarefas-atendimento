// Controlador do atendimento nativo (roda nas Actions, a partir da main confiável).
// Para a issue origin:app do evento:
//  1) atribui ao Copilot (custom_agent=coordenador), uma vez;
//  2) lê o relatório JSON do PR como DADO (nunca executa código do PR) e comenta na issue:
//     resumo interno + mensagem curta do N1, cada uma uma única vez (id estável);
//  3) entrega: espera revisão ok + build verde do commit ATUAL + entrada docs/knowledge/<requestId>.md; AUTO_MERGE=true integra esse commit
//     (sem bypass das regras da branch), AUTO_MERGE=false deixa o PR para a demonstração;
//  4) depois do merge na main: resposta final do N1 ("entrega") e fecha a issue;
//  5) build/revisão falhou: UMA rodada de correção pedida ao Copilot no MESMO PR; se falhar de novo, pendente-instrutor.
// Retomar: tudo é reconstruído do que já existe na issue/PR (marcadores), então rodar de novo é seguro.
// Credenciais: COPILOT_AGENT_TOKEN só para atribuir e pedir correção (token de usuário); GH_TOKEN (GITHUB_TOKEN) para o resto.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  BOT_CONTROLE, LABEL_ORIGEM, caminhoDoResultado, ehPrDoCopilot, gh, ghTodas, idSeguro, issueCitada, lerRelatorio,
  lerRequestId, limparTexto, marcaAtribuido, marcaFase, marcaInterno, marcaN1, montarAtribuicao,
} from "../server/src/github.js";

export { ehPrDoCopilot, issueCitada, lerRelatorio };

// ---------- funções puras ----------

/** Issue direta do evento (issues, dispatch ou PR); para push/workflow_run use prDoEvento. */
export function issueDoEvento(nome, evento) {
  if (nome === "issues") return evento.issue.number;
  if (nome === "workflow_dispatch") return Number(evento.inputs?.issue) || null;
  if (nome === "pull_request_target") return issueCitada(evento.pull_request?.body);
  return null;
}

/** Número do PR em eventos que só o apontam: build terminado (workflow_run) ou merge na main (push). */
export function prDoEvento(nome, evento) {
  if (nome === "workflow_run") return evento.workflow_run?.pull_requests?.[0]?.number ?? null;
  if (nome === "push") { const m = /(?:\(#|pull request #)(\d+)/.exec(evento.head_commit?.message ?? ""); return m ? Number(m[1]) : null; }
  return null;
}

/** Revisão pelo ÚLTIMO update do agente revisor: id terminado em "-falha" = reprovou. */
export function estadoRevisao(relatorio) {
  const rev = (relatorio?.updates ?? []).filter((u) => u?.agent === "revisor");
  if (!rev.length) return "pendente";
  return /-falha$/.test(String(rev[rev.length - 1].id)) ? "falhou" : "ok";
}

/** Build do commit atual, pelas check runs chamadas "build" (workflow build.yml). */
export function estadoBuild(checkRuns) {
  const b = (checkRuns ?? []).filter((r) => r.name === "build").sort((x, y) => String(y.started_at).localeCompare(String(x.started_at)))[0];
  if (!b || b.status !== "completed") return "pendente";
  if (b.conclusion === "success") return "verde";
  return ["failure", "timed_out", "cancelled"].includes(b.conclusion) ? "falhou" : "pendente"; // action_required etc.: espera aprovação
}

export const marcaCorrecao = (requestId, sha) => `<!-- controle: correcao ${requestId} sha:${sha} -->`;
export const marcaPendente = (requestId) => `<!-- controle: pendente-instrutor ${requestId} -->`;
const TEXTO_ENTREGA = "O código já foi integrado na main. O app local ainda precisa ser atualizado (git pull) e reiniciado para ver a mudança.";

// ---------- fluxo ----------

/**
 * Uma passada para a issue `numero`. `api` é injetado (get, todas, enviar, comoUsuario, graphql),
 * o que permite conferir a entrega com transporte simulado.
 */
export async function processar({ repo, numero, api, ensaio, autoMerge, log = console.log }) {
  const escrever = async (descricao, fn) => (ensaio ? log(`[dry-run] ${descricao}`) : fn());

  // Relê o que já aconteceu antes de qualquer ação.
  const issue = await api.get(`/repos/${repo}/issues/${numero}`);
  if (!issue.labels?.some((l) => l.name === LABEL_ORIGEM)) return log(`Issue #${numero} não é ${LABEL_ORIGEM}.`);
  const requestId = lerRequestId(issue.body);
  if (!requestId) return log(`Issue #${numero} sem requestId.`);
  const comentarios = await api.todas(`/repos/${repo}/issues/${numero}/comments`);
  const meus = comentarios.filter((c) => c.user?.login === BOT_CONTROLE).map((c) => c.body ?? "");
  const jaTem = (marca) => meus.some((b) => b.includes(marca));
  const comentar = async (corpo) => { await api.enviar("POST", `/repos/${repo}/issues/${numero}/comments`, { body: corpo }); meus.push(corpo); };

  // 1) Atribuição ao Copilot: uma vez só (marca de controle ou assignee já presente).
  if (!jaTem(marcaAtribuido(requestId)) && !issue.assignees?.some((a) => /^copilot/i.test(a.login))) {
    const corpo = montarAtribuicao({ repo, requestId, issueNumber: numero, title: issue.title, body: issue.body ?? "" });
    return escrever(`atribuiria #${numero} ao Copilot (custom_agent=coordenador)`, async () => {
      await api.comoUsuario("POST", `/repos/${repo}/issues/${numero}/assignees`, corpo);
      await comentar(`${marcaAtribuido(requestId)}\n\nPedido entregue ao agente coordenador. Resultado esperado em \`${caminhoDoResultado(requestId)}\`.`);
    });
  }

  // 2) O PR do Copilot e o relatório (lido como dado).
  const prs = await api.todas(`/repos/${repo}/pulls?state=all`);
  let pr = prs.find((p) => issueCitada(p.body) === numero && ehPrDoCopilot(p, repo));
  if (!pr) return log("Ainda sem PR do Copilot para esta issue.");
  // O corpo do PR não pode fechar a issue sozinho: a resposta do N1 vem antes do fechamento.
  const fecha = new RegExp(`\\b(?:fix(?:es|ed)?|close[sd]?|resolve[sd]?)\\s+#${numero}\\b`, "gi");
  if (pr.state === "open" && fecha.test(pr.body ?? "")) {
    await escrever(`PR #${pr.number}: trocar "Fixes #${numero}" por "Refs #${numero}"`, async () => {
      pr = await api.enviar("PATCH", `/repos/${repo}/pulls/${pr.number}`, { body: pr.body.replace(fecha, `Refs #${numero}`) });
    });
  }
  const sha = pr.merged_at ? pr.merge_commit_sha : pr.head.sha;
  let relatorio = null;
  try {
    const arq = await api.get(`/repos/${repo}/contents/${caminhoDoResultado(requestId)}?ref=${pr.merged_at ? pr.merge_commit_sha : pr.head.sha}`);
    relatorio = lerRelatorio(Buffer.from(arq.content, "base64").toString("utf8"), requestId);
  } catch { /* relatório ainda não existe */ }

  for (const u of relatorio?.updates ?? []) {
    const id = idSeguro(u?.id);
    if (!id || !u.agent) continue;
    const interno = limparTexto(u.internalText), publico = limparTexto(u.publicText);
    if (interno && !jaTem(marcaInterno(requestId, id))) {
      await escrever(`resumo interno ${id}`, () => comentar(`${marcaInterno(requestId, id)}\n\n**${limparTexto(u.agent).slice(0, 40)}**: ${interno}`));
    }
    if (publico && !jaTem(marcaN1(requestId, id))) {
      await escrever(`mensagem do N1 ${id}`, () => comentar(`${marcaN1(requestId, id)}\n\n${publico}`));
    }
  }

  // 3) Decide a fase e entrega.
  const final = limparTexto(relatorio?.publicText);
  const fecharIssue = () => escrever(`fechar a issue #${numero}`, () => api.enviar("PATCH", `/repos/${repo}/issues/${numero}`, { state: "closed", state_reason: "completed" }));
  let fase = "em-andamento";

  const entregar = async () => { // depois do merge na main: resposta única (id estável) e fechamento
    if (!jaTem(marcaN1(requestId, "entrega"))) {
      await escrever("mensagem de entrega do N1", () => comentar(`${marcaN1(requestId, "entrega")}\n\n${final ? `${final} ` : ""}${TEXTO_ENTREGA}`));
    }
    if (issue.state === "open") await fecharIssue();
    return "concluido";
  };

  if (!relatorio || relatorio.outcome === "working") {
    fase = "em-andamento";
  } else if (relatorio.outcome !== "code") { // dúvida de uso, comercial, esclarecimento, revisão humana: sem código
    if (final && !jaTem(marcaN1(requestId, "final"))) await escrever("mensagem final do N1", () => comentar(`${marcaN1(requestId, "final")}\n\n${final}`));
    if (["answered", "commercial"].includes(relatorio.outcome) && issue.state === "open") await fecharIssue();
    fase = relatorio.outcome === "waiting-customer" ? "aguardando-cliente" : relatorio.outcome === "human-review" ? "pendente-instrutor" : "respondido";
  } else if (pr.merged_at) {
    fase = await entregar();
  } else if (pr.state === "closed") {
    fase = "encerrado"; // fechado sem merge
  } else {
    const runs = await api.get(`/repos/${repo}/commits/${sha}/check-runs`).then((r) => r.check_runs).catch(() => []);
    const build = estadoBuild(runs), revisao = estadoRevisao(relatorio);
    if (build === "falhou" || revisao === "falhou") {
      const motivo = build === "falhou" ? "o build falhou" : "a revisão reprovou";
      const prComentarios = await api.todas(`/repos/${repo}/issues/${pr.number}/comments`);
      const pedidos = prComentarios.filter((c) => (c.body ?? "").includes(`<!-- controle: correcao ${requestId} `));
      if (!pedidos.length) { // uma rodada automática, no mesmo PR
        fase = "corrigindo";
        await escrever(`pedir correção ao Copilot no PR #${pr.number} (${motivo})`, () => api.comoUsuario("POST", `/repos/${repo}/issues/${pr.number}/comments`, {
          body: `${marcaCorrecao(requestId, sha)}\n@copilot ${motivo} no commit ${sha.slice(0, 7)}. requestId: ${requestId}. Corrija neste mesmo PR, rode \`npm run build\` e atualize o relatório \`${caminhoDoResultado(requestId)}\`.`,
        }));
      } else if (pedidos.some((c) => c.body.includes(`sha:${sha}`))) {
        fase = "corrigindo"; // ainda é o commit que já pedimos para corrigir: espera o Copilot
      } else {
        fase = "pendente-instrutor"; // falhou de novo depois da rodada: o instrutor decide
        if (!jaTem(marcaPendente(requestId))) await escrever("pendência para o instrutor", () => comentar(`${marcaPendente(requestId)}\n\nA correção automática não resolveu (${motivo}). Aguardando o instrutor no PR #${pr.number}.`));
      }
    } else if (build === "verde" && revisao === "ok" && !(await api.get(`/repos/${repo}/contents/docs/knowledge/${requestId}.md?ref=${sha}`).then(() => true, () => false))) {
      fase = "pr-aberto"; // todo PR gera conhecimento: falta docs/knowledge/<requestId>.md; espera o Copilot criar
      log(`PR #${pr.number}: falta docs/knowledge/${requestId}.md; integração segurada.`);
    } else if (build === "verde" && revisao === "ok") {
      if (!autoMerge) {
        fase = "aguardando-merge"; // PR disponível para a demonstração
      } else {
        // Integra exatamente o commit conferido; se a branch recusar, não há bypass.
        const integrar = async () => {
          if (pr.draft) await api.graphql("mutation($id:ID!){markPullRequestReadyForReview(input:{pullRequestId:$id}){clientMutationId}}", { id: pr.node_id });
          await api.enviar("PUT", `/repos/${repo}/pulls/${pr.number}/merge`, { sha: pr.head.sha, merge_method: "squash" });
        };
        if (ensaio) { log(`[dry-run] integraria o commit ${sha.slice(0, 7)} do PR #${pr.number}`); fase = "aguardando-merge"; }
        else {
          try { await integrar(); pr = await api.get(`/repos/${repo}/pulls/${pr.number}`); fase = await entregar(); }
          catch (e) {
            fase = "pendente-instrutor";
            if (!jaTem(marcaPendente(requestId))) await comentar(`${marcaPendente(requestId)}\n\nNão consegui integrar o PR #${pr.number}: ${limparTexto(e.message)}. A regra da branch foi respeitada; o instrutor decide.`);
          }
        }
      }
    } else {
      fase = "pr-aberto"; // esperando build ou revisão
    }
  }

  const ultimaFase = meus.map((b) => /^<!-- fase: (\S+)/.exec(b.trimStart())?.[1]).filter(Boolean).pop();
  if (fase !== ultimaFase) await escrever(`fase ${fase}, PR #${pr.number}`, () => comentar(marcaFase(fase, pr.number)));
  return fase;
}

async function main() {
  const { GITHUB_EVENT_NAME: nome, GITHUB_EVENT_PATH: caminho, GITHUB_REPOSITORY: repo, GH_TOKEN: token, COPILOT_AGENT_TOKEN: tokenCopilot } = process.env;
  if (process.env.AGENT_RUNTIME !== "github-native") return console.log("AGENT_RUNTIME não é github-native: nada a fazer.");
  const api = {
    get: (c) => gh(token, "GET", c),
    todas: (c) => ghTodas(token, c),
    enviar: (m, c, b) => gh(token, m, c, b),
    comoUsuario: (m, c, b) => { if (!tokenCopilot) throw new Error("COPILOT_AGENT_TOKEN ausente"); return gh(tokenCopilot, m, c, b); },
    graphql: (query, variables) => gh(token, "POST", "/graphql", { query, variables }),
  };
  const evento = JSON.parse(readFileSync(caminho, "utf8"));
  let numero = issueDoEvento(nome, evento);
  const numeroPr = prDoEvento(nome, evento);
  if (!numero && numeroPr) numero = issueCitada((await api.get(`/repos/${repo}/pulls/${numeroPr}`)).body);
  if (!numero) return console.log("Evento sem issue associada.");
  const fase = await processar({ repo, numero, api, ensaio: process.env.AGENT_DRY_RUN !== "false", autoMerge: process.env.AUTO_MERGE === "true" });
  if (fase) console.log(`Issue #${numero}: fase ${fase}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`Controlador parou: ${e.message}`); process.exit(1); });
}
