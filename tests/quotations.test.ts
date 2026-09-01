import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { describe, expect, it, vi } from "vitest";
import {
  buildProposalUrl,
  buildQuotationExternalId,
  buildQuotationRecord,
  collectOpenQuotationsWithClient,
  defaultTier1Counties,
  getQuotationStatus,
  shouldRefreshQuotationFromListing,
  type QuotationRepository
} from "@/lib/collector/quotations";
import { analyzeProposalBlock } from "@/lib/collector/proposal-block";
import { createPostgresQuotationSource } from "@/lib/data/quotation-source";
import type * as schema from "@/lib/db/schema";

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
  it("usa os 10 municípios coletados na ordem comercial padrão", () => {
    expect(defaultTier1Counties().map((county) => county.name)).toEqual([
      "Ibirité",
      "Contagem",
      "Betim",
      "Belo Horizonte",
      "Ribeirão das Neves",
      "Lagoa Santa",
      "Nova Lima",
      "Sarzedo",
      "Brumadinho",
      "Mário Campos"
    ]);
  });

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

  it("devolve itens preenchidos ao listar cotações", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          external_id: buildQuotationExternalId(listing),
          nu_budget_order: listing.nuBudgetOrder,
          id_subprogram: listing.idSubprogram,
          id_school: listing.idSchool,
          id_budget: listing.idBudget,
          id_county: listing.idCounty,
          county_name: listing.countyName,
          school_name: listing.schoolName,
          expense_group: listing.expenseGroupDescription,
          headline: "Compra de material de limpeza",
          summary: "Detergente para escola.",
          top_items: ["Detergente"],
          proposal_deadline: listing.dtProposalSubmission,
          delivery_date: listing.dtServiceDelivery,
          item_count: 1,
          total_reference_value: 50,
          budget_status: listing.budgetStatus,
          supplier_status: listing.supplierStatus,
          proposal_url: buildProposalUrl(listing),
          proposal_blocked: false,
          proposal_blocked_reason: null,
          proposal_blocked_item_count: 0,
          proposal_suspect: false,
          proposal_suspect_item_count: 0,
          raw_json: listing,
          collected_at: "2026-08-13T12:00:00.000Z",
          category_slug: "limpeza",
          category_name: "Limpeza"
        }]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          quotation_id: 1,
          item_order: 1,
          name: "Detergente",
          description: "Detergente neutro",
          unit: "UN",
          quantity: 10,
          reference_value: 50
        }]
      });
    const database = { execute } as unknown as NodePgDatabase<typeof schema>;

    const result = await createPostgresQuotationSource(database).listOpportunities();

    expect(result.data[0]?.items).toEqual([{
      order: 1,
      name: "Detergente",
      description: "Detergente neutro",
      unit: "UN",
      quantity: 10,
      unitValue: null,
      totalValue: null,
      referenceValue: 5,
      isPermanent: false,
      expenseCategory: ""
    }]);
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

  it("detecta instrução real de não enviar proposta", () => {
    const record = buildQuotationRecord(
      { ...listing, nuBudgetOrder: "2026168340", idCounty: 2017, countyName: "Contagem", expenseGroupDescription: "Limpeza e Higiene" },
      {
        schoolName: "EE Teste",
        countyName: "Contagem",
        expenseGroupDescription: "Limpeza e Higiene",
        initiativeDescription: "Aditivo de contrato"
      },
      [
        {
          nuItemOrder: 1,
          txBudgetItemType: "Álcool líquido 70%",
          txDescription: "Álcool líquido 70%, embalagem de 01 litro. Aditivo referente ao contrato nº 02/2026 (PAS nº 04/2026) PAF Manutenção Operacional e Custeio Escolar. PROCESSO DE REGULARIZAÇÃO NO SISTEMA, NÃO ENVIAR PROPOSTA.",
          txBudgetItemUnit: "UN",
          nuQuantity: 1
        }
      ]
    );

    expect(record.proposalBlocked).toBe(true);
    expect(record.proposalBlockedItemCount).toBe(1);
    expect(record.proposalBlockedReason).toContain("NÃO ENVIAR PROPOSTA");
  });

  it("não marca descrição normal e trata regularização sem não enviar como suspeita", () => {
    expect(analyzeProposalBlock([{ description: "Detergente neutro para limpeza da escola." }])).toMatchObject({
      blocked: false,
      suspect: false
    });
    expect(analyzeProposalBlock([{ description: "Processo de regularização no sistema para ajuste administrativo." }])).toMatchObject({
      blocked: false,
      suspect: true,
      suspectItemCount: 1
    });
  });

  it("conta bloqueio parcial quando só alguns itens pedem para não enviar", () => {
    expect(analyzeProposalBlock([
      { description: "Caderno universitário comum." },
      { description: "Não é necessário enviar proposta para este item." },
      { description: "Caneta azul." }
    ])).toMatchObject({
      blocked: true,
      blockedItemCount: 1,
      itemCount: 3
    });
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
    expect(result2).toMatchObject({ found: 2, fetchedCount: 1, skippedCount: 1, newCount: 0, updatedCount: 0, errorCount: 1 });
    expect(repo.rows.size).toBe(1);
  });

  it("pula detalhe e itens quando a listagem não mudou", async () => {
    const repo = new FakeQuotationRepository();
    repo.rows.set(buildQuotationExternalId(listing), { rawJson: { listing } });
    const client = new CountingQuotationClient([{ countyId: 2209, page: 1, records: [listing], totalPages: 1 }]);

    const result = await collectOpenQuotationsWithClient(client, repo, {
      counties: [{ idCounty: 2209, name: "Ibirité" }],
      sleepFn: async () => undefined
    });

    expect(result).toMatchObject({ found: 1, fetchedCount: 0, skippedCount: 1, newCount: 0, updatedCount: 0, errorCount: 0 });
    expect(client.detailCalls).toBe(0);
    expect(client.itemCalls).toBe(0);
  });

  it("rebusca quando um sinal confiável da listagem mudou", async () => {
    const repo = new FakeQuotationRepository();
    repo.rows.set(buildQuotationExternalId(listing), {
      rawJson: { listing: { ...listing, dtProposalSubmission: "2026-08-19T12:00:00.000Z" } }
    });
    const client = new CountingQuotationClient([{ countyId: 2209, page: 1, records: [listing], totalPages: 1 }]);

    const result = await collectOpenQuotationsWithClient(client, repo, {
      counties: [{ idCounty: 2209, name: "Ibirité" }],
      sleepFn: async () => undefined
    });

    expect(shouldRefreshQuotationFromListing(listing, { listing: { ...listing, dtProposalSubmission: "2026-08-19T12:00:00.000Z" } })).toBe(true);
    expect(result).toMatchObject({ found: 1, fetchedCount: 1, skippedCount: 0, newCount: 0, updatedCount: 1, errorCount: 0 });
    expect(client.detailCalls).toBe(1);
    expect(client.itemCalls).toBe(1);
  });

  it("salva cursor por página e continua dele na próxima execução", async () => {
    const counties = [
      { idCounty: 2209, name: "Ibirité" },
      { idCounty: 2017, name: "Contagem" }
    ];
    const repo = new FakeQuotationRepository();
    const firstClient = new CountingQuotationClient([
      { countyId: 2209, page: 1, records: [listing], totalPages: 2 },
      { countyId: 2209, page: 2, records: [{ ...listing, idBudget: 57 }], totalPages: 2 },
      { countyId: 2017, page: 1, records: [{ ...listing, idBudget: 58, idCounty: 2017, countyName: "Contagem" }], totalPages: 1 }
    ]);
    const firstTicks = [0, 0, 0, 2];
    const result1 = await collectOpenQuotationsWithClient(firstClient, repo, {
      counties,
      sleepFn: async () => undefined,
      timeBudgetMs: 1,
      timeBudgetReserveMs: 0,
      nowFn: () => firstTicks.shift() ?? 2
    });

    expect(result1).toMatchObject({ status: "partial", resumeCursor: { countyId: 2209, countyName: "Ibirité", page: 2 } });
    expect(firstClient.listCalls).toEqual([{ countyId: 2209, page: 1 }]);

    const secondClient = new CountingQuotationClient([
      { countyId: 2209, page: 1, records: [listing], totalPages: 2 },
      { countyId: 2209, page: 2, records: [{ ...listing, idBudget: 57 }], totalPages: 2 },
      { countyId: 2017, page: 1, records: [{ ...listing, idBudget: 58, idCounty: 2017, countyName: "Contagem" }], totalPages: 1 }
    ]);
    const result2 = await collectOpenQuotationsWithClient(secondClient, repo, {
      counties,
      sleepFn: async () => undefined,
      nowFn: () => 0
    });

    expect(secondClient.listCalls[0]).toEqual({ countyId: 2209, page: 2 });
    expect(result2.status).toBe("completed");
    expect(result2.resumeCursor).toBeNull();
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
  rows = new Map<string, { externalId?: string; rawJson?: unknown }>();
  cursor = new Map<number, unknown>();
  private run = 0;
  async startRun() { return ++this.run; }
  async finishRun() {}
  async getResumeCursor(_mode: string, currentRunId: number) {
    return this.cursor.get(currentRunId - 1) as Awaited<ReturnType<QuotationRepository["getResumeCursor"]>> ?? null;
  }
  async saveCursor(runId: number, cursor: unknown) {
    this.cursor.set(runId, cursor);
  }
  async shouldFetchQuotation(record: typeof listing) {
    const row = this.rows.get(buildQuotationExternalId(record));
    return row ? shouldRefreshQuotationFromListing(record, row.rawJson) : true;
  }
  async upsertQuotation(record: { externalId: string }) {
    const exists = this.rows.has(record.externalId);
    this.rows.set(record.externalId, record);
    return exists ? "updated" as const : "new" as const;
  }
}

type ListingPage = {
  countyId: number;
  page: number;
  records: Array<typeof listing>;
  totalPages: number;
};

class CountingQuotationClient {
  detailCalls = 0;
  itemCalls = 0;
  listCalls: Array<{ countyId: number; page: number }> = [];

  constructor(private readonly pages: ListingPage[]) {}

  async listOpenQuotations(county: { idCounty: number }, page: number) {
    this.listCalls.push({ countyId: county.idCounty, page });
    const match = this.pages.find((entry) => entry.countyId === county.idCounty && entry.page === page);
    return {
      data: match?.records ?? [],
      meta: { totalPages: match?.totalPages ?? page }
    };
  }

  async getBudgetDetail(record: typeof listing) {
    this.detailCalls += 1;
    return {
      schoolName: record.schoolName,
      countyName: record.countyName,
      expenseGroupDescription: record.expenseGroupDescription,
      initiativeDescription: "Compra de material escolar"
    };
  }

  async listBudgetItems() {
    this.itemCalls += 1;
    return {
      data: [{ nuItemOrder: 1, txBudgetItemType: "Caderno", txDescription: "Caderno", txBudgetItemUnit: "UN", nuQuantity: 1, nuReferralValue: 10 }],
      meta: { totalPages: 1 }
    };
  }
}
