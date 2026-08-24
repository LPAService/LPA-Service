import { describe, expect, it } from "vitest";
import { calcPreQuoteTotals, formatBRL, formatPercent } from "@/lib/prequote/calc";

describe("calcPreQuoteTotals", () => {
  it("soma custo, aplica margem e frete com arredondamento", () => {
    const totals = calcPreQuoteTotals(
      [
        { quantity: 2, unitCost: 10 },
        { quantity: 3, unitCost: 2.5 },
        { quantity: 1, unitCost: null }
      ],
      20,
      15.5
    );

    expect(totals).toEqual({
      costSubtotal: 27.5,
      freightCost: 15.5,
      marginPercent: 20,
      marginValue: 5.5,
      suggestedValue: 48.5,
      pricedCount: 2,
      missingCount: 1
    });
  });

  it("trata quantidade e custo inválidos como linha sem preço", () => {
    const totals = calcPreQuoteTotals(
      [
        { quantity: 0, unitCost: 10 },
        { quantity: 2, unitCost: -5 },
        { quantity: 2, unitCost: Number.NaN }
      ],
      0,
      0
    );

    expect(totals.pricedCount).toBe(0);
    expect(totals.missingCount).toBe(3);
    expect(totals.suggestedValue).toBe(0);
  });

  it("zera margem e frete negativos", () => {
    const totals = calcPreQuoteTotals([{ quantity: 1, unitCost: 100 }], -10, -20);

    expect(totals.marginPercent).toBe(0);
    expect(totals.freightCost).toBe(0);
    expect(totals.suggestedValue).toBe(100);
  });

  it("formata valores em BRL e percentuais com sinal", () => {
    expect(formatBRL(1234.5)).toBe("R$\u00A01.234,50");
    expect(formatBRL(null)).toBe("—");
    expect(formatPercent(12.34)).toBe("+12,3%");
    expect(formatPercent(-5)).toBe("-5%");
    expect(formatPercent(null)).toBe("—");
  });
});
