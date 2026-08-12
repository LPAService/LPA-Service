import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalize } from "@/lib/parsing/normalize";

type DataPayload<T> = {
  data: T[];
};

type JsonRecord = Record<string, unknown>;

const FIXTURES_URL = new URL("../../../research/portal/fixtures/", import.meta.url);

function fixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(new URL(name, FIXTURES_URL), "utf8")) as T;
}

const listings = fixture<DataPayload<JsonRecord>>("purchase_orders_page1.json").data;
const detail1 = fixture<JsonRecord>("detail_1.json");
const detail2 = fixture<JsonRecord>("detail_2.json");
const detail3 = fixture<JsonRecord>("detail_3.json");
const items1 = fixture("items_1.json");
const items2 = fixture("items_2.json");
const items3 = fixture("items_3.json");

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
        totalValue: 5000
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
        totalValue: 695
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
        totalValue: 25835.11
      }
    }
  ])("normaliza fixture real $expected.orderId", ({ listing, detail, items, expected }) => {
    const result = normalize(listing, detail, items, []);

    expect(result.externalId).toBe(expected.externalId);
    expect(result.orderId).toBe(expected.orderId);
    expect(result.itemCount).toBe(expected.itemCount);
    expect(result.totalValue).toBe(expected.totalValue);
    expect(result.rawJson).toMatchObject({ listing, detail, items, attachments: [] });
    expect(result.sourceUrl).toContain(
      `/by-subprogram/${result.idSubprogram}/by-school/${result.idSchool}/by-budget/${result.idBudget}`
    );
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
