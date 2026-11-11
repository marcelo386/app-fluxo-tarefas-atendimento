// Controlador do atendimento nativo (roda nas Actions, a partir da main confiável).
// Para a issue origin:app do evento: (1) atribui ao Copilot com custom_agent=coordenador, uma vez;
// (2) lê o relatório JSON do PR como DADO (nunca executa código do PR) e comenta na issue:
//     resumo interno + mensagem curta do N1, cada uma uma única vez.
// Antes de agir ele relê a issue e os comentários; erro de rede aborta sem abrir outra sessão.
// Credenciais: COPILOT_AGENT_TOKEN só para atribuir; GH_TOKEN (GITHUB_TOKEN efêmero) para o resto.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  BOT_CONTROLE, COPILOT_BOT, LABEL_ORIGEM, caminhoDoResultado, gh, lerRequestId,
  marcaAtribuido, marcaFase, marcaInterno, marcaN1, montarAtribuicao,
} from "../server/src/github.js";

/** Número da issue do evento: issue direta, ou a citada no corpo do PR (#N), ou o input manual. */
export function issueDoEvento(nome, evento) {
  if (nome === "issues") return evento.issue.number;
  if (nome === "workflow_dispatch") return Number(evento.inputs?.issue) || null;
  const citada = /#(\d+)/.exec(evento.pull_request?.body ?? "");
  return citada ? Number(citada[1]) : null;
}

/** Fase a partir do relatório e do estado do PR. `working` é só andamento. */
export function faseDoRelatorio(relatorio, pr) {
  if (pr?.merged_at || (pr && pr.state === "closed")) return "concluido";
  if (relatorio?.outcome === "working") return "em-andamento";
  if (relatorio?.outcome === "code") return "pr-aberto";
  return relatorio ? "respondido" : "em-andamento";
}

/** Valida o formato do relatório (dado de fora). Devolve null se não servir. */
export function lerRelatorio(texto, requestId) {
  let r;
  try { r = JSON.parse(texto); } catch { return null; }
  if (!r || r.requestId !== requestId || typeof r.outcome !== "string" || !Array.isArray(r.updates)) return null;
  return r;
}

async function main() {
  const { GITHUB_EVENT_NAME: nome, GITHUB_EVENT_PATH: caminho, GITHUB_REPOSITORY: repo, GH_TOKEN: token, COPILOT_AGENT_TOKEN: tokenCopilot } = process.env;
  if (process.env.AGENT_RUNTIME !== "github-native") return console.log("AGENT_RUNTIME não é github-native: nada a fazer.");
  const ensaio = process.env.AGENT_DRY_RUN !== "false";
  const escrever = async (descricao, fn) => (ensaio ? console.log(`[dry-run] ${descricao}`) : fn());

  const evento = JSON.parse(readFileSync(caminho, "utf8"));
  const numero = issueDoEvento(nome, evento);
  if (!numero) return console.log("Evento sem issue associada.");

  // Relê o que já aconteceu antes de qualquer ação.
  const issue = await gh(token, "GET", `/repos/${repo}/issues/${numero}`);
  if (!issue.labels?.some((l) => l.name === LABEL_ORIGEM)) return console.log(`Issue #${numero} não é ${LABEL_ORIGEM}.`);
  const requestId = lerRequestId(issue.body);
  if (!requestId) return console.log(`Issue #${numero} sem requestId.`);
  const comentarios = await gh(token, "GET", `/repos/${repo}/issues/${numero}/comments?per_page=100`);
  const meus = comentarios.filter((c) => c.user?.login === BOT_CONTROLE).map((c) => c.body ?? "");
  const jaTem = (marca) => meus.some((b) => b.includes(marca));
  const comentar = (corpo) => gh(token, "POST", `/repos/${repo}/issues/${numero}/comments`, { body: corpo });

  // 1) Atribuição ao Copilot: uma vez só (marca de controle ou assignee já presente).
  const jaAtribuida = jaTem(marcaAtribuido(requestId)) || issue.assignees?.some((a) => a.login === COPILOT_BOT);
  if (!jaAtribuida) {
    const corpo = montarAtribuicao({ repo, requestId, issueNumber: numero, title: issue.title, body: issue.body ?? "" });
    await escrever(`atribuiria #${numero} ao Copilot (custom_agent=coordenador) com ${JSON.stringify(corpo.agent_assignment).length} bytes de agent_assignment`, async () => {
      if (!tokenCopilot) throw new Error("COPILOT_AGENT_TOKEN ausente");
      await gh(tokenCopilot, "POST", `/repos/${repo}/issues/${numero}/assignees`, corpo);
      await comentar(`${marcaAtribuido(requestId)}\n\nPedido entregue ao agente coordenador. Resultado esperado em \`${caminhoDoResultado(requestId)}\`.`);
    });
    return;
  }

  // 2) Andamento: relatório do PR lido como dado.
  const prs = await gh(token, "GET", `/repos/${repo}/pulls?state=all&per_page=30`);
  const pr = prs.find((p) => new RegExp(`#${numero}\\b`).test(p.body ?? ""));
  if (!pr) return console.log("Ainda sem PR para esta issue.");
  let relatorio = null;
  try {
    const arq = await gh(token, "GET", `/repos/${repo}/contents/${caminhoDoResultado(requestId)}?ref=${pr.head.sha}`);
    relatorio = lerRelatorio(Buffer.from(arq.content, "base64").toString("utf8"), requestId);
  } catch { /* relatório ainda não existe */ }

  for (const u of relatorio?.updates ?? []) {
    if (!u?.id || !u.agent) continue;
    const id = String(u.id);
    if (!jaTem(marcaInterno(requestId, id)) && typeof u.internalText === "string") {
      await escrever(`resumo interno ${id} (${u.agent})`, () => comentar(`${marcaInterno(requestId, id)}\n\n**${u.agent}**: ${u.internalText}`));
    }
    if (!jaTem(marcaN1(requestId, id)) && typeof u.publicText === "string" && u.publicText.trim()) {
      await escrever(`mensagem do N1 ${id}`, () => comentar(`${marcaN1(requestId, id)}\n\n${u.publicText.trim()}`));
    }
  }
  if (relatorio?.outcome && relatorio.outcome !== "working" && typeof relatorio.publicText === "string" && !jaTem(marcaN1(requestId, "final"))) {
    await escrever("mensagem final do N1", () => comentar(`${marcaN1(requestId, "final")}\n\n${relatorio.publicText.trim()}`));
  }
  const fase = faseDoRelatorio(relatorio, pr);
  const ultimaFase = [...meus.join("\n").matchAll(/<!-- fase: (\S+)/g)].pop()?.[1];
  if (fase !== ultimaFase) await escrever(`fase ${fase}, PR #${pr.number}`, () => comentar(marcaFase(fase, pr.number)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`Controlador parou: ${e.message}`); process.exit(1); });
}
