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

export function calcPreQuoteTotals(
  lines: PreQuoteLine[],
  marginPercent: number,
  freightCost: number
): PreQuoteTotals {
  let costSubtotal = 0;
  let pricedCount = 0;
  for (const line of lines) {
    const quantity = Number.isFinite(line.quantity) && line.quantity > 0 ? line.quantity : 0;
    const unitCost =
      line.unitCost !== null && Number.isFinite(line.unitCost) && line.unitCost >= 0 ? line.unitCost : null;
    if (unitCost === null || quantity <= 0) continue;
    pricedCount++;
    costSubtotal += quantity * unitCost;
  }
  const safeMargin = Number.isFinite(marginPercent) ? Math.max(0, marginPercent) : 0;
  const safeFreight = Number.isFinite(freightCost) && freightCost >= 0 ? freightCost : 0;
  const marginValue = costSubtotal * (safeMargin / 100);
  return {
    costSubtotal: round2(costSubtotal),
    freightCost: round2(safeFreight),
    marginPercent: round2(safeMargin),
    marginValue: round2(marginValue),
    suggestedValue: round2(costSubtotal + marginValue + safeFreight),
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

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
