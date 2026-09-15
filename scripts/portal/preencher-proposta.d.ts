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
  pronto: boolean;
  encontrados: number;
  textosPreenchidos: number;
  /** Campos de valor que a ferramenta de teclado precisa digitar. */
  paraDigitar: Array<{ itemOrder: number; seletor: string; digitos: string; valorEsperado: number }>;
  faltando: Array<{ itemOrder: number; nome: string; motivo: string }>;
  divergencias: unknown[];
};

export type RelatorioConferencia = {
  ok: boolean;
  divergencias: Array<{
    itemOrder: number;
    campo: string;
    motivo?: string;
    esperado?: number;
    noCampo?: string | null;
    valorDigitado?: string;
  }>;
  aceiteMarcado: boolean | null;
};

export function preencherProposta(
  proposta: { items: ItemProposta[] },
  options?: { dryRun?: boolean }
): RelatorioPreenchimento;

export function conferirProposta(proposta: { items: ItemProposta[] }): RelatorioConferencia;
