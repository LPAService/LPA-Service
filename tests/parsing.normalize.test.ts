import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import expenseGroupMapRaw from "@/lib/classification/expense-group-map.json";
import { NormalizeError, normalize } from "@/lib/parsing/normalize";
import {
  CAIXA_ESCOLAR_PORTAL_URL,
  buildPurchaseOrderDetailApiUrl
} from "@/lib/source-url";

type DataPayload<T> = {
  data: T[];
};

type JsonRecord = Record<string, unknown>;

const FIXTURES_URL = new URL("research/portal/fixtures/", pathToFileURL(`${process.cwd()}/`));

function fixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(new URL(name, FIXTURES_URL), "utf8")) as T;
}

const listings = fixture<DataPayload<JsonRecord>>("purchase_orders_page1.json").data;
const sampleListings = fixture<DataPayload<JsonRecord>>("pagesize_1000.json").data;
const sortDateListings = fixture<DataPayload<JsonRecord>>(
  "purchase_orders_sort_date_desc.json"
).data;
const realListings = [...sampleListings, ...sortDateListings];
const detail1 = fixture<JsonRecord>("detail_1.json");
const detail2 = fixture<JsonRecord>("detail_2.json");
const detail3 = fixture<JsonRecord>("detail_3.json");
const items1 = fixture("items_1.json");
const items2 = fixture("items_2.json");
const items3 = fixture("items_3.json");
const expenseGroupMap = expenseGroupMapRaw as Record<string, string>;

