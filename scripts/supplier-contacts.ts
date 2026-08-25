import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

const envFile = resolve(process.cwd(), ".env");
if (existsSync(envFile) && typeof process.loadEnvFile === "function") process.loadEnvFile(envFile);

const OUT_DIR = resolve(process.cwd(), "scripts/out");
const CACHE_FILE = resolve(OUT_DIR, ".supplier-contacts-cache.json");
const CSV_FILE = resolve(OUT_DIR, "fornecedores-contatos.csv");
const BRASIL_API_URL = "https://brasilapi.com.br/api/cnpj/v1";
const USER_AGENT = "lpa-leo/0.1 (supplier contact research)";
const REQUEST_TIMEOUT_MS = 20_000;
const DELAY_MS = 700;

type SupplierRow = {
  name: string;
  document: string;
  cities: string | null;
  orders: number;
  totalValue: number;
};

type CnpjData = {
  razaoSocial: string | null;
  nomeFantasia: string | null;
  telefone1: string | null;
  telefone2: string | null;
  email: string | null;
  municipio: string | null;
  uf: string | null;
  situacaoCadastral: string | null;
  cnaeDescricao: string | null;
};

type CacheEntry = {
  source: "brasilapi" | "cache";
  status: "ok" | "not_found" | "error" | "cpf";
  message: string | null;
  data: CnpjData | null;
  checkedAt: string | null;
};

type Cache = Record<string, CacheEntry>;

const args = new Set(process.argv.slice(2));
const limit = Number(process.argv.find((arg) => arg.startsWith("--limit="))?.slice(8) ?? "0");
const offline = args.has("--offline");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const cache = loadCache();
  const suppliers = await loadSuppliers(limit);

  console.log(`[contatos] ${suppliers.length} fornecedores distintos na base de licitações ganhas`);
  let done = 0;
  let phonesFound = 0;

  for (const supplier of suppliers) {
    const document = digitsOnly(supplier.document);
    const entry = await lookup(document, cache, offline);
    done++;
    if (entry.data?.telefone1 || entry.data?.telefone2) phonesFound++;
    if (done % 25 === 0 || done === suppliers.length) {
      saveCache(cache);
      console.log(
        `[contatos] ${done}/${suppliers.length} · telefones encontrados: ${phonesFound}`
      );
    }
  }

  const csv = buildCsv(suppliers, cache);
  writeFileSync(CSV_FILE, csv, "utf8");
  saveCache(cache);

  const missing = suppliers.filter((supplier) => {
    const entry = cache[digitsOnly(supplier.document)];
    return !entry?.data?.telefone1 && !entry?.data?.telefone2;
  }).length;
  console.log(`[contatos] CSV escrito em ${CSV_FILE}`);
  console.log(`[contatos] fornecedores: ${suppliers.length} · com telefone: ${phonesFound} · sem telefone: ${missing}`);
  await pool.end();
}

async function loadSuppliers(limitCount: number): Promise<SupplierRow[]> {
  const limitSql = Number.isFinite(limitCount) && limitCount > 0 ? "limit $1" : "";
  const params: unknown[] = [];
  if (limitSql) params.push(limitCount);
  const result = await pool.query(
    `select supplier_name as name, supplier_document as document,
       string_agg(distinct city, ', ') as cities,
       count(*)::integer as orders,
       round(sum(total_value)::numeric, 2) as "totalValue"
     from opportunities
     where supplier_document is not null and btrim(supplier_document) <> ''
     group by supplier_name, supplier_document
     order by orders desc ${limitSql}`,
    params
  );
  return result.rows as SupplierRow[];
}

