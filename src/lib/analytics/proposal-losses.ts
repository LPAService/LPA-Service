import { desc, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { proposalLosses } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import { calculateLossGapPercent } from "@/lib/collector/proposal-losses";

type AnalyticsDatabase = NodePgDatabase<typeof schema>;

export type ProposalLossGroupAggregate = {
  expenseGroup: string;
  lossCount: number;
  medianPriceGapPct: number | null;
  medianPriceGapAmount: number | null;
};

export type ProposalLossWinnerRanking = {
  winnerSupplierId: number;
  winnerName: string | null;
  wins: number;
  knownWinnerTotalCount: number;
  medianWinnerTotal: number | null;
};

export type ProposalLossListItem = {
  orderId: string;
  idSubprogram: number;
  idSchool: number;
  idBudget: number;
  schoolName: string;
  countyName: string | null;
  expenseGroup: string;
  proposalDeadline: Date | null;
  ourSupplierId: number;
  ourTotal: number;
  winnerSupplierId: number;
  winnerName: string | null;
  winnerTotal: number | null;
  competitorCount: number;
  ourRank: number | null;
  estimatedValue: number | null;
  lossGapPercent: number | null;
};

type GroupAggregateRow = {
  expense_group: string;
  loss_count: number;
  median_price_gap_pct: number | null;
  median_price_gap_amount: number | null;
};

type WinnerRankingRow = {
  winner_supplier_id: number;
  winner_name: string | null;
  wins: number;
  known_winner_total_count: number;
  median_winner_total: number | null;
};

export function createProposalLossAnalytics(database: AnalyticsDatabase) {
  return {
    async getLossesByExpenseGroup(): Promise<ProposalLossGroupAggregate[]> {
      const result = await database.execute<GroupAggregateRow>(sql`
        select
          ${proposalLosses.expenseGroup} as expense_group,
          count(*)::integer as loss_count,
          percentile_cont(0.5) within group (
            order by ((${proposalLosses.ourTotal} - ${proposalLosses.winnerTotal}) / nullif(${proposalLosses.winnerTotal}, 0)) * 100
          ) filter (where ${proposalLosses.winnerTotal} is not null and ${proposalLosses.winnerTotal} > 0)::double precision as median_price_gap_pct,
          percentile_cont(0.5) within group (
            order by ${proposalLosses.ourTotal} - ${proposalLosses.winnerTotal}
          ) filter (where ${proposalLosses.winnerTotal} is not null)::double precision as median_price_gap_amount
        from ${proposalLosses}
        group by ${proposalLosses.expenseGroup}
        order by loss_count desc, ${proposalLosses.expenseGroup} asc
      `);

      return result.rows.map((row) => ({
        expenseGroup: row.expense_group,
        lossCount: row.loss_count,
        medianPriceGapPct: nullableFiniteNumber(row.median_price_gap_pct),
        medianPriceGapAmount: nullableFiniteNumber(row.median_price_gap_amount)
      }));
    },

    async getWinningCompetitors(limit = 20): Promise<ProposalLossWinnerRanking[]> {
      const safeLimit = sanitizePositiveInteger(limit, 20);
      const result = await database.execute<WinnerRankingRow>(sql`
        select
          ${proposalLosses.winnerSupplierId} as winner_supplier_id,
          nullif(${proposalLosses.winnerName}, '') as winner_name,
          count(*)::integer as wins,
          count(${proposalLosses.winnerTotal})::integer as known_winner_total_count,
          percentile_cont(0.5) within group (order by ${proposalLosses.winnerTotal})::double precision as median_winner_total
        from ${proposalLosses}
        group by ${proposalLosses.winnerSupplierId}, nullif(${proposalLosses.winnerName}, '')
        order by wins desc, ${proposalLosses.winnerSupplierId} asc
        limit ${safeLimit}
      `);

      return result.rows.map((row) => ({
        winnerSupplierId: row.winner_supplier_id,
        winnerName: row.winner_name,
        wins: row.wins,
        knownWinnerTotalCount: row.known_winner_total_count,
        medianWinnerTotal: nullableFiniteNumber(row.median_winner_total)
      }));
    },

    async listLosses(limit = 50): Promise<ProposalLossListItem[]> {
      const safeLimit = sanitizePositiveInteger(limit, 50);
      const rows = await database
        .select()
        .from(proposalLosses)
        .orderBy(desc(proposalLosses.proposalDeadline), desc(proposalLosses.id))
        .limit(safeLimit);

      return rows.map((row) => ({
        orderId: row.orderId,
        idSubprogram: row.idSubprogram,
        idSchool: row.idSchool,
        idBudget: row.idBudget,
        schoolName: row.schoolName,
        countyName: row.countyName,
        expenseGroup: row.expenseGroup,
        proposalDeadline: row.proposalDeadline,
        ourSupplierId: row.ourSupplierId,
        ourTotal: row.ourTotal,
        winnerSupplierId: row.winnerSupplierId,
        winnerName: row.winnerName,
        winnerTotal: row.winnerTotal,
        competitorCount: row.competitorCount,
        ourRank: row.ourRank,
        estimatedValue: row.estimatedValue,
        lossGapPercent: calculateLossGapPercent(row.ourTotal, row.winnerTotal)
      }));
    }
  };
}

function sanitizePositiveInteger(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function nullableFiniteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
