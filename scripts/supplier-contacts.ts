import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

const envFile = resolve(process.cwd(), ".env");
if (existsSync(envFile) && typeof process.loadEnvFile === "function") process.loadEnvFile(envFile);

const OUT_DIR = resolve(process.cwd(), "scripts/out");
const CACHE_FILE = resolve(OUT_DIR, ".supplier-contacts-cache.json");
const CSV_FILE = resolve(OUT_DIR, "fornecedores-contatos.csv");
const CSV_UNIQUE_FILE = resolve(OUT_DIR, "fornecedores-contatos-unicos.csv");
const BRASIL_API_URL = "https://brasilapi.com.br/api/cnpj/v1";
const BING_URL = "https://www.bing.com/search";
const USER_AGENT = "lpa-leo/0.1 (supplier contact research)";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const REQUEST_TIMEOUT_MS = 20_000;
const DELAY_MS = 700;
const WEB_DELAY_MIN_MS = 2500;
const WEB_DELAY_MAX_MS = 4000;

type SupplierRow = {
  name: string;
  document: string;
  cities: string | null;
  orders: number;
  totalValue: number | null;
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
  webStatus: "ok" | "none" | "error" | null;
  webPhone: string | null;
  webSourceUrl: string | null;
  webQuery: string | null;
  webCheckedAt: string | null;
};

type Cache = Record<string, CacheEntry>;

const args = new Set(process.argv.slice(2));
const limit = Number(process.argv.find((arg) => arg.startsWith("--limit="))?.slice(8) ?? "0");
const webLimit = Number(process.argv.find((arg) => arg.startsWith("--web-limit="))?.slice(12) ?? "0");
const webPass = args.has("--web-pass");
const uniqueMode = args.has("--unique");
const offline = args.has("--offline");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const cache = loadCache();
  const suppliers = await loadSuppliers(limit);

  if (webPass) {
    await runWebPass(suppliers, cache, webLimit);
  } else {
    await runReceitaPass(suppliers, cache);
  }

  const outputSuppliers = uniqueMode ? dedupeSuppliers(suppliers) : suppliers;
  const csvFile = uniqueMode ? CSV_UNIQUE_FILE : CSV_FILE;
  const csv = buildCsv(outputSuppliers, cache);
  writeFileSync(csvFile, csv, "utf8");
  saveCache(cache);

  if (uniqueMode) {
    const duplicates = suppliers.length - outputSuppliers.length;
    console.log(
      `[contatos] duplicados por documento: ${duplicates} linhas removidas ` +
        `(${suppliers.length} linhas -> ${outputSuppliers.length} documentos únicos)`
    );
  }
  const stats = computeStats(outputSuppliers, cache);
  console.log(`[contatos] CSV escrito em ${csvFile}`);
  console.log(
    `[contatos] fornecedores: ${stats.total} · com telefone: ${stats.withPhone} ` +
      `(receita ${stats.receita} + web ${stats.web}) · sem telefone: ${stats.withoutPhone}`
  );
  await pool.end();
}

function dedupeSuppliers(suppliers: SupplierRow[]): SupplierRow[] {
  const byDocument = new Map<string, SupplierRow & { citySet: Set<string> }>();
  for (const supplier of suppliers) {
    const document = digitsOnly(supplier.document);
    const existing = byDocument.get(document);
    const citySet = existing?.citySet ?? new Set<string>();
    for (const city of (supplier.cities ?? "").split(",")) {
      const clean = city.trim();
      if (clean) citySet.add(clean);
    }
    if (!existing) {
      byDocument.set(document, {
        ...supplier,
        document,
        orders: supplier.orders,
        totalValue: supplier.totalValue,
        citySet
      });
      continue;
    }
    existing.orders += supplier.orders;
    existing.totalValue = Number(existing.totalValue ?? 0) + Number(supplier.totalValue ?? 0);
    if (supplier.orders > existing.orders - supplier.orders) {
      existing.name = supplier.name;
    }
  }
  return [...byDocument.values()]
    .map(({ citySet, ...row }) => ({ ...row, cities: [...citySet].join(", ") || null }))
    .sort((a, b) => b.orders - a.orders);
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

async function runReceitaPass(suppliers: SupplierRow[], cache: Cache) {
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
      console.log(`[contatos] ${done}/${suppliers.length} · telefones encontrados: ${phonesFound}`);
    }
  }
}

