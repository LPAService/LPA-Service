/**
 * Descobre, na descrição do item, qual é a unidade que a escola REALMENTE quer.
 *
 * O campo "Unidade" do orçamento vem de um dropdown e frequentemente não bate
 * com o que a escola descreve. Caso real (orçamento 2026200309, EE Professor
 * Leon Renault): Unidade = "Pacote", Qtd = 330, e a descrição termina com
 * "contendo 30 unidades. (a unidade é PENTE)". O que a escola quer são 330
 * PENTES de ovos — quem precificar "pacote" imaginando caixa erra por um fator
 * enorme, e erro de unidade em licitação é prejuízo ou desclassificação.
 *
 * Esta função NÃO corrige a unidade sozinha. Ela só avisa que os dois campos
 * discordam e mostra os dois lados, porque quem decide o que precificar é o
 * fornecedor. Trocar a unidade calado seria repetir o erro da escola com mais
 * confiança.
 */
export type UnitHint = {
  /** Unidade declarada em texto, ex.: "PENTE" de "(a unidade é PENTE)". */
  declaredUnit: string | null;
  /** Quantos itens vêm na embalagem, ex.: 30 de "contendo 30 unidades". */
  packSize: number | null;
  /** true quando a descrição declara uma unidade diferente da do campo. */
  conflict: boolean;
};

const DECLARACAO_DE_UNIDADE = [
  // "(a unidade é PENTE)", "a unidade e pente", "sendo a unidade o PENTE"
  /\ba\s+unidade\s+(?:e|eh|é|sera|será|seja)\s+(?:o\s+|a\s+)?([a-zà-ÿ]{2,20})/i,
  /\bsendo\s+a\s+unidade\s+(?:o\s+|a\s+)?([a-zà-ÿ]{2,20})/i,
  /\bunidade\s*:\s*([a-zà-ÿ]{2,20})/i,
  // exige os dois-pontos: sem eles "a unidade de medida no ato da entrega"
  // capturava "no" como se fosse unidade.
  /\bunidade\s+de\s+medida\s*:\s*([a-zà-ÿ]{2,20})/i
];

const TAMANHO_DA_EMBALAGEM = [
  /\bcontendo\s+(\d{1,4})\s+unidades?\b/i,
  /\bembalagem\s+com\s+(\d{1,4})\s+unidades?\b/i,
  /\bpacote\s+com\s+(\d{1,4})\s+unidades?\b/i,
  /\bcom\s+(\d{1,4})\s+unidades?\s+cada\b/i
];

/** Palavras que aparecem na frase mas nunca são a unidade em si. */
const NAO_SAO_UNIDADE = new Set([
  "de", "do", "da", "em", "por", "com", "para", "cada", "item", "produto",
  "medida", "unidade", "unidades", "conforme", "igual", "acima", "abaixo",
  "no", "na", "ao", "os", "as", "um", "uma", "seu", "sua", "informada", "informado"
]);

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** "pentes" e "pente" são a mesma unidade; idem "pacotes"/"pacote". */
function semPlural(valor: string) {
  const base = normalizar(valor);
  return base.endsWith("s") && base.length > 3 ? base.slice(0, -1) : base;
}

export function extractUnitHint(
  description: string | null | undefined,
  fieldUnit: string | null | undefined
): UnitHint {
  const texto = String(description ?? "");
  const vazio: UnitHint = { declaredUnit: null, packSize: null, conflict: false };
  if (!texto.trim()) return vazio;

  let declaredUnit: string | null = null;
  for (const padrao of DECLARACAO_DE_UNIDADE) {
    const achado = texto.match(padrao);
    const candidato = achado?.[1]?.trim();
    if (!candidato) continue;
    if (NAO_SAO_UNIDADE.has(normalizar(candidato))) continue;
    declaredUnit = candidato.toUpperCase();
    break;
  }

  let packSize: number | null = null;
  for (const padrao of TAMANHO_DA_EMBALAGEM) {
    const achado = texto.match(padrao);
    if (!achado) continue;
    const n = Number(achado[1]);
    if (Number.isInteger(n) && n > 1) packSize = n;
    break;
  }

  const unidadeDoCampo = semPlural(String(fieldUnit ?? ""));
  const conflict =
    declaredUnit !== null && unidadeDoCampo.length > 0 && semPlural(declaredUnit) !== unidadeDoCampo;

  return { declaredUnit, packSize, conflict };
}

/** Frase pronta para a tela. Null quando não há nada digno de aviso. */
export function describeUnitHint(hint: UnitHint, fieldUnit: string, quantity: number): string | null {
  if (!hint.conflict || !hint.declaredUnit) return null;
  const quantidade = Number.isFinite(quantity) ? quantity.toLocaleString("pt-BR") : String(quantity);
  const embalagem = hint.packSize ? ` (a descrição fala em ${hint.packSize} unidades por embalagem)` : "";
  return `A escola marcou a unidade como "${fieldUnit}", mas a descrição diz que a unidade é ${hint.declaredUnit}${embalagem}. Confira se o preço é por ${hint.declaredUnit}: seriam ${quantidade} ${hint.declaredUnit}.`;
}
