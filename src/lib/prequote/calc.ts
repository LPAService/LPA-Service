export type PreQuoteLine = {
  quantity: number;
  unitCost: number | null;
};

export type PreQuoteTotals = {
  costSubtotal: number;
  freightCost: number;
  marginPercent: number;
  marginValue: number;
  suggestedValue: number;
  pricedCount: number;
  missingCount: number;
};

export type PreQuoteLineTotals = {
  unitFinalCost: number | null;
  lineTotal: number | null;
};

export function calcPreQuoteLineTotals(
  line: PreQuoteLine,
  marginPercent: number
): PreQuoteLineTotals {
  const quantity = Number.isFinite(line.quantity) && line.quantity > 0 ? line.quantity : 0;
  const unitCost =
    line.unitCost !== null && Number.isFinite(line.unitCost) && line.unitCost >= 0 ? line.unitCost : null;
  if (unitCost === null || quantity <= 0) {
    return { unitFinalCost: null, lineTotal: null };
  }
  const safeMargin = Number.isFinite(marginPercent) ? Math.max(0, marginPercent) : 0;
  const unitFinalCost = round2(unitCost * (1 + safeMargin / 100));
  return {
    unitFinalCost,
    lineTotal: round2(unitFinalCost * quantity)
  };
}

export function calcPreQuoteTotals(
  lines: PreQuoteLine[],
  marginPercent: number,
  freightCost: number
): PreQuoteTotals {
  let costSubtotal = 0;
  let pricedLineTotal = 0;
  let pricedCount = 0;
  for (const line of lines) {
    const quantity = Number.isFinite(line.quantity) && line.quantity > 0 ? line.quantity : 0;
    const unitCost =
      line.unitCost !== null && Number.isFinite(line.unitCost) && line.unitCost >= 0 ? line.unitCost : null;
    if (unitCost === null || quantity <= 0) continue;
    pricedCount++;
    costSubtotal += quantity * unitCost;
    pricedLineTotal += calcPreQuoteLineTotals(line, marginPercent).lineTotal ?? 0;
  }
  const safeMargin = Number.isFinite(marginPercent) ? Math.max(0, marginPercent) : 0;
  const safeFreight = Number.isFinite(freightCost) && freightCost >= 0 ? freightCost : 0;
  const roundedCostSubtotal = round2(costSubtotal);
  const suggestedWithoutFreight = round2(pricedLineTotal);
  return {
    costSubtotal: roundedCostSubtotal,
    freightCost: round2(safeFreight),
    marginPercent: round2(safeMargin),
    marginValue: round2(suggestedWithoutFreight - roundedCostSubtotal),
    suggestedValue: round2(suggestedWithoutFreight + safeFreight),
    pricedCount,
    missingCount: lines.length - pricedCount
  };
}

export function formatBRL(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function round2(value: number) {
  return Math.round(value * 100) / 100;
}
