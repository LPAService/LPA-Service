export function formatQuantity(value: number) {
  if (!Number.isFinite(value)) return "Quantidade não informada";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(value);
}

export function formatUnit(value: string, quantity: number) {
  const clean = value.trim();
  if (!clean) return "unidade";
  if (/^unidade$/i.test(clean) && quantity !== 1) return "unidades";
  return clean;
}

export function formatQuantityWithUnit(quantity: number, unit: string) {
  return `${formatQuantity(quantity)} ${formatUnit(unit, quantity)}`;
}
