import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import catalogRows from "@/lib/catalog/cescom-catalog.json";
import { referenceProducts } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";

const CESCOM_SOURCE = "cescom";
const DEFAULT_BATCH_SIZE = 500;

type CatalogDatabase = NodePgDatabase<typeof schema>;

type CescomCatalogRow = {
  source: string;
  external_id: string;
  name: string;
  normalized_name: string;
  ean: string | null;
  brand: string | null;
  department: string | null;
  packaging: string | null;
  url: string | null;
};

type ReferenceProductInsert = typeof referenceProducts.$inferInsert;

export type CescomCatalogLoadResult = {
  source: "cescom";
  fileRows: number;
  existingRows: number;
  processedRows: number;
  skipped: boolean;
  durationMs: number;
};

const cescomCatalog = catalogRows as CescomCatalogRow[];

export function cescomCatalogCount(): number {
  return cescomCatalog.length;
}

export async function loadCescomCatalog(
  database: CatalogDatabase,
  options: { batchSize?: number; now?: () => number } = {}
): Promise<CescomCatalogLoadResult> {
  const now = options.now ?? Date.now;
  const startedAt = now();
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("batchSize must be a positive integer");
  }

  const existingRows = await countCescomRows(database);
  if (existingRows === cescomCatalog.length) {
    return {
      source: CESCOM_SOURCE,
      fileRows: cescomCatalog.length,
      existingRows,
      processedRows: 0,
      skipped: true,
      durationMs: now() - startedAt
    };
  }

  for (let index = 0; index < cescomCatalog.length; index += batchSize) {
    const batch = cescomCatalog.slice(index, index + batchSize).map(toInsertRow);
    await database
      .insert(referenceProducts)
      .values(batch)
      .onConflictDoUpdate({
        target: [referenceProducts.source, referenceProducts.externalId],
        set: {
          name: sql`excluded.name`,
          normalizedName: sql`excluded.normalized_name`,
          ean: sql`excluded.ean`,
          brand: sql`excluded.brand`,
          department: sql`excluded.department`,
          packaging: sql`excluded.packaging`,
          url: sql`excluded.url`,
          updatedAt: sql`now()`
        }
      });
  }

  return {
    source: CESCOM_SOURCE,
    fileRows: cescomCatalog.length,
    existingRows,
    processedRows: cescomCatalog.length,
    skipped: false,
    durationMs: now() - startedAt
  };
}

async function countCescomRows(database: CatalogDatabase): Promise<number> {
  const [row] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(referenceProducts)
    .where(eq(referenceProducts.source, CESCOM_SOURCE));
  return Number(row?.count ?? 0);
}

function toInsertRow(row: CescomCatalogRow): ReferenceProductInsert {
  return {
    source: row.source,
    externalId: row.external_id,
    name: row.name,
    normalizedName: row.normalized_name,
    ean: row.ean,
    brand: row.brand,
    department: row.department,
    packaging: row.packaging,
    url: row.url
  };
}
