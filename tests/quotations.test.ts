import { describe, expect, it } from "vitest";
import {
  buildProposalUrl,
  buildQuotationExternalId,
  buildQuotationRecord,
  collectOpenQuotationsWithClient,
  getQuotationStatus,
  type QuotationRepository
} from "@/lib/collector/quotations";

const listing = {
  idSubprogram: 12,
  idSchool: 34,
  idBudget: 56,
  idCounty: 2209,
  countyName: "Ibirité",
  schoolName: "EE Teste",
  expenseGroupDescription: "Material de Consumo",
  dtProposalSubmission: "2026-08-20T12:00:00.000Z",
  dtServiceDelivery: "2026-08-30T12:00:00.000Z",
  budgetStatus: "ENVI",
  supplierStatus: "NAEN",
  nuBudgetOrder: "2026/99",
  year: 2026
};

describe("cotações abertas", () => {
  it("gera externalId e deep link autenticado", () => {
    expect(buildQuotationExternalId(listing)).toBe("12-34-56");
    expect(buildProposalUrl(listing)).toBe(
      "https://caixaescolar.educacao.mg.gov.br/compras/orcamento/subprograma/12/escola/34/detalhe-orcamento/56"
    );
  });

  it("calcula status por data real", () => {
    const now = new Date("2026-08-13T12:00:00.000Z");
    expect(getQuotationStatus("2026-08-12T12:00:00.000Z", "2026-08-10T12:00:00.000Z", now)).toBe("Encerrada");
    expect(getQuotationStatus("2026-08-20T12:00:00.000Z", "2026-08-13T06:00:00.000Z", now)).toBe("Nova");
    expect(getQuotationStatus("2026-08-15T12:00:00.000Z", "2026-08-10T12:00:00.000Z", now)).toBe("Encerrando em breve");
    expect(getQuotationStatus("2026-08-20T12:00:00.000Z", "2026-08-10T12:00:00.000Z", now)).toBe("Aberta");
  });

  it("classifica e resume sem deixar card em branco", () => {
    const record = buildQuotationRecord(
      listing,
      {
        schoolName: "EE Teste",
        countyName: "Ibirité",
        expenseGroupDescription: "Material de Consumo",
        initiativeDescription: "Aquisição de material de limpeza para escola",
        estimatedValue: 100
      },
      [
        {
          nuItemOrder: 1,
          txBudgetItemType: "Detergente",
          txDescription: "Detergente neutro",
          txBudgetItemUnit: "UN",
          nuQuantity: 10,
          nuReferralValue: 5
        }
      ]
    );

    expect(record.headline).not.toBe("");
    expect(record.summary).not.toBe("");
    expect(record.topItems).toContain("detergente");
    expect(record.items[0]).toMatchObject({ itemOrder: 1, referenceValue: 5 });
  });

  it("não soma quantidade como valor quando itens não têm preço", () => {
    const record = buildQuotationRecord(
      listing,
      {
        schoolName: "EE Teste",
        countyName: "Ibirité",
        expenseGroupDescription: "Material de Consumo",
        initiativeDescription: "Aquisição de lousa de vidro"
      },
      [
        {
          nuItemOrder: 1,
          txBudgetItemType: "Lousa de vidro",
          txDescription: "Lousa de vidro",
          txBudgetItemUnit: "Unidade",
          nuQuantity: 5,
          nuReferralValue: null
        }
      ]
    );

    expect(record.totalReferenceValue).toBeNull();
    expect(record.items[0]).toMatchObject({ quantity: 5, referenceValue: null });
  });

  it("upsert idempotente não duplica e continua após erro", async () => {
    const repo = new FakeQuotationRepository();
    const result1 = await collectOpenQuotationsWithClient(new FakeQuotationClient(), repo, {
      counties: [{ idCounty: 2209, name: "Ibirité" }],
      sleepFn: async () => undefined
    });
    const result2 = await collectOpenQuotationsWithClient(new FakeQuotationClient(), repo, {
      counties: [{ idCounty: 2209, name: "Ibirité" }],
      sleepFn: async () => undefined
    });

    expect(result1).toMatchObject({ found: 2, newCount: 1, updatedCount: 0, errorCount: 1 });
    expect(result2).toMatchObject({ found: 2, newCount: 0, updatedCount: 1, errorCount: 1 });
    expect(repo.rows.size).toBe(1);
  });
});

class FakeQuotationClient {
  async listOpenQuotations(_county: { idCounty: number; name: string }, page: number) {
    return page === 1
      ? { data: [listing, { ...listing, idBudget: 57 }], meta: { totalPages: 1 } }
      : { data: [], meta: { totalPages: 1 } };
  }

  async getBudgetDetail(record: typeof listing) {
    if (record.idBudget === 57) throw new Error("detalhe indisponível");
    return {
      schoolName: record.schoolName,
      countyName: record.countyName,
      expenseGroupDescription: record.expenseGroupDescription,
      initiativeDescription: "Compra de material escolar"
    };
  }

  async listBudgetItems() {
    return {
      data: [{ nuItemOrder: 1, txBudgetItemType: "Caderno", txDescription: "Caderno", txBudgetItemUnit: "UN", nuQuantity: 1, nuReferralValue: 10 }],
      meta: { totalPages: 1 }
    };
  }
}

class FakeQuotationRepository implements QuotationRepository {
  rows = new Map<string, unknown>();
  private run = 0;
  async startRun() { return ++this.run; }
  async finishRun() {}
  async upsertQuotation(record: { externalId: string }) {
    const exists = this.rows.has(record.externalId);
    this.rows.set(record.externalId, record);
    return exists ? "updated" as const : "new" as const;
  }
}
