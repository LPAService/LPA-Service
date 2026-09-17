import { desc, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { bids, proposalLosses } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import { db } from "@/lib/db";

export type BidOutcome = "pendente" | "perdido" | "cancelado" | "sem_resultado" | "ganho";

export type BidFunnel = {
  total: number;
  pendente: number;
  perdido: number;
  cancelado: number;
  semResultado: number;
  ganho: number;
};

export type PriceDistanceDistribution = {
  totalWithKnownWinner: number;
  under5PctCount: number;
  under5PctShare: number;
  between5And15PctCount: number;
  between5And15PctShare: number;
  over15PctCount: number;
  over15PctShare: number;
  medianGapPercent: number | null;
  medianGapAmount: number | null;
  avgGapPercent: number | null;
  avgGapAmount: number | null;
  moreExpensiveCount: number;
  cheaperOrEqualCount: number;
};

export type MarginFeasibility = {
  totalEvaluated: number;
  reversibleCount: number;
  reversiblePct: number | null;
  belowCostCount: number;
  belowCostPct: number | null;
  noMarginDataCount: number;
  avgOriginalMargin: number | null;
  medianMarginToWinReversible: number | null;
  avgMarginToWinReversible: number | null;
};

export type RecurrenceExpenseGroup = {
  expenseGroup: string;
  lossCount: number;
  medianGapPercent: number | null;
  medianGapAmount: number | null;
  reversibleCount: number;
  belowCostCount: number;
};

export type RecurrenceCounty = {
  countyName: string;
  lossCount: number;
  medianGapPercent: number | null;
};

export type RecurrenceWinner = {
  winnerName: string;
  lossCount: number;
  medianGapPercent: number | null;
  medianWinnerTicket: number | null;
};

export type CompetitionStats = {
  avgRank: number | null;
  medianRank: number | null;
  avgCompetitorCount: number | null;
  medianCompetitorCount: number | null;
  rank2Count: number;
  rank3Count: number;
  rank4PlusCount: number;
  duelsCount: number;
  mediumDisputesCount: number;
  largeDisputesCount: number;
};

export type BidLossDetailItem = {
  id: number;
  orderId: string;
  quotationExternalId: string;
  schoolName: string | null;
  countyName: string | null;
  expenseGroup: string;
  detectedAt: Date;
  proposalDeadline: Date | null;
  outcome: BidOutcome;
  ourTotal: number | null;
  marginPercent: number | null;
  ourCost: number | null;
  winnerName: string | null;
  winnerTotal: number | null;
  gapAmount: number | null;
  gapPercent: number | null;
  marginToWinPercent: number | null;
  reversibleStatus: "reversivel" | "abaixo_custo" | "sem_margem" | "sem_vencedor";
  competitorCount: number | null;
  ourRank: number | null;
};

export type BidWinItem = {
  id: number;
  orderId: string;
  quotationExternalId: string;
  ourTotal: number | null;
  marginPercent: number | null;
  expenseGroup: string;
  countyName: string | null;
  detectedAt: Date;
  outcomeAt: Date | null;
  winPublicationId: string | null;
};

export type BidsReportData = {
  hasBids: boolean;
  totalBids: number;
  funnel: BidFunnel;
  distance: PriceDistanceDistribution;
  marginFeasibility: MarginFeasibility;
  recurrence: {
    byExpenseGroup: RecurrenceExpenseGroup[];
    byCounty: RecurrenceCounty[];
    byWinner: RecurrenceWinner[];
  };
  competition: CompetitionStats;
  lossDetails: BidLossDetailItem[];
  wins: BidWinItem[];
};

type QueryDatabase = NodePgDatabase<typeof schema>;

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return round2(median);
}

export function computeAverage(values: number[]): number | null {
  if (values.length === 0) return null;
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  return round2(avg);
}

export function createEmptyBidsReportData(): BidsReportData {
  return {
    hasBids: false,
    totalBids: 0,
    funnel: {
      total: 0,
      pendente: 0,
      perdido: 0,
      cancelado: 0,
      semResultado: 0,
      ganho: 0
    },
    distance: {
      totalWithKnownWinner: 0,
      under5PctCount: 0,
      under5PctShare: 0,
      between5And15PctCount: 0,
      between5And15PctShare: 0,
      over15PctCount: 0,
      over15PctShare: 0,
      medianGapPercent: null,
      medianGapAmount: null,
      avgGapPercent: null,
      avgGapAmount: null,
      moreExpensiveCount: 0,
      cheaperOrEqualCount: 0
    },
    marginFeasibility: {
      totalEvaluated: 0,
      reversibleCount: 0,
      reversiblePct: null,
      belowCostCount: 0,
      belowCostPct: null,
      noMarginDataCount: 0,
      avgOriginalMargin: null,
      medianMarginToWinReversible: null,
      avgMarginToWinReversible: null
    },
    recurrence: {
      byExpenseGroup: [],
      byCounty: [],
      byWinner: []
    },
    competition: {
      avgRank: null,
      medianRank: null,
      avgCompetitorCount: null,
      medianCompetitorCount: null,
      rank2Count: 0,
      rank3Count: 0,
      rank4PlusCount: 0,
      duelsCount: 0,
      mediumDisputesCount: 0,
      largeDisputesCount: 0
    },
    lossDetails: [],
    wins: []
  };
}

