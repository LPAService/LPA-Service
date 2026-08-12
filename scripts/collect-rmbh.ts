import { existsSync } from "node:fs";
import { resolve } from "node:path";

type County = {
  idCounty: number;
  name: string;
  apiTotal: number;
};

type RmbhCounties = {
  priority: Array<County & { tier: number }>;
  counties: County[];
};

type Options = {
  tier1: boolean;
  maxRecords?: number;
};

function loadEnvironment() {
  const envFile = resolve(process.cwd(), ".env");
  if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envFile);
  }
}

function parseOptions(args: string[]): Options {
  let maxRecords: number | undefined;
  let tier1 = false;

  for (const arg of args) {
    if (arg === "--tier1") {
      tier1 = true;
      continue;
    }

    if (arg.startsWith("--max=")) {
      const value = Number(arg.slice("--max=".length));
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("--max precisa ser inteiro positivo");
      }
      maxRecords = value;
      continue;
    }

    throw new Error(`Argumento desconhecido: ${arg}`);
  }

  return { tier1, maxRecords };
}

async function main() {
  loadEnvironment();
  const options = parseOptions(process.argv.slice(2));
  const countiesPath = resolve(process.cwd(), "src/lib/collector/rmbh-counties.json");
  const rmbh = (await import(countiesPath, { with: { type: "json" } })).default as RmbhCounties;
  const counties = options.tier1 ? rmbh.priority : rmbh.counties;
  const { CaixaEscolarClient } = await import("@/lib/collector/client");
  const { collectOpportunities } = await import("@/lib/collector/collect");

  const client = new CaixaEscolarClient();
  const totals = { found: 0, newCount: 0, updatedCount: 0, errorCount: 0 };

  console.log(
    `RMBH coleta iniciada: ${counties.length} municípios${options.maxRecords ? `, máximo ${options.maxRecords}/município` : ""}`
  );

  for (const county of counties) {
    try {
      const result = await collectOpportunities(client, undefined, {
        mode: "full",
        filters: { county: county.idCounty },
        maxRecords: options.maxRecords,
        schoolCounty: { idCounty: county.idCounty, city: county.name }
      });
      totals.found += result.found;
      totals.newCount += result.newCount;
      totals.updatedCount += result.updatedCount;
      totals.errorCount += result.errorCount;
      console.log(
        `${county.name} (${county.idCounty}): encontrados=${result.found} novos=${result.newCount} atualizados=${result.updatedCount} erros=${result.errorCount} run=${result.runId}`
      );
    } catch (error) {
      totals.errorCount += 1;
      console.error(
        `${county.name} (${county.idCounty}): falhou=${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  console.log(
    `RMBH coleta finalizada: encontrados=${totals.found} novos=${totals.newCount} atualizados=${totals.updatedCount} erros=${totals.errorCount}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
