#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_CWD = "/Users/haza/Desktop/Projetos/LPA_Leo";

const PROVIDER_TO_AGENT = new Map([
  ["antigravity-cli", "antigravity"],
  ["codex-cli", "codex"],
  ["opencode-cli", "opencode"],
]);

function usage() {
  return [
    "Usage: node runner.mjs --file <partitura.json> [--dry-run]",
    "",
    "Gera plano JSON de pane_spawn. Nunca executa spawn real.",
  ].join("\n");
}

function parseArgs(argv) {
  const args = { dryRun: true, file: null };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (arg === "--file") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Argumento --file exige caminho do JSON.");
      }
      args.file = value;
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }

    throw new Error(`Argumento desconhecido: ${arg}`);
  }

  return args;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireString(value, path, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path} deve ser string nao vazia.`);
  }
}

function validatePartitura(partitura) {
  const errors = [];

  if (!isObject(partitura)) {
    return ["Partitura deve ser um objeto JSON."];
  }

  requireString(partitura.name, "name", errors);

  if (!Array.isArray(partitura.nodes)) {
    errors.push("nodes deve ser array.");
  } else {
    const ids = new Set();

    partitura.nodes.forEach((node, index) => {
      const base = `nodes[${index}]`;

      if (!isObject(node)) {
        errors.push(`${base} deve ser objeto.`);
        return;
      }

      requireString(node.id, `${base}.id`, errors);
      requireString(node.role, `${base}.role`, errors);
      requireString(node.provider, `${base}.provider`, errors);
      requireString(node.model, `${base}.model`, errors);

      if (typeof node.provider === "string" && !PROVIDER_TO_AGENT.has(node.provider)) {
        errors.push(
          `${base}.provider invalido: ${node.provider}. Use antigravity-cli, codex-cli ou opencode-cli.`,
        );
      }

      if (typeof node.id === "string" && node.id.trim() !== "") {
        if (ids.has(node.id)) {
          errors.push(`${base}.id duplicado: ${node.id}.`);
        }
        ids.add(node.id);
      }
    });
  }

  if (!Array.isArray(partitura.edges)) {
    errors.push("edges deve ser array.");
  } else {
    const nodeIds = new Set(
      Array.isArray(partitura.nodes)
        ? partitura.nodes.filter(isObject).map((node) => node.id).filter((id) => typeof id === "string")
        : [],
    );

    partitura.edges.forEach((edge, index) => {
      const base = `edges[${index}]`;

      if (!isObject(edge)) {
        errors.push(`${base} deve ser objeto.`);
        return;
      }

      requireString(edge.from, `${base}.from`, errors);
      requireString(edge.to, `${base}.to`, errors);

      if (typeof edge.from === "string" && edge.from.trim() !== "" && !nodeIds.has(edge.from)) {
        errors.push(`${base}.from referencia node inexistente: ${edge.from}.`);
      }

      if (typeof edge.to === "string" && edge.to.trim() !== "" && !nodeIds.has(edge.to)) {
        errors.push(`${base}.to referencia node inexistente: ${edge.to}.`);
      }
    });
  }

  return errors;
}

function topoSort(nodes, edges) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const inDegree = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, []]));

  for (const edge of edges) {
    inDegree.set(edge.to, inDegree.get(edge.to) + 1);
    outgoing.get(edge.from).push(edge.to);
  }

  const queue = nodes.filter((node) => inDegree.get(node.id) === 0).map((node) => node.id);
  const ordered = [];

  while (queue.length > 0) {
    const id = queue.shift();
    ordered.push(nodeById.get(id));

    for (const childId of outgoing.get(id)) {
      inDegree.set(childId, inDegree.get(childId) - 1);
      if (inDegree.get(childId) === 0) {
        queue.push(childId);
      }
    }
  }

  if (ordered.length !== nodes.length) {
    const cycleNodes = [...inDegree.entries()]
      .filter(([, degree]) => degree > 0)
      .map(([id]) => id)
      .join(", ");
    throw new Error(`Partitura contem ciclo ou dependencia irresolvida: ${cycleNodes}.`);
  }

  return ordered;
}

function buildSpawnPlan(partitura) {
  return topoSort(partitura.nodes, partitura.edges).map((node) => ({
    agent: PROVIDER_TO_AGENT.get(node.provider),
    providerId: node.provider,
    model: node.model,
    cwd: PROJECT_CWD,
    prompt: node.instructions ?? "",
  }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(usage());
    return;
  }

  if (!args.file) {
    throw new Error(`Arquivo obrigatorio ausente.\n${usage()}`);
  }

  const filePath = resolve(process.cwd(), args.file);
  let partitura;

  try {
    partitura = JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Falha ao ler ou parsear JSON em ${filePath}: ${error.message}`);
  }

  const errors = validatePartitura(partitura);
  if (errors.length > 0) {
    throw new Error(`Partitura invalida:\n- ${errors.join("\n- ")}`);
  }

  console.log(JSON.stringify(buildSpawnPlan(partitura), null, 2));
}

const isEntryPoint = process.argv[1] === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
