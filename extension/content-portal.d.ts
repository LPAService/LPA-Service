/**
 * Content script do portal: roda no Chrome e não exporta nada. A declaração
 * existe para os testes importarem pelos efeitos colaterais (registrar o
 * listener e publicar `globalThis.LPA_PORTAL`) sem TS reclamar de módulo sem tipo.
 */
export {};
