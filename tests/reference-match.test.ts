import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { matchReferenceProducts } from "@/lib/catalog/reference-match";
import { referenceProducts } from "@/lib/db/schema";
import * as schema from "@/lib/db/schema";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://lpa:lpa@localhost:5432/lpa_leo_test";
const referenceMatchDbLockKey = 941_445_010;

describe("matchReferenceProducts", () => {
  let pool: Pool;
  let database: NodePgDatabase<typeof schema>;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query("select pg_advisory_lock($1)", [referenceMatchDbLockKey]);
    await pool.query("drop table if exists reference_products cascade");
    const sqlText = [
      readFileSync(resolve(process.cwd(), "drizzle/0011_striped_bloodaxe.sql"), "utf8"),
      readFileSync(resolve(process.cwd(), "drizzle/0012_reference_products_search.sql"), "utf8")
    ].join("--> statement-breakpoint");
    const statements = sqlText
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await pool.query(statement);
    }
    database = drizzle(pool, { schema });
  }, 30_000);

  beforeEach(async () => {
    await pool.query("truncate reference_products restart identity");
    await database.insert(referenceProducts).values([
      {
        source: "cescom",
        externalId: "25558",
        name: "PAPEL SULFITE A4 75G 500 FOLHAS CHAMEX",
        normalizedName: "papel sulfite a4 75g 500 folhas chamex",
        ean: "7891173023005",
        brand: "CHAMEX",
        department: "PAPELARIA",
        url: "https://cescom.test/papel-a4"
      },
      {
        source: "cescom",
        externalId: "30102",
        name: "DETERGENTE NEUTRO 5L YPE",
        normalizedName: "detergente neutro 5l ype",
        ean: "7896031159028",
        brand: "YPE",
        department: "LIMPEZA",
        url: "https://cescom.test/detergente"
      },
      {
        source: "outro",
        externalId: "999",
        name: "PAPEL SULFITE A4 OUTRO",
        normalizedName: "papel sulfite a4 outro",
        ean: "000",
        brand: "OUTRO"
      }
    ]);
  }, 30_000);

  afterAll(async () => {
    await pool.query("select pg_advisory_unlock($1)", [referenceMatchDbLockKey]);
    await pool.end();
  });

  it("casa item da licitação com produto Cescom sem campo de preço", async () => {
    const matches = await matchReferenceProducts(
      database,
      "Papel sulfite A4 branco 500 folhas",
      3
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      item: {
        source: "cescom",
        name: "PAPEL SULFITE A4 75G 500 FOLHAS CHAMEX",
        ean: "7891173023005",
        brand: "CHAMEX",
        department: "PAPELARIA",
        url: "https://cescom.test/papel-a4"
      },
      matchedTokens: expect.arrayContaining(["papel", "sulfite", "a4", "500", "folhas"])
    });
    expect(Object.keys(matches[0].item)).not.toContain("price");
  });

  it("limita a três matches por item", async () => {
    await database.insert(referenceProducts).values([
      {
        source: "cescom",
        externalId: "a",
        name: "DETERGENTE NEUTRO 5L A",
        normalizedName: "detergente neutro 5l a"
      },
      {
        source: "cescom",
        externalId: "b",
        name: "DETERGENTE NEUTRO 5L B",
        normalizedName: "detergente neutro 5l b"
      },
      {
        source: "cescom",
        externalId: "c",
        name: "DETERGENTE NEUTRO 5L C",
        normalizedName: "detergente neutro 5l c"
      }
    ]);

    const matches = await matchReferenceProducts(database, "Detergente neutro 5L", 3);

    expect(matches).toHaveLength(3);
    expect(matches.every((match) => match.item.source === "cescom")).toBe(true);
  });

  it("retorna lista vazia quando não casa com nada", async () => {
    await expect(matchReferenceProducts(database, "Serviço de transporte escolar", 3)).resolves.toEqual([]);
  });

  it("rejeita produto quando token do item aparece só como atributo, não como núcleo", async () => {
    await pool.query("truncate reference_products restart identity");
    await database.insert(referenceProducts).values([
      {
        source: "cescom",
        externalId: "attribute-only",
        name: "BETA PREMIUM ALFA",
        normalizedName: "beta premium alfa",
        department: "MASSAS E MOLHOS > MACARRÃO"
      }
    ]);

    await expect(matchReferenceProducts(database, "Alfa premium", 3)).resolves.toEqual([]);
  });

  it("para hortifruti, aceita só departamento do mesmo domínio", async () => {
    await pool.query("truncate reference_products restart identity");
    await database.insert(referenceProducts).values([
      {
        source: "cescom",
        externalId: "processed-food",
        name: "NUCLEO EXTRA PROCESSADO",
        normalizedName: "nucleo extra processado",
        department: "MASSAS E MOLHOS > ATOMATADOS"
      },
      {
        source: "cescom",
        externalId: "fresh-produce",
        name: "NUCLEO EXTRA FRESCO",
        normalizedName: "nucleo extra fresco",
        department: "HORTIFRUTI > LEGUMES"
      }
    ]);

    const matches = await matchReferenceProducts(database, "Nucleo extra", 3, {
      categorySlug: "frutas-e-verduras",
      categoryName: "Frutas e Verduras",
      expenseGroup: "Gêneros Alimentícios"
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].item.department).toBe("HORTIFRUTI > LEGUMES");
  });

  it("para alimento, rejeita departamento de higiene mesmo com núcleo igual", async () => {
    await pool.query("truncate reference_products restart identity");
    await database.insert(referenceProducts).values([
      {
        source: "cescom",
        externalId: "personal-care",
        name: "ALFA BETA PERFUMADO",
        normalizedName: "alfa beta perfumado",
        department: "CABELOS > SHAMPOO"
      },
      {
        source: "cescom",
        externalId: "food",
        name: "ALFA BETA TRADICIONAL",
        normalizedName: "alfa beta tradicional",
        department: "MASSAS E MOLHOS > MACARRÃO"
      }
    ]);

    const matches = await matchReferenceProducts(database, "Alfa beta", 3, {
      categorySlug: "alimentos",
      categoryName: "Alimentos",
      expenseGroup: "Gêneros Alimentícios"
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].item.department).toBe("MASSAS E MOLHOS > MACARRÃO");
  });

  it("para alimento, não bloqueia departamento desconhecido quando núcleo casa", async () => {
    await pool.query("truncate reference_products restart identity");
    await database.insert(referenceProducts).values([
      {
        source: "cescom",
        externalId: "new-food-department",
        name: "ALFA BETA TRADICIONAL",
        normalizedName: "alfa beta tradicional",
        department: "DEPARTAMENTO NOVO > LINHA NOVA"
      }
    ]);

    const matches = await matchReferenceProducts(database, "Alfa beta", 3, {
      categorySlug: "alimentos",
      categoryName: "Alimentos",
      expenseGroup: "Gêneros Alimentícios"
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].item.department).toBe("DEPARTAMENTO NOVO > LINHA NOVA");
  });

  it("prioriza token distintivo exato quando produtos têm mesmo núcleo", async () => {
    await pool.query("truncate reference_products restart identity");
    await database.insert(referenceProducts).values([
      {
        source: "cescom",
        externalId: "wrong-distinctive",
        name: "ALFA GAMA TRADICIONAL",
        normalizedName: "alfa gama tradicional",
        department: "DEPARTAMENTO NOVO > LINHA NOVA"
      },
      {
        source: "cescom",
        externalId: "right-distinctive",
        name: "ALFA BETA TRADICIONAL",
        normalizedName: "alfa beta tradicional",
        department: "DEPARTAMENTO NOVO > LINHA NOVA"
      }
    ]);

    const matches = await matchReferenceProducts(database, "Alfa beta", 3, {
      categorySlug: "alimentos",
      categoryName: "Alimentos",
      expenseGroup: "Gêneros Alimentícios"
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].item.normalizedName).toBe("alfa beta tradicional");
  });

  it("permite casar termo significativo do item com início do produto", async () => {
    await pool.query("truncate reference_products restart identity");
    await database.insert(referenceProducts).values([
      {
        source: "cescom",
        externalId: "family-match",
        name: "BETA DIRETO AO USO",
        normalizedName: "beta direto ao uso",
        department: "MASSAS E MOLHOS > LINHA"
      }
    ]);

    const matches = await matchReferenceProducts(database, "Alfa beta", 3, {
      categorySlug: "alimentos",
      categoryName: "Alimentos",
      expenseGroup: "Gêneros Alimentícios"
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].item.normalizedName).toBe("beta direto ao uso");
  });

  it("não bloqueia descartável em licitação de alimento quando núcleo casa", async () => {
    await pool.query("truncate reference_products restart identity");
    await database.insert(referenceProducts).values([
      {
        source: "cescom",
        externalId: "disposable",
        name: "PRATO DESCARTAVEL RASO",
        normalizedName: "prato descartavel raso",
        department: "DESCARTAVEIS > COPOS E PRATOS"
      }
    ]);

    const matches = await matchReferenceProducts(database, "Prato plastico descartavel", 3, {
      categorySlug: "alimentos",
      categoryName: "Alimentos",
      expenseGroup: "Gêneros Alimentícios"
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].item.department).toBe("DESCARTAVEIS > COPOS E PRATOS");
  });

  it.each([
    [
      "PAPEL HIGIENICO folha dupla 30m",
      ["papel", "higienico", "folha", "dupla"],
      [
        {
          source: "cescom",
          externalId: "papel-match",
          name: "PAPEL HIGIENICO VIP FOLHA DUPLA NEUTRO 30 METROS LEVE 16 PAGUE 15 PERSONAL",
          normalizedName: "papel higienico vip folha dupla neutro 30 metros leve 16 pague 15 personal",
          ean: "7896110004648"
        },
        {
          source: "cescom",
          externalId: "papel-errado",
          name: "GUARDANAPO FOLHA DUPLA",
          normalizedName: "guardanapo folha dupla",
          ean: "111"
        }
      ]
    ],
    [
      "DETERGENTE LIQUIDO NEUTRO 500ML",
      ["detergente", "neutro"],
      [
        {
          source: "cescom",
          externalId: "detergente-match",
          name: "DETERGENTE NEUTRO YPÊ",
          normalizedName: "detergente neutro ype",
          ean: "7896098900208"
        },
        {
          source: "cescom",
          externalId: "detergente-errado",
          name: "ALCOOL LIQUIDO",
          normalizedName: "alcool liquido",
          ean: "222"
        }
      ]
    ],
    [
      "ARROZ TIPO 1 5KG",
      ["arroz"],
      [
        {
          source: "cescom",
          externalId: "arroz-match",
          name: "ARROZ BRANCO TIO URBANO",
          normalizedName: "arroz branco tio urbano",
          ean: "7896038321032"
        },
        {
          source: "cescom",
          externalId: "arroz-errado",
          name: "FEIJAO CARIOCA TIPO 1",
          normalizedName: "feijao carioca tipo 1",
          ean: "333"
        }
      ]
    ],
    [
      "CREME DE LEITE 200G",
      ["creme", "leite"],
      [
        {
          source: "cescom",
          externalId: "creme-match",
          name: "CREME DE LEITE LEVE TP ITALAC",
          normalizedName: "creme de leite leve tp italac",
          ean: "7898080640222"
        },
        {
          source: "cescom",
          externalId: "creme-errado",
          name: "BALA DURA MORANGO COM CREME DE LEITE FRUITTELLA",
          normalizedName: "bala dura morango com creme de leite fruittella",
          ean: "444"
        }
      ]
    ]
  ])("prioriza produto com palavras distintivas para caso real: %s", async (query, expectedTokens, products) => {
    await pool.query("truncate reference_products restart identity");
    await database.insert(referenceProducts).values(products);

    const matches = await matchReferenceProducts(database, query, 3);

    const topName = matches[0]?.item.normalizedName ?? "";
    for (const token of expectedTokens) {
      expect(topName).toContain(token);
    }
  });
});