async function runWebPass(suppliers: SupplierRow[], cache: Cache, maxCount: number) {
  const targets = suppliers.filter((supplier) => {
    const entry = cache[digitsOnly(supplier.document)];
    if (!entry) return true;
    const hasPhone = Boolean(entry.data?.telefone1 || entry.data?.telefone2 || entry.webPhone);
    return !hasPhone;
  });
  const selected = Number.isFinite(maxCount) && maxCount > 0 ? targets.slice(0, maxCount) : targets;
  console.log(`[web] ${selected.length} fornecedores sem telefone para pesquisar na internet`);

  let done = 0;
  let found = 0;
  for (const supplier of selected) {
    const document = digitsOnly(supplier.document);
    const entry = cache[document] ?? {
      source: "cache",
      status: "error",
      message: "sem consulta anterior",
      data: null,
      checkedAt: null,
      webStatus: null,
      webPhone: null,
      webSourceUrl: null,
      webQuery: null,
      webCheckedAt: null
    };
    if (entry.webStatus === "ok" && entry.webPhone) {
      found++;
      done++;
      continue;
    }
    const name = entry.data?.razaoSocial ?? supplier.name;
    const city = entry.data?.municipio ?? firstCity(supplier.cities);
    try {
      const result = await searchWebPhone(name, document, city);
      if (result) {
        entry.webStatus = "ok";
        entry.webPhone = result.phone;
        entry.webSourceUrl = result.sourceUrl;
        entry.webQuery = result.query;
        found++;
      } else {
        entry.webStatus = "none";
      }
    } catch (error) {
      entry.webStatus = "error";
      entry.message = error instanceof Error ? error.message : "falha na busca web";
    }
    entry.webCheckedAt = new Date().toISOString();
    cache[document] = entry;
    done++;
    if (done % 10 === 0 || done === selected.length) {
      saveCache(cache);
      console.log(`[web] ${done}/${selected.length} · encontrados: ${found}`);
    }
  }
}

type WebHit = {
  phone: string;
  sourceUrl: string;
  query: string;
};

async function searchWebPhone(name: string, document: string, city: string | null): Promise<WebHit | null> {
  const cleanName = name.trim().slice(0, 80);
  const cityTerm = city ? ` ${city}` : "";
  const queries: string[] = [
    `"${cleanName}" telefone`,
    `${cleanName}${cityTerm} telefone`
  ];

  for (const query of queries) {
    const html = await fetchBing(query);
    const phone = pickPhone(html, cleanName, document);
    if (phone) {
      return { phone: phone.phone, sourceUrl: phone.url, query };
    }
  }
  return null;
}

async function fetchBing(query: string) {
  await sleep(WEB_DELAY_MIN_MS + Math.random() * (WEB_DELAY_MAX_MS - WEB_DELAY_MIN_MS));
  const url = new URL(BING_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("setlang", "pt-br");
  url.searchParams.set("cc", "br");
  url.searchParams.set("count", "10");

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url.toString(), {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "accept-language": "pt-BR,pt;q=0.9",
          "user-agent": BROWSER_USER_AGENT
        },
        signal: controller.signal,
        cache: "no-store"
      });
      if (response.status === 429 || response.status >= 500) {
        await sleep(8000 * (attempt + 1));
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.name === "AbortError") {
        lastError = new Error("timeout");
      }
      await sleep(3000);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("falha na busca web");
}

function pickPhone(html: string, name: string, document: string) {
  const nameTokens = significantTokens(name);
  const blocks = html.split('class="b_algo"').slice(1);
  const votes = new Map<string, { votes: number; urls: string[] }>();

  for (const block of blocks) {
    const text = stripTags(decodeEntities(block));
    const href = readFirstGroup(block, /<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"/);
    const url = href ? decodeBingUrl(href) : null;
    if (!text) continue;

    const docHit = document.length === 14 && stripDigits(text).includes(document);
    const tokenHits = nameTokens.filter((token) => text.toLowerCase().includes(token)).length;
    let weight = 0;
    if (docHit) weight = 3;
    else if (tokenHits >= 2) weight = 2;
    else if (tokenHits === 1) weight = 0.5;
    if (weight < 0.5) continue;

    for (const phone of extractPhones(text)) {
      const entry = votes.get(phone) ?? { votes: 0, urls: [] };
      entry.votes += weight;
      if (url && !entry.urls.includes(url)) entry.urls.push(url);
      votes.set(phone, entry);
    }
  }

  let best: { phone: string; votes: number; urls: string[] } | null = null;
  for (const [phone, entry] of votes) {
    if (!best || entry.votes > best.votes) best = { phone, ...entry };
  }
  if (!best || best.votes < 2) return null;
  return { phone: best.phone, url: best.urls[0] ?? "" };
}

function extractPhones(text: string) {
  const found = new Set<string>();
  const pattern = /\(?\b\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}\b/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    let digits = stripDigits(match[0]);
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    if (digits.length === 12 && digits.startsWith("0")) digits = digits.slice(1);
    if (digits.length >= 10 && digits.length <= 11) found.add(digits);
  }
  return [...found];
}

