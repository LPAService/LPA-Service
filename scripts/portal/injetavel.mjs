// Emite o script de preenchimento pronto para colar na aba do portal:
// tira o `export` (o eval da página não é módulo) e acrescenta a chamada.
// Uso: node scripts/portal/injetavel.mjs '<json da proposta>' [--dry-run]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const fonte = readFileSync(resolve(import.meta.dirname, "preencher-proposta.js"), "utf8")
  .replace(/^export /m, "");
const proposta = process.argv[2] ?? "{\"items\":[]}";
const dryRun = process.argv.includes("--dry-run");

process.stdout.write(`${fonte}\nJSON.stringify(preencherProposta(${proposta}, { dryRun: ${dryRun} }), null, 1)\n`);
