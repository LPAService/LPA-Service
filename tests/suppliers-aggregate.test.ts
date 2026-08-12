import { describe, expect, it } from "vitest";
import { normalizeProductName, preferredName } from "@/lib/suppliers/aggregate";

describe("supplier product aggregation", () => {
  it("colapsa caixa, acentos e variante branco", () => {
    expect(normalizeProductName("arroz tipo 1")).toBe("arroz tipo 1");
    expect(normalizeProductName("ARROZ TIPO 1")).toBe("arroz tipo 1");
    expect(normalizeProductName("arroz branco tipo 1")).toBe("arroz tipo 1");
  });

  it("escolhe nome comercial determinístico", () => {
    expect(preferredName(["ARROZ TIPO 1", "Arroz tipo 1"])).toBe("Arroz tipo 1");
  });
});
