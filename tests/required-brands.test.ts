import { describe, expect, it } from "vitest";
import { extractRequiredBrands } from "@/lib/prequote/required-brands";

describe("extractRequiredBrands", () => {
  it.each([
    ["Exigência de Marcas: Itambé, Porto Alegre e Quatá.", ["Itambé", "Porto Alegre", "Quatá"]],
    ["Marcas: PERFA,MORATO,APOLLO .", ["Perfa", "Morato", "Apollo"]],
    ["Marcas: baldini, Wickbold, Pullman .", ["Baldini", "Wickbold", "Pullman"]],
    ["Marcas: sabor do trigo,pão fofo,trigo mais .", ["Sabor do Trigo", "Pão Fofo", "Trigo Mais"]],
    ["marca:Planalto,Serro,São roque.", ["Planalto", "Serro", "São Roque"]],
    ["MARCAS EXIGIDAS : QUALY,DORIANA,DELICIA", ["Qualy", "Doriana", "Delicia"]]
  ])("extrai marcas exigidas de %s", (description, expected) => {
    expect(extractRequiredBrands(description)).toEqual(expected);
  });

  it("devolve lista vazia quando o item não exige marca", () => {
    expect(extractRequiredBrands("Açúcar cristal, pacote de 5 KG, validade mínima.")).toEqual([]);
  });
});
