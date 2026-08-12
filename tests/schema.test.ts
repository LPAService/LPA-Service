import { describe, expect, it } from "vitest";
import { opportunities } from "@/lib/db/schema";

describe("db schema", () => {
  it("keeps raw_json available for source-field drift", () => {
    expect(opportunities.rawJson.name).toBe("raw_json");
  });
});

