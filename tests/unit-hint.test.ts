import { describe, expect, it } from "vitest";
import { describeUnitHint, extractUnitHint } from "@/lib/prequote/unit-hint";

const OVOS =
  "Ovo de galinha tipo comercial, tamanho grande ou extra, fresco. Casca íntegra, limpa, lisa, " +
  "sem rachaduras, furos ou sujidades. Embalado em estojos de papelão ou plástico apropriado para " +
  "transporte de alimentos, limpos e rígidos, contendo 30 unidades. (a unidade é PENTE).";

describe("unidade declarada na descrição", () => {
  it("caso real dos ovos: campo diz Pacote, descrição diz PENTE", () => {
    const hint = extractUnitHint(OVOS, "Pacote");
    expect(hint).toEqual({ declaredUnit: "PENTE", packSize: 30, conflict: true });
  });

  it("monta o aviso com a quantidade na unidade certa", () => {
    const aviso = describeUnitHint(extractUnitHint(OVOS, "Pacote"), "Pacote", 330);
    expect(aviso).toContain('marcou a unidade como "Pacote"');
    expect(aviso).toContain("a unidade é PENTE");
    expect(aviso).toContain("30 unidades por embalagem");
    expect(aviso).toContain("seriam 330 PENTE");
  });

  it("não acusa conflito quando a descrição concorda com o campo", () => {
    const hint = extractUnitHint("Arroz tipo 1. A unidade é PACOTE de 5kg.", "Pacote");
    expect(hint.declaredUnit).toBe("PACOTE");
    expect(hint.conflict).toBe(false);
    expect(describeUnitHint(hint, "Pacote", 10)).toBeNull();
  });

  it("plural não vira conflito: PENTES e Pente são a mesma unidade", () => {
    expect(extractUnitHint("A unidade é PENTES.", "Pente").conflict).toBe(false);
  });

  it("descrição sem declaração de unidade não inventa nada", () => {
    const hint = extractUnitHint("Feijão carioca tipo 1, grãos íntegros, safra corrente.", "Kg");
    expect(hint).toEqual({ declaredUnit: null, packSize: null, conflict: false });
    expect(describeUnitHint(hint, "Kg", 50)).toBeNull();
  });

  it("descrição vazia ou ausente não quebra", () => {
    expect(extractUnitHint(null, "Kg").conflict).toBe(false);
    expect(extractUnitHint("", "Kg").conflict).toBe(false);
    expect(extractUnitHint("A unidade é FRASCO.", null).conflict).toBe(false);
  });

  it("pega o tamanho da embalagem sozinho, sem declarar unidade", () => {
    const hint = extractUnitHint("Caderno universitário, embalagem com 10 unidades.", "Pacote");
    expect(hint.packSize).toBe(10);
    expect(hint.declaredUnit).toBeNull();
    expect(hint.conflict).toBe(false);
  });

  it("ignora palavra de ligação que cairia no lugar da unidade", () => {
    // "a unidade de medida" não deve virar declaredUnit="de"
    expect(extractUnitHint("Informar a unidade de medida no ato da entrega.", "Kg").declaredUnit).toBeNull();
  });

  it("aceita a forma sem acento, que aparece muito nos editais", () => {
    expect(extractUnitHint("Ovos brancos, a unidade e PENTE.", "Pacote")).toMatchObject({
      declaredUnit: "PENTE",
      conflict: true
    });
  });
});