async function lookup(document: string, cache: Cache, offlineMode: boolean): Promise<CacheEntry> {
  const cached = cache[document];
  if (cached) return cached;

  if (document.length !== 14) {
    const entry: CacheEntry = {
      source: "cache",
      status: "cpf",
      message: "Documento não é CNPJ (consulta pública indisponível)",
      data: null,
      checkedAt: null
    };
    cache[document] = entry;
    return entry;
  }

  if (offlineMode) {
    cache[document] = {
      source: "cache",
      status: "error",
      message: "Modo offline (--offline), sem consulta",
      data: null,
      checkedAt: null
    };
    return cache[document];
  }

  let lastError: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const payload = await fetchJson(`${BRASIL_API_URL}/${document}`);
      const data = parseCnpj(payload);
      const entry: CacheEntry = {
        source: "brasilapi",
        status: "ok",
        message: null,
        data,
        checkedAt: new Date().toISOString()
      };
      cache[document] = entry;
      return entry;
    } catch (error) {
      if (error instanceof NotFoundError) {
        const entry: CacheEntry = {
          source: "brasilapi",
          status: "not_found",
          message: "CNPJ não encontrado na Receita (BrasilAPI)",
          data: null,
          checkedAt: new Date().toISOString()
        };
        cache[document] = entry;
        return entry;
      }
      lastError = error instanceof Error ? error.message : "falha desconhecida";
      await sleep(1500 * (attempt + 1));
    }
  }
  const entry: CacheEntry = {
    source: "brasilapi",
    status: "error",
    message: lastError,
    data: null,
    checkedAt: new Date().toISOString()
  };
  cache[document] = entry;
  return entry;
}

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      signal: controller.signal,
      cache: "no-store"
    });
    if (response.status === 404) throw new NotFoundError();
    if (response.status === 429 || response.status >= 500) {
      throw new Error(`HTTP ${response.status}`);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("timeout");
    }
    throw error instanceof Error ? error : new Error("falha de rede");
  } finally {
    clearTimeout(timeout);
    await sleep(DELAY_MS);
  }
}

function parseCnpj(payload: unknown): CnpjData {
  const row = (payload ?? {}) as Record<string, unknown>;
  return {
    razaoSocial: readString(row.razao_social),
    nomeFantasia: readString(row.nome_fantasia),
    telefone1: readString(row.ddd_telefone_1),
    telefone2: readString(row.ddd_telefone_2),
    email: readString(row.email),
    municipio: readString(row.municipio),
    uf: readString(row.uf),
    situacaoCadastral: readString(row.descricao_situacao_cadastral),
    cnaeDescricao: readString(row.cnae_fiscal_descricao)
  };
}

function buildCsv(suppliers: SupplierRow[], cache: Cache) {
  const header = [
    "fornecedor",
    "documento",
    "pedidos_ganhos",
    "valor_total",
    "cidades_atendidas",
    "telefone_1",
    "telefone_2",
    "email",
    "razao_social_receita",
    "municipio_receita",
    "uf",
    "situacao_cadastral",
    "cnae_principal",
    "status_consulta",
    "observacao"
  ];
  const lines = [header.join(",")];
  for (const supplier of suppliers) {
    const document = digitsOnly(supplier.document);
    const entry = cache[document] ?? { status: "missing" as const, message: null, data: null };
    const data = entry.data;
    lines.push(
      csvRow([
        supplier.name,
        document,
        supplier.orders,
        supplier.totalValue,
        supplier.cities,
        formatPhone(data?.telefone1 ?? null),
        formatPhone(data?.telefone2 ?? null),
        data?.email ?? null,
        data?.razaoSocial ?? null,
        data?.municipio ?? null,
        data?.uf ?? null,
        data?.situacaoCadastral ?? null,
        data?.cnaeDescricao ?? null,
        entry.status,
        entry.message
      ])
    );
  }
  return lines.join("\r\n") + "\r\n";
}

function formatPhone(value: string | null) {
  if (!value) return "";
  const digits = digitsOnly(value);
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return digits;
}

function csvRow(values: Array<string | number | null | undefined>) {
  return values.map(csvField).join(",");
}

function csvField(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadCache(): Cache {
  if (!existsSync(CACHE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_FILE, "utf8")) as Cache;
  } catch {
    return {};
  }
}

function saveCache(cache: Cache) {
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
}

class NotFoundError extends Error {
  constructor() {
    super("not found");
    this.name = "NotFoundError";
  }
}

main().catch((error) => {
  console.error("[contatos] FALHOU:", error);
  process.exitCode = 1;
});
