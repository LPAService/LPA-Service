import { normalize } from "@/lib/text/normalize";

export const CESCOM_SOURCE = "cescom";

export type CescomProduct = {
  source: string;
  externalId: string;
  name: string;
  normalizedName: string;
  ean: string | null;
  brand: string | null;
  department: string | null;
  packaging: string | null;
  url: string | null;
};

const INFO_CLASS_RE = /class="product-card__info"/g;
const DATA_ATTR_RE = /(data-[a-z-]+)="([^"]*)"/g;
const ONCLICK_URL_RE = /onclick="window\.location='([^']+)'/;
const HREF_URL_RE = /<a\s+[^>]*href="([^"]+)"/;
const EAN_RE = /EAN:\s*(\d{8,14})/;
const EMBALAGEM_RE = /data-id-embalagem="([^"]+)"/;

/**
 * Extrai produtos da listagem de departamento da Cescom a partir do HTML bruto.
 * Cada card é ancorado no div `product-card__info`, que carrega os atributos
 * data-* (id-produto, nome, marca, departamento) e, logo abaixo, a legenda EAN.
 * A embalagem (data-id-embalagem) fica no wrapper `div-embalagem` imediatamente
 * anterior ao card. Sem rede, sem banco: função pura para teste fácil.
 */
export function extractProductsFromHtml(html: string): CescomProduct[] {
  const products = new Map<string, CescomProduct>();

  for (const match of html.matchAll(INFO_CLASS_RE)) {
    const start = match.index ?? 0;
    const window = html.slice(start, start + 2200);

    const attrs = new Map<string, string>();
    for (const attr of window.matchAll(DATA_ATTR_RE)) {
      if (!attrs.has(attr[1])) attrs.set(attr[1], attr[2]);
    }

    const externalId = attrs.get("data-id-produto") ?? "";
    const rawName = attrs.get("data-nome") ?? "";
    if (!externalId || !rawName) continue;
    if (products.has(externalId)) continue;

    const name = decodeEntities(rawName);
    const url = window.match(ONCLICK_URL_RE)?.[1] ?? window.match(HREF_URL_RE)?.[1] ?? null;
    const ean = window.match(EAN_RE)?.[1] ?? null;
    const packaging =
      html
        .slice(Math.max(0, start - 200), start)
        .match(EMBALAGEM_RE)?.[1] ?? null;

    products.set(externalId, {
      source: CESCOM_SOURCE,
      externalId,
      name,
      normalizedName: normalize(name),
      ean,
      brand: decodeNullable(attrs.get("data-marca")),
      department: decodeNullable(attrs.get("data-departamento")),
      packaging,
      url
    });
  }

  return [...products.values()];
}

/**
 * Lê o sitemap de departamentos (sitemap-departamentos.xml) e devolve a lista
 * ordenada de URLs de listagem. XML bruto -> string[].
 */
export function parseDepartmentSitemap(xml: string): string[] {
  const urls: string[] = [];
  const locRe = /<loc>\s*([^<]+?)\s*<\/loc>/g;
  for (const match of xml.matchAll(locRe)) {
    const url = match[1].trim();
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

/**
 * Devolve o número total de páginas de uma listagem de departamento, lido do
 * botão de paginação (`data-pages`). Fallback: 1 quando o marcador não existe.
 */
export function totalPagesFromHtml(html: string): number {
  const match = html.match(/data-click="paginate"[^>]*data-pages="(\d+)"/);
  if (!match) return 1;
  const pages = Number(match[1]);
  return Number.isInteger(pages) && pages > 0 ? pages : 1;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function decodeNullable(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const decoded = decodeEntities(value).trim();
  return decoded === "" ? null : decoded;
}
