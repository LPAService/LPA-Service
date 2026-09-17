// @vitest-environment happy-dom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  computeAverage,
  computeMedian,
  createEmptyBidsReportData,
  getBidsReportData,
  round2,
  type BidsReportData
} from "@/lib/data/bids-report";
import { BidsReportSection } from "@/components/bids-report-section";

describe("bids-report unit & math tests", () => {
  it("round2 arredonda valores numéricos corretamente", () => {
    expect(round2(10.555)).toBe(10.56);
    expect(round2(10.554)).toBe(10.55);
    expect(round2(0)).toBe(0);
  });

  it("computeMedian lida com listas vazias, ímpares e pares", () => {
    expect(computeMedian([])).toBeNull();
    expect(computeMedian([10])).toBe(10);
    expect(computeMedian([10, 20, 30])).toBe(20);
    expect(computeMedian([10, 20, 30, 40])).toBe(25);
    expect(computeMedian([50, 10, 30])).toBe(30);
  });

  it("computeAverage calcula média aritmética", () => {
    expect(computeAverage([])).toBeNull();
    expect(computeAverage([10, 20, 30])).toBe(20);
    expect(computeAverage([15, 25])).toBe(20);
  });

  it("createEmptyBidsReportData retorna estrutura íntegra com hasBids = false", () => {
    const empty = createEmptyBidsReportData();
    expect(empty.hasBids).toBe(false);
    expect(empty.totalBids).toBe(0);
    expect(empty.funnel.total).toBe(0);
    expect(empty.funnel.pendente).toBe(0);
    expect(empty.funnel.perdido).toBe(0);
    expect(empty.funnel.semResultado).toBe(0);
    expect(empty.funnel.ganho).toBe(0);
    expect(empty.distance.totalWithKnownWinner).toBe(0);
    expect(empty.marginFeasibility.totalEvaluated).toBe(0);
    expect(empty.recurrence.byExpenseGroup).toEqual([]);
    expect(empty.recurrence.byCounty).toEqual([]);
    expect(empty.recurrence.byWinner).toEqual([]);
    expect(empty.lossDetails).toEqual([]);
  });

  it("getBidsReportData calcula funil, viabilidade de margem e distância corretamente", async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            orderBy: () =>
              Promise.resolve([
                {
                  bidId: 1,
                  orderId: "2026199999",
                  quotationExternalId: "702-8374-99999",
                  preQuoteId: 10,
                  ourTotal: 1200,
                  marginPercent: 20,
                  detectedAt: new Date("2026-09-10T10:00:00Z"),
                  proposalDeadline: new Date("2026-09-15T12:00:00Z"),
                  expenseGroup: "Material de Consumo",
                  countyName: "Belo Horizonte",
                  outcome: "perdido",
                  outcomeAt: new Date("2026-09-15T13:00:00Z"),
                  lossId: 100,
                  lossSchoolName: "EE Tiradentes",
                  lossCountyName: "Belo Horizonte",
                  lossExpenseGroup: "Material de Consumo",
                  lossOurTotal: 1200,
                  lossWinnerName: "Fornecedor Alfa",
                  lossWinnerTotal: 1080,
                  lossCompetitorCount: 4,
                  lossOurRank: 2,
                  lossEstimatedValue: 1500
                },
                {
                  bidId: 2,
                  orderId: "2026188888",
                  quotationExternalId: "702-8374-88888",
                  preQuoteId: 11,
                  ourTotal: 1500,
                  marginPercent: 25,
                  detectedAt: new Date("2026-09-11T10:00:00Z"),
                  proposalDeadline: new Date("2026-09-16T12:00:00Z"),
                  expenseGroup: "Gêneros Alimentícios",
                  countyName: "Contagem",
                  outcome: "perdido",
                  outcomeAt: new Date("2026-09-16T13:00:00Z"),
                  lossId: 101,
                  lossSchoolName: "EE Afonso Pena",
                  lossCountyName: "Contagem",
                  lossExpenseGroup: "Gêneros Alimentícios",
                  lossOurTotal: 1500,
                  lossWinnerName: "Comercial Beta",
                  lossWinnerTotal: 1100,
                  lossCompetitorCount: 5,
                  lossOurRank: 3,
                  lossEstimatedValue: 1800
                },
                {
                  bidId: 3,
                  orderId: "2026177777",
                  quotationExternalId: "702-8374-77777",
                  preQuoteId: null,
                  ourTotal: 500,
                  marginPercent: null,
                  detectedAt: new Date("2026-09-12T10:00:00Z"),
                  proposalDeadline: new Date("2026-09-17T12:00:00Z"),
                  expenseGroup: "Material de Consumo",
                  countyName: "Belo Horizonte",
                  outcome: "sem_resultado",
                  outcomeAt: new Date("2026-09-17T13:00:00Z"),
                  lossId: null,
                  lossSchoolName: null,
                  lossCountyName: null,
                  lossExpenseGroup: null,
                  lossOurTotal: null,
                  lossWinnerName: null,
                  lossWinnerTotal: null,
                  lossCompetitorCount: null,
                  lossOurRank: null,
                  lossEstimatedValue: null
                }
              ])
          })
        })
      })
    } as any;

    const data = await getBidsReportData(mockDb);

    expect(data.hasBids).toBe(true);
    expect(data.totalBids).toBe(3);
    expect(data.funnel.total).toBe(3);
    expect(data.funnel.perdido).toBe(2);
    expect(data.funnel.semResultado).toBe(1);
    expect(data.funnel.ganho).toBe(0);

    // Distância: 1 entre 5-15% (11.1%), 1 acima de 15% (36.4%)
    expect(data.distance.totalWithKnownWinner).toBe(2);
    expect(data.distance.between5And15PctCount).toBe(1);
    expect(data.distance.over15PctCount).toBe(1);

    // Margem: 1 reversível (marginToWin = 8%), 1 abaixo do custo (winner < cost)
    expect(data.marginFeasibility.totalEvaluated).toBe(2);
    expect(data.marginFeasibility.reversibleCount).toBe(1);
    expect(data.marginFeasibility.belowCostCount).toBe(1);
    expect(data.marginFeasibility.reversiblePct).toBe(50);
    expect(data.marginFeasibility.belowCostPct).toBe(50);

    // Recorrência
    expect(data.recurrence.byExpenseGroup.length).toBe(2);
    expect(data.recurrence.byCounty.length).toBe(2);
    expect(data.recurrence.byWinner.length).toBe(2);

    // Lance a lance
    expect(data.lossDetails.length).toBe(2);
    expect(data.lossDetails[0].reversibleStatus).toBe("reversivel");
    expect(data.lossDetails[1].reversibleStatus).toBe("abaixo_custo");
  });
});