describe("normalize", () => {
  it.each([
    {
      listing: listings[0],
      detail: detail1,
      items: items1,
      expected: {
        externalId: "1396-9458-338067",
        orderId: "2027075592",
        itemCount: 1,
        totalValue: 5000,
        categorySlug: "panificacao",
        headline: "Panificação",
        summary: "Fornecedor para pães e produtos de panificação destinados à alimentação escolar.",
        topItems: ["pão de sal"]
      }
    },
    {
      listing: listings[1],
      detail: detail2,
      items: items2,
      expected: {
        externalId: "717-9926-335900",
        orderId: "2027075587",
        itemCount: 1,
        totalValue: 695,
        categorySlug: "construcao",
        headline: "Construção",
        summary: "Fornecedor para materiais de construção e pequenos reparos da escola.",
        topItems: ["telha cerâmica tipo romana"]
      }
    },
    {
      listing: listings[2],
      detail: detail3,
      items: items3,
      expected: {
        externalId: "635-10415-333464",
        orderId: "2027075586",
        itemCount: 10,
        totalValue: 25835.11,
        categorySlug: "nao-pereciveis",
        headline: "Não Perecíveis",
        summary: "Fornecedor para alimentos não perecíveis destinados à alimentação escolar.",
        topItems: [
          "amido de milho",
          "açafrão pó",
          "açúcar cristal",
          "alho",
          "amendoim"
        ]
      }
    }
  ])("normaliza card completo do fixture real $expected.orderId", ({ listing, detail, items, expected }) => {
    const result = normalize(listing, detail, items, []);

    expect(result.externalId).toBe(expected.externalId);
    expect(result.orderId).toBe(expected.orderId);
    expect(result.itemCount).toBe(expected.itemCount);
    expect(result.totalValue).toBe(expected.totalValue);
    expect(result.rawJson).toMatchObject({ listing, detail, items, attachments: [] });
    expect(result.sourceUrl).toBe(CAIXA_ESCOLAR_PORTAL_URL);
    expect(result.rawJson).toMatchObject({
      sourceApiUrl: buildPurchaseOrderDetailApiUrl(result)
    });
    expect(result.category?.slug).toBe(expected.categorySlug);
    expect(result.headline).toBe(expected.headline);
    expect(result.summary).toBe(expected.summary);
    expect(result.topItems).toEqual(expected.topItems);
  });

  it("trata nulos e vazios em campos opcionais", () => {
    const listing = {
      ...listings[0],
      idSupplier: null,
      purchaseDate: " ",
      accountabilityStatus: ""
    };
    const detail = {
      ...detail1,
      dtProposalSubmission: null,
      dtDelivery: "",
      purchaseOrderStatus: " ",
      supplierName: "",
      supplierDocument: " ",
      initiativeDescription: ""
    };

    const result = normalize(listing, detail, items1, []);

    expect(result.idSupplier).toBeNull();
    expect(result.purchaseDate).toBeNull();
    expect(result.proposalDate).toBeNull();
    expect(result.deliveryDate).toBeNull();
    expect(result.purchaseOrderStatus).toBeNull();
    expect(result.accountabilityStatus).toBeNull();
    expect(result.supplierName).toBeNull();
    expect(result.supplierDocument).toBeNull();
    expect(result.initiativeDescription).toBeNull();
    expect(result.city).toBeNull();
    expect(result.regional).toBeNull();
  });

  it("ignora item sem valor na soma total", () => {
    const result = normalize(
      listings[0],
      detail1,
      {
        data: [
          {
            nuItemOrder: 1,
            txBudgetItemType: "Banana",
            txDescription: "Banana prata",
            txBudgetItemUnit: "KG",
            nuQuantity: 5,
            nuValueByItem: null,
            inPermanent: false,
            txExpenseCategory: "Custeio"
          },
          {
            nuItemOrder: 2,
            txBudgetItemType: "Tomate",
            txDescription: "Tomate",
            txBudgetItemUnit: "KG",
            nuQuantity: 2,
            nuValueByItem: 10,
            inPermanent: false,
            txExpenseCategory: "Custeio"
          }
        ]
      },
      []
    );

    expect(result.items[0].unitValue).toBeNull();
    expect(result.items[0].totalValue).toBeNull();
    expect(result.items[1].totalValue).toBe(20);
    expect(result.totalValue).toBe(20);
  });

  it("normaliza anexo real com url vazia como null", () => {
    const attachments = fixture<{ sourceOrder: JsonRecord; data: JsonRecord[] }>(
      "attachment_metadata.json"
    );

    const result = normalize(attachments.sourceOrder, {}, [], attachments);

    expect(result.attachments).toHaveLength(2);
    expect(result.attachments[0]).toMatchObject({
      id: 413227,
      filename: "1170dbf5-a6fc-4a96-ae87-0d2387663471.pdf",
      url: null
    });
    expect(result.attachments[0].thumbUrl).toContain("/public/files/thumb");
  });

  it("gera summary legivel e classificacao end-to-end", () => {
    const result = normalize(listings[0], detail1, items1, []);

    expect(result.category).toMatchObject({
      slug: "panificacao",
      name: "Panificação",
      needsFallback: false
    });
    expect(result.headline).toBe("Panificação");
    expect(result.summary).toBe(
      "Fornecedor para pães e produtos de panificação destinados à alimentação escolar."
    );
    expect(result.topItems).toEqual(["pão de sal"]);
  });

  it("mapeia campos reais do item contra payload cru", () => {
    const result = normalize(listings[2], detail3, items3, []);

    expect(result.items[0]).toEqual({
      order: 1,
      name: "Amido de milho",
      description:
        "Amido de milho: produto amiláceo extraído do milho, branco, textura fina, isento de mofo e sujidades. Embalagem plástica atóxica, transparente, com identificação, procedência, lote, gramatura, fabricação e vencimento. Validade mínima de 6 meses da entrega. Pacote com 500 gramas. \nPREÇO MÉDIO: R$ 3,99. \nMARCAS EXIGIDAS: Maizena, Apti, Yoki. \nLOCAL DE ENTREGA: Av. Tiradentes, 135 - Centro - Araguari/MG. \nPERÍODO DE ENTREGA: de 05/08/2026 até 07/12/2026. \nVALIDADE DA PROPOSTA: 05 meses.",
      unit: "Pacote",
      quantity: 25,
      unitValue: 3.58,
      totalValue: 89.5,
      isPermanent: false,
      expenseCategory: "Custeio"
    });
  });

  it("lança erro tipado quando ids obrigatorios faltam", () => {
    expect(() => normalize({}, {}, [], [])).toThrow(NormalizeError);

    try {
      normalize({}, {}, [], []);
    } catch (error) {
      expect(error).toBeInstanceOf(NormalizeError);
      expect((error as NormalizeError).code).toBe("MISSING_REQUIRED_IDS");
      expect((error as NormalizeError).context.missing).toEqual([
        "idSubprogram",
        "idSchool",
        "idBudget"
      ]);
    }
  });

  it("gera topItems curtos, limpos e deduplicados por txBudgetItemType", () => {
    const result = normalize(listings[2], detail3, items3, []);

    expect(result.topItems).toEqual([
      "amido de milho",
      "açafrão pó",
      "açúcar cristal",
      "alho",
      "amendoim"
    ]);
  });

  it("preserva needsFallback e cai em Outros", () => {
    const result = normalize(
      {
        ...listings[0],
        expenseGroup: "",
        subprogram: ""
      },
      {
        ...detail1,
        expenseGroupDescription: "",
        subprogramName: "",
        initiativeDescription: "aquisição de instrumentos musicais para fanfarra escolar"
      },
      { data: [] },
      []
    );

    expect(result.category).toMatchObject({
      slug: "outros",
      name: "Outros",
      needsFallback: true
    });
    expect(result.headline).toBe("Outros");
  });

  it.each([
    ["2027075575", "servicos", "Serviços", "Fornecedor para serviços operacionais da escola."],
    [
      "2027075568",
      "material-de-consumo-geral",
      "Material de Consumo Geral",
      "Fornecedor para materiais de consumo geral da escola."
    ],
    ["2026168124", "construcao", "Construção", "Fornecedor para materiais de construção e pequenos reparos da escola."],
    [
      "2026166988",
      "informatica",
      "Informática",
      "Fornecedor para equipamentos e serviços de informática da escola."
    ],
    [
      "2026166885",
      "material-pedagogico",
      "Material Pedagógico",
      "Fornecedor para materiais pedagógicos da escola."
    ],
    [
      "2026166386",
      "transporte",
      "Transporte",
      "Fornecedor para serviços de transporte escolar."
    ],
    [
      "2026163027",
      "utensilios",
      "Utensílios",
      "Fornecedor para utensílios e equipamentos de cozinha da escola."
    ]
  ])(
    "classifica grupo de despesa real sem itens: %s",
    (orderId, categorySlug, headline, summary) => {
      const listing = realListings.find((item) => item.orderId === orderId);

      expect(listing).toBeDefined();

      const result = normalize(listing, {}, [], []);

      expect(result.category?.slug).toBe(categorySlug);
      expect(result.headline).toBe(headline);
      expect(result.summary).toBe(summary);
      expect(result.topItems).toEqual([]);
    }
  );

  it.each(Object.entries(expenseGroupMap))(
    "classifica todo txExpenseGroup da fonte por mapa: %s",
    (expenseGroup, categorySlug) => {
      const result = normalize(
        {
          idSubprogram: 1,
          idSchool: 2,
          idBudget: 3,
          orderId: `map-${expenseGroup}`,
          expenseGroup
        },
        {},
        [],
        []
      );

      expect(result.category).toMatchObject({
        slug: categorySlug,
        needsFallback: false
      });
      expect(result.headline).not.toBe("Outros");
    }
  );

  it("itens reais vencem o mapa de expenseGroup generico", () => {
    const result = normalize(
      {
        idSubprogram: 1,
        idSchool: 2,
        idBudget: 3,
        orderId: "items-win-map",
        expenseGroup: "Equipamentos de Cozinha"
      },
      {},
      {
        data: [
          {
            nuItemOrder: 1,
            txBudgetItemType: "Notebook",
            txDescription: "Notebook para secretaria",
            txBudgetItemUnit: "Unidade",
            nuQuantity: 1,
            nuValueByItem: 3500,
            inPermanent: true,
            txExpenseCategory: "Capital"
          }
        ]
      },
      []
    );

    expect(result.category?.slug).toBe("informatica");
    expect(result.headline).toBe("Informática");
    expect(result.topItems).toEqual(["notebook"]);
  });

  it("grupo de despesa desconhecido vira fallback com Outros", () => {
    const result = normalize(
      {
        idSubprogram: 1,
        idSchool: 2,
        idBudget: 3,
        orderId: "unknown-expense-group",
        expenseGroup: "Grupo Novo da Fonte"
      },
      {},
      [],
      []
    );

    expect(result.category).toMatchObject({
      slug: "outros",
      name: "Outros",
      needsFallback: true
    });
    expect(result.headline).toBe("Outros");
  });

  it("usa initiativeDescription especifica quando itens nao vieram", () => {
    const result = normalize(listings[0], detail1, [], []);

    expect(result.category?.slug).toBe("panificacao");
    expect(result.headline).toBe("Panificação");
    expect(result.summary).toBe(
      "Fornecedor para pães e produtos de panificação destinados à alimentação escolar."
    );
    expect(result.topItems).toEqual([]);
  });

  it("ignora initiativeDescription boilerplate sem itens", () => {
    const result = normalize(listings[2], detail3, [], []);

    expect(result.category?.slug).toBe("alimentos");
    expect(result.headline).toBe("Alimentos");
    expect(result.summary).toBe(
      "Fornecedor para gêneros alimentícios destinados à alimentação escolar."
    );
    expect(result.topItems).toEqual([]);
  });

  it("aceita enriquecimento opcional de escola com cidade e regional", () => {
    const result = normalize(listings[0], detail1, items1, [], {
      txName: "EE TESTE",
      txCounty: "Belo Horizonte",
      txRegional: "SRE/METROPOLITANA A"
    });

    expect(result.school).toBe("EE TESTE");
    expect(result.city).toBe("Belo Horizonte");
    expect(result.regional).toBe("SRE/METROPOLITANA A");
  });
});
