import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { criarApp } from "./app.js";
import { sincronizar } from "./github.js";

try { process.loadEnvFile(); } catch { /* sem .env: usa o ambiente */ }

const porta = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);
const banco = process.env.BANCO ?? join(dirname(fileURLToPath(import.meta.url)), "..", "dados", "app.sqlite");
const { servidor, db, github } = criarApp({ banco });
servidor.listen(porta, "127.0.0.1", () => console.log(`API em http://127.0.0.1:${porta}/api`));

// github-native: a cada 15 s lê os comentários do controlador (só em produção real: fora do ensaio).
if (github.nativo && !github.dryRun) setInterval(() => void sincronizar(db, github), 15_000).unref();
if (github.nativo) console.log(`GitHub nativo ligado${github.dryRun ? " (AGENT_DRY_RUN=true: nenhuma chamada será feita)" : ""}.`);
