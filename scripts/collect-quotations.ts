import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { collectOpenQuotations, selectCounties } from "@/lib/collector/quotations";

const envFile = resolve(process.cwd(), ".env");
if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

const args = new Map<string, string | boolean>();
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith("--") && arg.includes("=")) {
    const clean = arg.slice(2);
    const index = clean.indexOf("=");
    args.set(clean.slice(0, index), clean.slice(index + 1));
  } else if (arg.startsWith("--")) {
    args.set(arg.slice(2), true);
  }
}

const cities = args.get("cities");
const counties = args.get("counties");
const max = args.get("max");

const result = await collectOpenQuotations({
  counties: selectCounties(typeof counties === "string" ? counties : typeof cities === "string" ? cities : undefined),
  maxRecords: typeof max === "string" ? Number(max) : undefined,
  dryRun: args.get("dry-run") === true
});

console.log(JSON.stringify(result));
