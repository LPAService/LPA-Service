/**
 * Tipos do script de preenchimento. O runtime é .js de propósito: ele é colado
 * cru na aba do portal, sem passar por build.
 */
export type ItemProposta = {
  itemOrder: number;
  name: string;
  quantity: number;
  unit: string;
  nuValueByItem: number;
  totalValue: number;
  txItemObservation: string;
  txWarrantyDescription: string;
};

export type RelatorioPreenchimento = {
  dryRun: boolean;
  ok: boolean;
  encontrados: number;
  preenchidos: number;
  faltando: Array<{ itemOrder: number; nome: string; motivo: string }>;
  divergencias: Array<{ itemOrder: number; campo: string; esperado: unknown; noCampo: string }>;
};

export function preencherProposta(
  proposta: { items: ItemProposta[] },
  options?: { dryRun?: boolean }
): RelatorioPreenchimento;
