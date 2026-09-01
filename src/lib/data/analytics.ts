import { createCompetitiveAnalytics } from "@/lib/analytics/competitive";
import { createProposalLossAnalytics } from "@/lib/analytics/proposal-losses";
import { db } from "@/lib/db";

export * from "@/lib/analytics/competitive";
export * from "@/lib/analytics/proposal-losses";
export const competitiveAnalytics = createCompetitiveAnalytics(db);
export const proposalLossAnalytics = createProposalLossAnalytics(db);
