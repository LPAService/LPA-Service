import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { extractRequiredBrands } from "@/lib/prequote/required-brands";

type ChosenBrandRow = {
  item_order: number;
  chosen_brand: string | null;
};

type BrandInputItem = {
  itemOrder?: unknown;
  chosenBrand?: unknown;
};

type PreQuoteItemBrandFields = {
  itemOrder: number;
  description: string;
};

export async function loadChosenBrandMap(preQuoteId: number) {
  const result = await db.execute<ChosenBrandRow>(sql`
    select item_order, chosen_brand
    from pre_quote_items
    where pre_quote_id = ${preQuoteId}
  `);

  return new Map(result.rows.map((row) => [row.item_order, cleanChosenBrand(row.chosen_brand)]));
}

export async function persistChosenBrands(
  preQuoteId: number,
  inputItems: unknown,
  previousChoices = new Map<number, string | null>()
) {
  if (!Array.isArray(inputItems)) return;

  await Promise.all(
    inputItems.map((item) => {
      const input = item as BrandInputItem;
      const itemOrder = Number(input.itemOrder);
      if (!Number.isInteger(itemOrder) || itemOrder <= 0) return Promise.resolve();

      const hasChosenBrand = Object.prototype.hasOwnProperty.call(input, "chosenBrand");
      const chosenBrand = hasChosenBrand
        ? cleanChosenBrand(input.chosenBrand)
        : previousChoices.get(itemOrder) ?? null;

      return db.execute(sql`
        update pre_quote_items
        set chosen_brand = ${chosenBrand}
        where pre_quote_id = ${preQuoteId}
          and item_order = ${itemOrder}
      `);
    })
  );
}

export function withBrandFields<T extends PreQuoteItemBrandFields, P extends { items: T[] }>(
  preQuote: P,
  choices: Map<number, string | null>
) {
  return {
    ...preQuote,
    items: preQuote.items.map((item) => ({
      ...item,
      brandOptions: extractRequiredBrands(item.description),
      chosenBrand: choices.get(item.itemOrder) ?? null
    }))
  };
}

function cleanChosenBrand(value: unknown) {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean ? clean.slice(0, 200) : null;
}
