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
  paraDigitar: Array<{
    itemOrder: number;
    campoId: string;
    seletor: string;
    digitos: string;
    valor: number;
    valorEsperado: number;
  }>;
  faltando: Array<{ itemOrder: number; nome: string; motivo: "fora-desta-pagina" | "inexistente" }>;
  divergencias: unknown[];
};

export type ItemConferencia = {
  itemOrder: number;
  esperado: number;
  lido: number | null;
  ok: boolean;
};

export type RelatorioConferencia = {
  ok: boolean;
  itens: ItemConferencia[];
  faltando: Array<{ itemOrder: number; nome: string; motivo: "fora-desta-pagina" | "inexistente" }>;
  divergencias: ItemConferencia[];
};

export function preencherProposta(
  proposta: { items: ItemProposta[] },
  options?: { dryRun?: boolean }
): RelatorioPreenchimento;

export function conferirProposta(proposta: { items: ItemProposta[] }): RelatorioConferencia;
