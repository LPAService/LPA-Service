import { db } from "@/lib/db";
import { createCatalogSource } from "@/lib/catalog/source";

export const catalogSource = createCatalogSource(db);
