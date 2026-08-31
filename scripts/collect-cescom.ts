import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import {
  CESCOM_SOURCE,
  extractProductsFromHtml,
  parseDepartmentSitemap,
  totalPagesFromHtml,
  type CescomProduct
} from "@/lib/collector/cescom";

const SITEMAP_URL = "https://www.cescom.com.br/sitemap-departamentos.xml";
const SITEMAP_CACHE = resolve(process.cwd(), "scripts/out/cescom-sitemap.xml");
const STATE_FILE = resolve(process.cwd(), "scripts/out/cescom-collect-state.json");
const UA = "Mozilla/5.0 (compatible; LPALeo/1.0; +https://lpaleo.local)";

const DELAY_MS = 300;
const CONCURRENCY = 3;
const TIMEOUT_MS = 20_000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

type Options = {
  maxDepts: number;
  depts: string[];
  dryRun: boolean;
  reset: boolean;
};

type State = { completed: string[] };

function loadEnvironment() {
  const envFile = resolve(process.cwd(), ".env");
  if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envFile);
  }
}

function parseOptions(args: string[]): Options {
  let maxDepts = 0;
  const depts: string[] = [];
  let dryRun = false;
  let reset = false;

  for (const arg of args) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--reset") {
      reset = true;
      continue;
    }
    if (arg.startsWith("--max-depts=")) {
      const value = Number(arg.slice("--max-depts=".length));
      if (!Number.isInteger(value) || value < 1) {
        throw new Error("--max-depts precisa ser inteiro positivo");
      }
      maxDepts = value;
      continue;
    }
    if (arg.startsWith("--depts=")) {
      depts.push(
        ...arg
          .slice("--depts=".length)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      );
      continue;
    }
    throw new Error(`Argumento desconhecido: ${arg}`);
  }

  return { maxDepts, depts, dryRun, reset };
}

class RetryableError extends Error {}

let lastRequestAt = 0;
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, lastRequestAt + DELAY_MS - now);
  lastRequestAt = now + wait;
  if (wait > 0) await sleep(wait);
}