export async function getBidsReportData(database: QueryDatabase = db): Promise<BidsReportData> {
  try {
    const rows = await database
      .select({
        bidId: bids.id,
        orderId: bids.orderId,
        quotationExternalId: bids.quotationExternalId,
        preQuoteId: bids.preQuoteId,
        ourTotal: bids.ourTotal,
        marginPercent: bids.marginPercent,
        detectedAt: bids.detectedAt,
        proposalDeadline: bids.proposalDeadline,
        expenseGroup: bids.expenseGroup,
        countyName: bids.countyName,
        outcome: bids.outcome,
        outcomeAt: bids.outcomeAt,
        lossId: bids.lossId,
        winPublicationId: bids.winPublicationId,
        lossSchoolName: proposalLosses.schoolName,
        lossCountyName: proposalLosses.countyName,
        lossExpenseGroup: proposalLosses.expenseGroup,
        lossOurTotal: proposalLosses.ourTotal,
        lossWinnerName: proposalLosses.winnerName,
        lossWinnerTotal: proposalLosses.winnerTotal,
        lossCompetitorCount: proposalLosses.competitorCount,
        lossOurRank: proposalLosses.ourRank,
        lossEstimatedValue: proposalLosses.estimatedValue
      })
      .from(bids)
      .leftJoin(
        proposalLosses,
        sql`${bids.lossId} = ${proposalLosses.id} or (${bids.lossId} is null and ${bids.orderId} = ${proposalLosses.orderId})`
      )
      .orderBy(desc(bids.detectedAt), desc(bids.id));

    if (rows.length === 0) {
      return createEmptyBidsReportData();
    }

  // 1. Funil dos lances
  let pendente = 0;
  let perdido = 0;
  let cancelado = 0;
  let semResultado = 0;
  let ganho = 0;
  const wins: BidWinItem[] = [];

  for (const row of rows) {
    const outcome = row.outcome as BidOutcome;
    if (outcome === "pendente") pendente++;
    else if (outcome === "perdido") perdido++;
    else if (outcome === "cancelado") cancelado++;
    else if (outcome === "sem_resultado") semResultado++;
    else if (outcome === "ganho") {
      ganho++;
      wins.push({
        id: row.bidId,
        orderId: row.orderId,
        quotationExternalId: row.quotationExternalId,
        ourTotal: row.ourTotal,
        marginPercent: row.marginPercent,
        expenseGroup: row.expenseGroup,
        countyName: row.countyName,
        detectedAt: row.detectedAt,
        outcomeAt: row.outcomeAt,
        winPublicationId: row.winPublicationId
      });
    }
  }

  const funnel: BidFunnel = {
    total: rows.length,
    pendente,
    perdido,
    cancelado,
    semResultado,
    ganho
  };

  // 2. Distância do vencedor & 3. Margem viável & 6. Lance a lance
  const lossDetails: BidLossDetailItem[] = [];
  const validGapPercents: number[] = [];
  const validGapAmounts: number[] = [];
  let under5PctCount = 0;
  let between5And15PctCount = 0;
  let over15PctCount = 0;
  let moreExpensiveCount = 0;
  let cheaperOrEqualCount = 0;

  let reversibleCount = 0;
  let belowCostCount = 0;
  let noMarginDataCount = 0;
  const reversibleMarginsToWin: number[] = [];
  const evaluatedOriginalMargins: number[] = [];

  // 4. Recorrência tracking
  const groupStatsMap = new Map<
    string,
    { lossCount: number; gaps: number[]; gapAmounts: number[]; reversible: number; belowCost: number }
  >();

  const countyStatsMap = new Map<string, { lossCount: number; gaps: number[] }>();

  const winnerStatsMap = new Map<string, { lossCount: number; gaps: number[]; winnerTotals: number[] }>();

  // 5. Competição tracking
  const rankValues: number[] = [];
  const competitorCountValues: number[] = [];
  let rank2Count = 0;
  let rank3Count = 0;
  let rank4PlusCount = 0;
  let duelsCount = 0;
  let mediumDisputesCount = 0;
  let largeDisputesCount = 0;

  for (const row of rows) {
    if (row.outcome !== "perdido") continue;

    const ourTotal =
      row.ourTotal !== null && Number.isFinite(row.ourTotal)
        ? row.ourTotal
        : row.lossOurTotal !== null && Number.isFinite(row.lossOurTotal)
          ? row.lossOurTotal
          : null;

    const winnerTotal =
      row.lossWinnerTotal !== null && Number.isFinite(row.lossWinnerTotal) ? row.lossWinnerTotal : null;

    const expenseGroup = row.expenseGroup || row.lossExpenseGroup || "Outros";
    const countyName = row.countyName || row.lossCountyName || null;
    const winnerName = row.lossWinnerName?.trim() || null;
    const schoolName = row.lossSchoolName?.trim() || null;
    const competitorCount =
      row.lossCompetitorCount !== null && Number.isFinite(row.lossCompetitorCount)
        ? row.lossCompetitorCount
        : null;
    const ourRank =
      row.lossOurRank !== null && Number.isFinite(row.lossOurRank) ? row.lossOurRank : null;

    if (ourRank !== null) {
      rankValues.push(ourRank);
      if (ourRank === 2) rank2Count++;
      else if (ourRank === 3) rank3Count++;
      else if (ourRank >= 4) rank4PlusCount++;
    }

    if (competitorCount !== null) {
      competitorCountValues.push(competitorCount);
      if (competitorCount === 2) duelsCount++;
      else if (competitorCount >= 3 && competitorCount <= 5) mediumDisputesCount++;
      else if (competitorCount > 5) largeDisputesCount++;
    }

    let gapAmount: number | null = null;
    let gapPercent: number | null = null;
    let ourCost: number | null = null;
    let marginToWinPercent: number | null = null;
    let reversibleStatus: "reversivel" | "abaixo_custo" | "sem_margem" | "sem_vencedor" = "sem_vencedor";

    if (ourTotal !== null && ourTotal > 0 && winnerTotal !== null && winnerTotal > 0) {
      gapAmount = round2(ourTotal - winnerTotal);
      gapPercent = round2(((ourTotal - winnerTotal) / winnerTotal) * 100);

      validGapPercents.push(gapPercent);
      validGapAmounts.push(gapAmount);

      if (ourTotal > winnerTotal) {
        moreExpensiveCount++;
      } else {
        cheaperOrEqualCount++;
      }

      if (gapPercent < 5) {
        under5PctCount++;
      } else if (gapPercent <= 15) {
        between5And15PctCount++;
      } else {
        over15PctCount++;
      }

      // Cálculo de margem reversível
      if (row.marginPercent !== null && Number.isFinite(row.marginPercent) && row.marginPercent >= 0) {
        evaluatedOriginalMargins.push(row.marginPercent);
        ourCost = round2(ourTotal / (1 + row.marginPercent / 100));

        if (ourCost > 0) {
          marginToWinPercent = round2(((winnerTotal / ourCost) - 1) * 100);

          if (marginToWinPercent >= 0) {
            reversibleStatus = "reversivel";
            reversibleCount++;
            reversibleMarginsToWin.push(marginToWinPercent);
          } else {
            reversibleStatus = "abaixo_custo";
            belowCostCount++;
          }
        } else {
          reversibleStatus = "sem_margem";
          noMarginDataCount++;
        }
      } else {
        reversibleStatus = "sem_margem";
        noMarginDataCount++;
      }
    } else {
      reversibleStatus = "sem_vencedor";
    }

    // Recorrência: grupo de despesa
    const currentGroup = groupStatsMap.get(expenseGroup) ?? {
      lossCount: 0,
      gaps: [],
      gapAmounts: [],
      reversible: 0,
      belowCost: 0
    };
    currentGroup.lossCount++;
    if (gapPercent !== null) currentGroup.gaps.push(gapPercent);
    if (gapAmount !== null) currentGroup.gapAmounts.push(gapAmount);
    if (reversibleStatus === "reversivel") currentGroup.reversible++;
    if (reversibleStatus === "abaixo_custo") currentGroup.belowCost++;
    groupStatsMap.set(expenseGroup, currentGroup);

    // Recorrência: município
    if (countyName) {
      const currentCounty = countyStatsMap.get(countyName) ?? { lossCount: 0, gaps: [] };
      currentCounty.lossCount++;
      if (gapPercent !== null) currentCounty.gaps.push(gapPercent);
      countyStatsMap.set(countyName, currentCounty);
    }

    // Recorrência: vencedor
    if (winnerName) {
      const currentWinner = winnerStatsMap.get(winnerName) ?? { lossCount: 0, gaps: [], winnerTotals: [] };
      currentWinner.lossCount++;
      if (gapPercent !== null) currentWinner.gaps.push(gapPercent);
      if (winnerTotal !== null) currentWinner.winnerTotals.push(winnerTotal);
      winnerStatsMap.set(winnerName, currentWinner);
    }

    lossDetails.push({
      id: row.bidId,
      orderId: row.orderId,
      quotationExternalId: row.quotationExternalId,
      schoolName,
      countyName,
      expenseGroup,
      detectedAt: row.detectedAt,
      proposalDeadline: row.proposalDeadline,
      outcome: "perdido",
      ourTotal,
      marginPercent: row.marginPercent,
      ourCost,
      winnerName,
      winnerTotal,
      gapAmount,
      gapPercent,
      marginToWinPercent,
      reversibleStatus,
      competitorCount,
      ourRank
    });
  }

  const totalWithKnownWinner = validGapPercents.length;

  const distance: PriceDistanceDistribution = {
    totalWithKnownWinner,
    under5PctCount,
    under5PctShare: totalWithKnownWinner > 0 ? round2((under5PctCount / totalWithKnownWinner) * 100) : 0,
    between5And15PctCount,
    between5And15PctShare:
      totalWithKnownWinner > 0 ? round2((between5And15PctCount / totalWithKnownWinner) * 100) : 0,
    over15PctCount,
    over15PctShare: totalWithKnownWinner > 0 ? round2((over15PctCount / totalWithKnownWinner) * 100) : 0,
    medianGapPercent: computeMedian(validGapPercents),
    medianGapAmount: computeMedian(validGapAmounts),
    avgGapPercent: computeAverage(validGapPercents),
    avgGapAmount: computeAverage(validGapAmounts),
    moreExpensiveCount,
    cheaperOrEqualCount
  };

  const totalEvaluatedMargin = reversibleCount + belowCostCount;
  const marginFeasibility: MarginFeasibility = {
    totalEvaluated: totalEvaluatedMargin,
    reversibleCount,
    reversiblePct: totalEvaluatedMargin > 0 ? round2((reversibleCount / totalEvaluatedMargin) * 100) : null,
    belowCostCount,
    belowCostPct: totalEvaluatedMargin > 0 ? round2((belowCostCount / totalEvaluatedMargin) * 100) : null,
    noMarginDataCount,
    avgOriginalMargin: computeAverage(evaluatedOriginalMargins),
    medianMarginToWinReversible: computeMedian(reversibleMarginsToWin),
    avgMarginToWinReversible: computeAverage(reversibleMarginsToWin)
  };

  const byExpenseGroup: RecurrenceExpenseGroup[] = Array.from(groupStatsMap.entries())
    .map(([expenseGroup, stats]) => ({
      expenseGroup,
      lossCount: stats.lossCount,
      medianGapPercent: computeMedian(stats.gaps),
      medianGapAmount: computeMedian(stats.gapAmounts),
      reversibleCount: stats.reversible,
      belowCostCount: stats.belowCost
    }))
    .sort((a, b) => b.lossCount - a.lossCount || a.expenseGroup.localeCompare(b.expenseGroup));

  const byCounty: RecurrenceCounty[] = Array.from(countyStatsMap.entries())
    .map(([countyName, stats]) => ({
      countyName,
      lossCount: stats.lossCount,
      medianGapPercent: computeMedian(stats.gaps)
    }))
    .sort((a, b) => b.lossCount - a.lossCount || a.countyName.localeCompare(b.countyName))
    .slice(0, 10);

  const byWinner: RecurrenceWinner[] = Array.from(winnerStatsMap.entries())
    .map(([winnerName, stats]) => ({
      winnerName,
      lossCount: stats.lossCount,
      medianGapPercent: computeMedian(stats.gaps),
      medianWinnerTicket: computeMedian(stats.winnerTotals)
    }))
    .sort((a, b) => b.lossCount - a.lossCount || a.winnerName.localeCompare(b.winnerName))
    .slice(0, 10);

  const competition: CompetitionStats = {
    avgRank: computeAverage(rankValues),
    medianRank: computeMedian(rankValues),
    avgCompetitorCount: computeAverage(competitorCountValues),
    medianCompetitorCount: computeMedian(competitorCountValues),
    rank2Count,
    rank3Count,
    rank4PlusCount,
    duelsCount,
    mediumDisputesCount,
    largeDisputesCount
  };

    return {
      hasBids: true,
      totalBids: rows.length,
      funnel,
      distance,
      marginFeasibility,
      recurrence: {
        byExpenseGroup,
        byCounty,
        byWinner
      },
      competition,
      lossDetails,
      wins
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("Erro ao carregar dados de lances:", error);
    }
    return createEmptyBidsReportData();
  }
}
