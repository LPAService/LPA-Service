import { createCompetitiveAnalytics } from "@/lib/analytics/competitive";
import { db } from "@/lib/db";

export * from "@/lib/analytics/competitive";
export const competitiveAnalytics = createCompetitiveAnalytics(db);
