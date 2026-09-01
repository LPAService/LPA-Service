#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || databaseUrl.trim() === "") {
  console.warn("[migrate-on-build] DATABASE_URL ausente; pulando migrations.");
  process.exit(0);
}

console.log("[migrate-on-build] DATABASE_URL encontrada; aplicando migrations Drizzle.");

const result = spawnSync("npm", ["run", "db:migrate"], {
  stdio: "inherit",
  env: process.env
});

if (result.error) {
  console.error("[migrate-on-build] Falha ao executar migrations:", result.error.message);
  process.exit(1);
}

if (result.signal) {
  console.error(`[migrate-on-build] Migration interrompida por sinal ${result.signal}.`);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`[migrate-on-build] Migration falhou com exit code ${result.status}.`);
  process.exit(result.status ?? 1);
}

console.log("[migrate-on-build] Migrations aplicadas.");
