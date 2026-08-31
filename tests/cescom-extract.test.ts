import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractProductsFromHtml,
  parseDepartmentSitemap,
  totalPagesFromHtml
} from "@/lib/collector/cescom";

const html = readFileSync(
  resolve(process.cwd(), "tests/fixtures/cescom-department.html"),
  "utf8"
);

describe("extractProductsFromHtml", () => {
  it("deduplica cards repetidos por external_id", () => {
    const products = extractProductsFromHtml(html);
    const ids = products.map((p) => p.externalId);
    expect(ids).toEqual(["25558", "30102", "40200"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("extrai nome, EAN, marca, departamento e url", () => {
    const products = extractProductsFromHtml(html);
    const creme = products.find((p) => p.externalId === "25558");

    expect(creme?.name).toBe("CREME DE LEITE LEVE TP ITALAC");
    expect(creme?.normalizedName).toBe("creme de leite leve tp italac");
    expect(creme?.ean).toBe("7898080640222");
    expect(creme?.brand).toBe("ITALAC");
    expect(creme?.department).toBe("LATICÍNIOS > CREME DE LEITE");
    expect(creme?.url).toBe("https://www.cescom.com.br/creme-de-leite-leve-tp-italac-25558");
    expect(creme?.source).toBe("cescom");
  });

  it("extrai embalagem do wrapper div-embalagem", () => {
    const products = extractProductsFromHtml(html);
    const detergente = products.find((p) => p.externalId === "30102");

    expect(detergente?.packaging).toBe("99000301027896031159028000000001");
    expect(detergente?.brand).toBe("YPE");
    expect(detergente?.department).toBe("LIMPEZA > COZINHA");
  });

  it("card sem EAN fica com ean null (nunca inventa valor)", () => {
    const products = extractProductsFromHtml(html);
    const pao = products.find((p) => p.externalId === "40200");

    expect(pao).toBeDefined();
    expect(pao?.ean).toBeNull();
    expect(pao?.brand).toBeNull();
    expect(pao?.name).toBe("PÃO FRANCÊS KG");
  });
});

describe("parseDepartmentSitemap", () => {
  it("lê as URLs de <loc>", () => {
    const xml = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.cescom.com.br/alimentos</loc></url>
  <url><loc>https://www.cescom.com.br/alimentos/laticinios</loc></url>
  <url><loc>https://www.cescom.com.br/bebidas</loc></url>
</urlset>`;

    expect(parseDepartmentSitemap(xml)).toEqual([
      "https://www.cescom.com.br/alimentos",
      "https://www.cescom.com.br/alimentos/laticinios",
      "https://www.cescom.com.br/bebidas"
    ]);
  });
});

describe("totalPagesFromHtml", () => {
  it("lê data-pages do botão de paginação", () => {
    const htmlWithPagination =
      '<button type="button" data-click="paginate" data-pages="7" data-perpage="24" class="d-none"></button>';
    expect(totalPagesFromHtml(htmlWithPagination)).toBe(7);
  });

  it("devolve 1 quando não há marcador de paginação", () => {
    expect(totalPagesFromHtml("<div>sem paginação</div>")).toBe(1);
  });
});
