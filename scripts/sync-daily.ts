import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envFile = resolve(process.cwd(), ".env");
if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

const { runDailySync } = await import("@/lib/sync/daily");
const result = await runDailySync();
console.log(JSON.stringify(result));
