import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { watchedQuotations } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";

type WatchDatabase = NodePgDatabase<typeof schema>;

export type WatchStore = {
  isWatched(userId: number, externalId: string): Promise<boolean>;
  listWatchedExternalIds(userId: number): Promise<string[]>;
  setWatched(userId: number, externalId: string, watched: boolean): Promise<boolean>;
};

export function createWatchStore(database: WatchDatabase): WatchStore {
  return {
    async isWatched(userId, externalId) {
      const cleanId = cleanExternalId(externalId);
      if (!cleanId || !isPositiveUserId(userId)) return false;
      const rows = await database
        .select({ id: watchedQuotations.id })
        .from(watchedQuotations)
        .where(
          and(
            eq(watchedQuotations.userId, userId),
            eq(watchedQuotations.quotationExternalId, cleanId)
          )
        )
        .limit(1);
      return rows.length > 0;
    },

    async listWatchedExternalIds(userId) {
      if (!isPositiveUserId(userId)) return [];
      const rows = await database
        .select({ externalId: watchedQuotations.quotationExternalId })
        .from(watchedQuotations)
        .where(eq(watchedQuotations.userId, userId))
        .orderBy(watchedQuotations.quotationExternalId);
      return rows.map((row) => row.externalId);
    },

    async setWatched(userId, externalId, watched) {
      const cleanId = cleanExternalId(externalId);
      if (!cleanId || !isPositiveUserId(userId)) return false;
      if (watched) {
        await database
          .insert(watchedQuotations)
          .values({ userId, quotationExternalId: cleanId })
          .onConflictDoNothing({
            target: [watchedQuotations.userId, watchedQuotations.quotationExternalId]
          });
        return true;
      }
      await database
        .delete(watchedQuotations)
        .where(
          and(
            eq(watchedQuotations.userId, userId),
            eq(watchedQuotations.quotationExternalId, cleanId)
          )
        );
      return false;
    }
  };
}

function cleanExternalId(externalId: string) {
  const cleanId = externalId.trim();
  return cleanId || null;
}

function isPositiveUserId(userId: number) {
  return Number.isInteger(userId) && userId > 0;
}
