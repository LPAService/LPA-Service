import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import expenseGroupMapRaw from "@/lib/classification/expense-group-map.json";
import { normalize } from "@/lib/parsing/normalize";

type DataPayload<T> = {
  data: T[];
};

type JsonRecord = Record<string, unknown>;

const FIXTURES_URL = new URL("research/portal/fixtures/", pathToFileURL(`${process.cwd()}/`));
const FIXTURES_DIR = fileURLToPath(FIXTURES_URL);

const expenseGroupMap = expenseGroupMapRaw as Record<string, string>;

function fixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(new URL(name, FIXTURES_URL), "utf8")) as T;
}

function recordsFromPayload(payload: unknown): JsonRecord[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];

  const data = (payload as DataPayload<unknown>).data;
  if (!Array.isArray(data)) return [];

  return data
    .filter((record): record is JsonRecord => {
      if (!record || typeof record !== "object" || Array.isArray(record)) return false;
      const candidate = record as JsonRecord;
      return typeof candidate.orderId === "string" && typeof candidate.expenseGroup === "string";
    });
}

function uniqueListings(): JsonRecord[] {
  const byOrderId = new Map<string, JsonRecord>();

  for (const filename of readdirSync(FIXTURES_DIR)) {
    if (!filename.endsWith(".json")) continue;

    for (const record of recordsFromPayload(fixture(filename))) {
      if (!byOrderId.has(record.orderId as string)) {
        byOrderId.set(record.orderId as string, record);
      }
    }
  }

  return Array.from(byOrderId.values()).sort((a, b) =>
    String(a.orderId).localeCompare(String(b.orderId))
  );
}

const detailedFixtures = new Map<string, { detail: JsonRecord; items: unknown }>([
  ["2027075592", { detail: fixture<JsonRecord>("detail_1.json"), items: fixture("items_1.json") }],
  ["2027075587", { detail: fixture<JsonRecord>("detail_2.json"), items: fixture("items_2.json") }],
  ["2027075586", { detail: fixture<JsonRecord>("detail_3.json"), items: fixture("items_3.json") }]
]);

const judgedExpectedByOrderId: Record<string, string> = {
  "2027075592": "panificacao",
  "2027075587": "construcao",
  "2027075586": "nao-pereciveis"
};

describe("classificacao dos fixtures reais", () => {
  it("classifica os 123 registros unicos pelos itens reais ou pelo mapa julgado", () => {
    const listings = uniqueListings();
    const results = listings.map((listing) => {
      const orderId = String(listing.orderId);
      const detailed = detailedFixtures.get(orderId);
      const expected =
        judgedExpectedByOrderId[orderId] ?? expenseGroupMap[String(listing.expenseGroup)];
      const normalized = normalize(listing, detailed?.detail ?? {}, detailed?.items ?? [], []);

      return {
        orderId,
        expected,
        actual: normalized.category?.slug,
        headline: normalized.headline,
        topItems: normalized.topItems
      };
    });

    const failures = results.filter((result) => result.actual !== result.expected);
    const fallbackResults = results.filter((result) => result.actual === "outros");

    expect(results).toHaveLength(123);
    expect(failures).toEqual([]);
    expect(fallbackResults).toEqual([]);
  });

  it("mantem Equipamentos de Cozinha como Utensilios no registro real 2026163027", () => {
    const listing = uniqueListings().find((record) => record.orderId === "2026163027");

    expect(listing).toBeDefined();

    const normalized = normalize(listing, {}, [], []);

    expect(normalized.category?.slug).toBe("utensilios");
    expect(normalized.headline).toBe("Utensílios");
    expect(normalized.summary).toBe(
      "Fornecedor para utensílios e equipamentos de cozinha da escola."
    );
    expect(normalized.topItems).toEqual([]);
  });
});
