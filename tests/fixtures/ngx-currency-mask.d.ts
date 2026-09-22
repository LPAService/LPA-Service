/** Tipos do porte da máscara de moeda do portal (ver ngx-currency-mask.js). */
export type CurrencyMaskOptions = {
  align?: string;
  allowNegative?: boolean;
  decimal?: string;
  precision?: number;
  prefix?: string;
  suffix?: string;
  thousands?: string;
};

export type CurrencyMaskHandle = {
  onModelChange: (value: number | null) => void;
  isReadOnly(): boolean;
  setValue(value: number | null): void;
};

export function attachCurrencyMask(
  input: HTMLInputElement,
  init?: { onModelChange?: (value: number | null) => void; options?: CurrencyMaskOptions }
): CurrencyMaskHandle;

export function formatBRL(value: number | null): string;
