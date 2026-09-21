import { describe, expect, it } from "vitest";
import { opportunities, preQuoteItems } from "@/lib/db/schema";

describe("db schema", () => {
  it("keeps raw_json available for source-field drift", () => {
    expect(opportunities.rawJson.name).toBe("raw_json");
  });

  it("keeps chosen_brand on pre_quote_items for portal-required brands", () => {
    expect(preQuoteItems.chosenBrand.name).toBe("chosen_brand");
  });
});
