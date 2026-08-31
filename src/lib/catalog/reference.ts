import { asc, eq, ilike } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { referenceProducts } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import { normalize } from "@/lib/text/normalize";

export type ReferenceProduct = {
  id: number;
  source: string;
  externalId: string;
  name: string;
  normalizedName: string;
  ean: string | null;
  brand: string | null;
  department: string | null;
  packaging: string | null;
  url: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ReferenceDatabase = NodePgDatabase<typeof schema>;

/**
 * Busca produtos de referência por nome (normalizado, case/acento-insensível).
 * Substring em normalized_name; plugar depois na tela de pré-orçamento.
 */
export async function searchReferenceProducts(
  database: ReferenceDatabase,
  query: string,
  limit = 20
): Promise<ReferenceProduct[]> {
  const term = normalize(query).trim();
  if (!term) return [];
  return database
    .select()
    .from(referenceProducts)
    .where(ilike(referenceProducts.normalizedName, `%${term}%`))
    .orderBy(asc(referenceProducts.normalizedName))
    .limit(limit);
}

/**
 * Busca produto de referência pelo EAN exato. Null quando não existe.
 */
export async function findReferenceByEan(
  database: ReferenceDatabase,
  ean: string
): Promise<ReferenceProduct | null> {
  const term = ean.trim();
  if (!term) return null;
  const rows = await database
    .select()
    .from(referenceProducts)
    .where(eq(referenceProducts.ean, term))
    .limit(1);
  return rows[0] ?? null;
}