describe("BidsReportSection component", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  function render(ui: React.ReactElement) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(ui);
    });
  }

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
  });

  it("renderiza estado vazio honesto quando não há lances registrados", () => {
    render(<BidsReportSection data={null} />);
    const text = container!.textContent || "";

    expect(text).toContain("Por que eu estou perdendo?");
    expect(text).toContain("Nenhum lance registrado até o momento");
    expect(text).toContain("status ENVI");
    expect(text).not.toContain("100% de vitórias");
  });

  it("renderiza diagnóstico completo respeitando honestidade e os 5 itens na ordem", () => {
    const mockData: BidsReportData = {
      hasBids: true,
      totalBids: 15,
      funnel: {
        total: 15,
        pendente: 3,
        perdido: 6,
        semResultado: 4,
        cancelado: 2,
        ganho: 0
      },
      distance: {
        totalWithKnownWinner: 6,
        under5PctCount: 2,
        under5PctShare: 33.3,
        between5And15PctCount: 3,
        between5And15PctShare: 50.0,
        over15PctCount: 1,
        over15PctShare: 16.7,
        medianGapPercent: 8.5,
        medianGapAmount: 180.0,
        avgGapPercent: 9.8,
        avgGapAmount: 220.0,
        moreExpensiveCount: 6,
        cheaperOrEqualCount: 0
      },
      marginFeasibility: {
        totalEvaluated: 6,
        reversibleCount: 4,
        reversiblePct: 66.7,
        belowCostCount: 2,
        belowCostPct: 33.3,
        noMarginDataCount: 0,
        avgOriginalMargin: 20.0,
        medianMarginToWinReversible: 9.5,
        avgMarginToWinReversible: 8.2
      },
      recurrence: {
        byExpenseGroup: [
          {
            expenseGroup: "Material de Consumo",
            lossCount: 4,
            medianGapPercent: 7.5,
            medianGapAmount: 150.0,
            reversibleCount: 3,
            belowCostCount: 1
          },
          {
            expenseGroup: "Gêneros Alimentícios",
            lossCount: 2,
            medianGapPercent: 12.0,
            medianGapAmount: 300.0,
            reversibleCount: 1,
            belowCostCount: 1
          }
        ],
        byCounty: [
          {
            countyName: "Belo Horizonte",
            lossCount: 4,
            medianGapPercent: 8.0
          },
          {
            countyName: "Contagem",
            lossCount: 2,
            medianGapPercent: 11.5
          }
        ],
        byWinner: [
          {
            winnerName: "Fornecedor Alfa",
            lossCount: 3,
            medianGapPercent: 6.5,
            medianWinnerTicket: 2400.0
          },
          {
            winnerName: "Comercial Beta",
            lossCount: 2,
            medianGapPercent: 14.0,
            medianWinnerTicket: 1800.0
          }
        ]
      },
      competition: {
        avgRank: 2.3,
        medianRank: 2,
        avgCompetitorCount: 4.5,
        medianCompetitorCount: 4,
        rank2Count: 4,
        rank3Count: 1,
        rank4PlusCount: 1,
        duelsCount: 1,
        mediumDisputesCount: 4,
        largeDisputesCount: 1
      },
      lossDetails: [
        {
          id: 1,
          orderId: "2026199999",
          quotationExternalId: "702-8374-99999",
          schoolName: "EE Tiradentes",
          countyName: "Belo Horizonte",
          expenseGroup: "Material de Consumo",
          detectedAt: new Date("2026-09-10T10:00:00Z"),
          proposalDeadline: new Date("2026-09-15T12:00:00Z"),
          outcome: "perdido",
          ourTotal: 1200.0,
          marginPercent: 20.0,
          ourCost: 1000.0,
          winnerName: "Fornecedor Alfa",
          winnerTotal: 1080.0,
          gapAmount: 120.0,
          gapPercent: 11.1,
          marginToWinPercent: 8.0,
          reversibleStatus: "reversivel",
          competitorCount: 4,
          ourRank: 2
        },
        {
          id: 2,
          orderId: "2026188888",
          quotationExternalId: "702-8374-88888",
          schoolName: "EE Afonso Pena",
          countyName: "Contagem",
          expenseGroup: "Gêneros Alimentícios",
          detectedAt: new Date("2026-09-11T10:00:00Z"),
          proposalDeadline: new Date("2026-09-16T12:00:00Z"),
          outcome: "perdido",
          ourTotal: 1500.0,
          marginPercent: 25.0,
          ourCost: 1200.0,
          winnerName: "Comercial Beta",
          winnerTotal: 1100.0,
          gapAmount: 400.0,
          gapPercent: 36.4,
          marginToWinPercent: -8.3,
          reversibleStatus: "abaixo_custo",
          competitorCount: 5,
          ourRank: 3
        }
      ]
    };

    render(<BidsReportSection data={mockData} />);
    const text = container!.textContent || "";

    // 1. Funil dos lances
    expect(text).toContain("Funil dos Lances Enviados");
    expect(text).toContain("Pendente");
    expect(text).toContain("Perdido");
    expect(text).toContain("Sem Resultado");
    expect(text).toContain("Cancelado");
    expect(text).toContain("Ganho");
    expect(text).toContain("0 vitórias públicas confirmadas");

    // Banner de honestidade obrigatória
    expect(text).toContain("Honestidade Obrigatória sobre a Fonte (Envelope Fechado)");
    expect(text).toContain("O portal Caixa Escolar MG opera em envelope fechado");
    expect(text).toContain("não significa vitória nem derrota");

    // 2. Distância do vencedor (<5%, 5-15%, >15%)
    expect(text).toContain("Item 2 · Distância do Vencedor");
    expect(text).toContain("Disputa no Detalhe (< 5%)");
    expect(text).toContain("Distância Moderada (5% a 15%)");
    expect(text).toContain("Distância Alta (> 15%)");
    expect(text).toContain("+8,5%"); // mediana
    expect(text).toContain("+R$ 180,00"); // gap amount

    // 3. Margem que teria ganhado
    expect(text).toContain("Item 3 · Simulação de Margem");
    expect(text).toContain("Reversíveis Cedendo Margem");
    expect(text).toContain("4 de 6");
    expect(text).toContain("Irreversíveis (Vencedor Abaixo do Custo)");
    expect(text).toContain("2 de 6");

    // 4. Recorrência
    expect(text).toContain("Item 4 · Recorrência");
    expect(text).toContain("Material de Consumo");
    expect(text).toContain("Belo Horizonte");
    expect(text).toContain("Fornecedor Alfa");

    // 5. Competição
    expect(text).toContain("Item 5 · Posicionamento Competitivo");
    expect(text).toContain("2,3º");
    expect(text).toContain("Vice-Campeão (2º Lugar)");

    // 6. Lance a lance
    expect(text).toContain("Item 6 · Detalhamento Completo");
    expect(text).toContain("2026199999");
    expect(text).toContain("EE Tiradentes");
    expect(text).toContain("Reversível com Margem");
    expect(text).toContain("2026188888");
    expect(text).toContain("Abaixo do Custo Base");
  });
});