function significantTokens(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
    .slice(0, 6);
}

const STOP_WORDS = new Set([
  "ltda", "epp", "eireli", "mei", "sociedade", "empresarial", "comercio", "servicos",
  "produtos", "distribuidora", "distribuicao", "representacoes", "comercial", "industria",
  "associacao", "cooperativa", "de", "dos", "das", "para", "com", "the"
]);

async function lookup(document: string, cache: Cache, offlineMode: boolean): Promise<CacheEntry> {
  const cached = cache[document];
  if (cached) return cached;

  if (document.length !== 14) {
    const entry: CacheEntry = {
      source: "cache",
      status: "cpf",
      message: "Documento não é CNPJ (consulta pública indisponível)",
      data: null,
      checkedAt: null,
      webStatus: null,
      webPhone: null,
      webSourceUrl: null,
      webQuery: null,
      webCheckedAt: null
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
      checkedAt: null,
      webStatus: null,
      webPhone: null,
      webSourceUrl: null,
      webQuery: null,
      webCheckedAt: null
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
        checkedAt: new Date().toISOString(),
        webStatus: null,
        webPhone: null,
        webSourceUrl: null,
        webQuery: null,
        webCheckedAt: null
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
          checkedAt: new Date().toISOString(),
          webStatus: null,
          webPhone: null,
          webSourceUrl: null,
          webQuery: null,
          webCheckedAt: null
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
    checkedAt: new Date().toISOString(),
    webStatus: null,
    webPhone: null,
    webSourceUrl: null,
    webQuery: null,
    webCheckedAt: null
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
    "fonte_telefone",
    "status_consulta",
    "observacao"
  ];
  const lines = [header.join(",")];
  for (const supplier of suppliers) {
    const document = digitsOnly(supplier.document);
    const entry = cache[document] ?? { status: "missing" as const, message: null, data: null };
    const data = entry.data;
    const webPhone = entry.webPhone ?? null;
    const fonte = data?.telefone1 || data?.telefone2 ? "receita" : webPhone ? "internet" : "";
    lines.push(
      csvRow([
        supplier.name,
        document,
        supplier.orders,
        supplier.totalValue,
        supplier.cities,
        formatPhone(data?.telefone1 ?? webPhone),
        formatPhone(data?.telefone2 ?? null),
        data?.email ?? null,
        data?.razaoSocial ?? null,
        data?.municipio ?? null,
        data?.uf ?? null,
        data?.situacaoCadastral ?? null,
        data?.cnaeDescricao ?? null,
        fonte,
        entry.status,
        entry.webSourceUrl ? `${entry.webStatus}: ${entry.webSourceUrl}` : entry.message
      ])
    );
  }
  return lines.join("\r\n") + "\r\n";
}

function computeStats(suppliers: SupplierRow[], cache: Cache) {
  let withPhone = 0;
  let receita = 0;
  let web = 0;
  for (const supplier of suppliers) {
    const entry = cache[digitsOnly(supplier.document)];
    const fromReceita = Boolean(entry?.data?.telefone1 || entry?.data?.telefone2);
    const fromWeb = Boolean(entry?.webPhone);
    if (fromReceita) receita++;
    else if (fromWeb) web++;
    if (fromReceita || fromWeb) withPhone++;
  }
  return { total: suppliers.length, withPhone, receita, web, withoutPhone: suppliers.length - withPhone };
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

function readFirstGroup(value: string, pattern: RegExp) {
  const match = pattern.exec(value);
  return match?.[1] ?? null;
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, " ");
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function decodeBingUrl(href: string) {
  try {
    const url = new URL(href);
    const encoded = url.searchParams.get("u");
    if (encoded) {
      const decoded = Buffer.from(encoded, "base64").toString("utf8");
      if (/^https?:\/\//.test(decoded)) return decoded;
    }
  } catch {
    // mantém href original
  }
  return href;
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function stripDigits(value: string) {
  return value.replace(/\D/g, "");
}

function firstCity(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
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