function sleep(ms: number) {
  return new Promise<void>((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function fetchPage(url: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await throttle();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "text/html" },
        signal: controller.signal,
        redirect: "follow"
      });
      if (res.status === 429 || res.status >= 500) {
        throw new RetryableError(`HTTP ${res.status}`);
      }
      if (!res.ok) return "";
      return await res.text();
    } catch (error) {
      lastError = error;
      const retryable =
        error instanceof RetryableError ||
        (error instanceof Error && error.name === "AbortError");
      if (!retryable || attempt === MAX_RETRIES) throw error;
      const backoff = BASE_BACKOFF_MS * 2 ** (attempt - 1);
      console.log(`  retry ${attempt}/${MAX_RETRIES - 1} em ${backoff}ms: ${url}`);
      await sleep(backoff);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function loadSitemap(): Promise<string> {
  if (existsSync(SITEMAP_CACHE)) {
    return readFileSync(SITEMAP_CACHE, "utf8");
  }
  console.log(`Baixando sitemap: ${SITEMAP_URL}`);
  const xml = await fetchPage(SITEMAP_URL);
  if (xml) writeFileSync(SITEMAP_CACHE, xml);
  return xml;
}

function loadState(): State {
  if (!existsSync(STATE_FILE)) return { completed: [] };
  try {
    const parsed = JSON.parse(readFileSync(STATE_FILE, "utf8")) as Partial<State>;
    return { completed: Array.isArray(parsed.completed) ? parsed.completed : [] };
  } catch {
    return { completed: [] };
  }
}

function saveState(state: State) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function upsertProducts(pool: Pool, products: CescomProduct[]): Promise<number> {
  for (const product of products) {
    await pool.query(
      `INSERT INTO reference_products
         (source, external_id, name, normalized_name, ean, brand, department, packaging, url, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())
       ON CONFLICT (source, external_id) DO UPDATE SET
         name = excluded.name,
         normalized_name = excluded.normalized_name,
         ean = coalesce(excluded.ean, reference_products.ean),
         brand = coalesce(excluded.brand, reference_products.brand),
         department = coalesce(excluded.department, reference_products.department),
         packaging = coalesce(excluded.packaging, reference_products.packaging),
         url = coalesce(excluded.url, reference_products.url),
         updated_at = now()`,
      [
        product.source,
        product.externalId,
        product.name,
        product.normalizedName,
        product.ean,
        product.brand,
        product.department,
        product.packaging,
        product.url
      ]
    );
  }
  return products.length;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function collectDepartment(
  url: string,
  dryRun: boolean,
  pool: Pool,
  globalSeen: Set<string>
): Promise<{ newGlobally: number; withoutEan: number; pages: number }> {
  const page1 = await fetchPage(url);
  if (!page1) return { newGlobally: 0, withoutEan: 0, pages: 0 };
  const totalPages = totalPagesFromHtml(page1);
  let newGlobally = 0;
  let withoutEan = 0;

  const collect = (html: string) => {
    const products = extractProductsFromHtml(html);
    for (const product of products) {
      if (!globalSeen.has(product.externalId)) {
        globalSeen.add(product.externalId);
        newGlobally += 1;
        if (product.ean === null) withoutEan += 1;
      }
    }
    return products;
  };

  const first = collect(page1);
  if (!dryRun) await upsertProducts(pool, first);

  for (let page = 2; page <= totalPages; page++) {
    const html = await fetchPage(`${url}?page=${page}`);
    if (!html) break;
    const products = collect(html);
    if (!dryRun) await upsertProducts(pool, products);
  }

  return { newGlobally, withoutEan, pages: totalPages };
}

async function main() {
  loadEnvironment();
  const options = parseOptions(process.argv.slice(2));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const state = loadState();
  if (options.reset) state.completed = [];
  const completed = new Set(state.completed);

  try {
    const xml = await loadSitemap();
    let departments = parseDepartmentSitemap(xml);
    if (options.depts.length > 0) {
      const wanted = new Set(options.depts);
      departments = departments.filter((url) => {
        const segments = url.replace("https://www.cescom.com.br", "").split("/").filter(Boolean);
        return segments.some((segment) => wanted.has(segment));
      });
    }
    if (options.maxDepts > 0) departments = departments.slice(0, options.maxDepts);

    const pending = departments.filter((url) => !completed.has(url));
    console.log(
      `Cescom: ${departments.length} departamentos (${pending.length} pendentes)${options.dryRun ? " [DRY-RUN]" : ""}`
    );

    const totals = { newGlobally: 0, withoutEan: 0, pages: 0, errors: 0 };
    const globalSeen = new Set<string>();

    await mapWithConcurrency(pending, CONCURRENCY, async (url) => {
      try {
        const result = await collectDepartment(url, options.dryRun, pool, globalSeen);
        totals.newGlobally += result.newGlobally;
        totals.withoutEan += result.withoutEan;
        totals.pages += result.pages;
        completed.add(url);
        saveState({ completed: [...completed] });
        console.log(
          `  [${completed.size}/${departments.length}] ${url.replace("https://www.cescom.com.br", "")} -> +${result.newGlobally} novos (${result.pages} pág)`
        );
      } catch (error) {
        totals.errors += 1;
        console.error(
          `  ERRO ${url}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    const totalResult = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM reference_products WHERE source = $1`,
      [CESCOM_SOURCE]
    );
    const noEanResult = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM reference_products WHERE source = $1 AND ean IS NULL`,
      [CESCOM_SOURCE]
    );
    const totalRows = totalResult.rows[0]?.count ?? "0";
    const noEanRows = noEanResult.rows[0]?.count ?? "0";

    console.log(
      `Cescom finalizado: departamentos=${completed.size} paginas=${totals.pages} novos=${totals.newGlobally} semEAN=${totals.withoutEan} erros=${totals.errors}`
    );
    console.log(
      `BD reference_products (source=cescom): total=${totalRows} semEAN=${noEanRows}`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
