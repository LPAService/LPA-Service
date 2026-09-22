// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { attachCurrencyMask, formatBRL } from "./fixtures/ngx-currency-mask.js";
import "../extension/portal-fill.js";

type FillEngine = {
  toDigits(value: number): string;
  toNumber(text: string): number | null;
  readTotal(itemOrder: number): number | null;
  missingReason(itemOrder: number): string;
  setTextField(el: Element, value: string): void;
  fillVisibleItems(
    items: ProposalItem[],
    onProgress?: (item: ProposalItem) => void
  ): Promise<{
    filled: Array<{ itemOrder: number; expected: number; read: number | null }>;
    missing: Array<{ itemOrder: number; reason: string }>;
    mismatched: Array<{ itemOrder: number; expected: number; read: number | null }>;
  }>;
  verifyItems(items: ProposalItem[]): {
    ok: boolean;
    lines: Array<{ itemOrder: number; expected: number; read: number | null; ok: boolean }>;
    missing: Array<{ itemOrder: number }>;
    mismatched: Array<{ itemOrder: number }>;
  };
};

type ProposalItem = {
  itemOrder: number;
  name: string;
  quantity: number;
  nuValueByItem: number;
  totalValue: number;
  txItemObservation: string;
  txWarrantyDescription: string;
};

const fill = (globalThis as unknown as { LPA_FILL: FillEngine }).LPA_FILL;

const item = (itemOrder: number, over: Partial<ProposalItem> = {}): ProposalItem => ({
  itemOrder,
  name: `Item ${itemOrder}`,
  quantity: 330,
  nuValueByItem: 6.9,
  totalValue: 2277,
  txItemObservation: `Observação do item ${itemOrder}`,
  txWarrantyDescription: `Garantia do item ${itemOrder}`,
  ...over
});

/**
 * Monta o formulário do portal com a máscara REAL ligada no campo de valor e o
 * total recalculado pelo modelo, como o Angular faz.
 */
function mountForm(items: ProposalItem[], { deadMask = false }: { deadMask?: boolean } = {}) {
  document.body.innerHTML = items
    .map(
      (line) => `
        <input id="nuValueByItem_${line.itemOrder}" type="text" />
        <input id="totalValue_${line.itemOrder}" type="text" readonly value="R$ 0,00" />
        <textarea id="txItemObservation_${line.itemOrder}"></textarea>
        <textarea id="txWarrantyDescription_${line.itemOrder}"></textarea>`
    )
    .join("");

  for (const line of items) {
    const input = document.getElementById(`nuValueByItem_${line.itemOrder}`) as HTMLInputElement;
    const total = document.getElementById(`totalValue_${line.itemOrder}`) as HTMLInputElement;
    if (deadMask) continue; // campo "burro": aceita texto mas nunca alimenta o modelo
    attachCurrencyMask(input, {
      onModelChange: (value: number | null) => {
        total.value = formatBRL(value == null ? 0 : value * line.quantity);
      }
    });
  }
}

describe("motor de preenchimento do modo piloto", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("converte valor em dígitos como a máscara espera", () => {
    expect(fill.toDigits(6.9)).toBe("690");
    expect(fill.toDigits(0.05)).toBe("5");
    expect(fill.toDigits(1234.56)).toBe("123456");
    expect(fill.toDigits(10)).toBe("1000");
  });

  it("lê valor monetário do portal", () => {
    expect(fill.toNumber("R$ 1.234,56")).toBe(1234.56);
    expect(fill.toNumber("R$ 0,00")).toBe(0);
    expect(fill.toNumber("")).toBe(null);
  });

  it("digita no campo com máscara e o modelo do Angular registra o valor", async () => {
    const items = [item(1), item(2, { nuValueByItem: 10, quantity: 20, totalValue: 200 })];
    mountForm(items);

    const report = await fill.fillVisibleItems(items);

    expect(report.mismatched).toEqual([]);
    expect(report.missing).toEqual([]);
    expect(report.filled.map((line) => line.read)).toEqual([2277, 200]);

    // O texto do campo também sai com a máscara montada a partir dos dígitos.
    expect((document.getElementById("nuValueByItem_1") as HTMLInputElement).value).toBe("R$ 6,90");
    expect((document.getElementById("nuValueByItem_2") as HTMLInputElement).value).toBe("R$ 10,00");
  });

  it("preenche observação e garantia", async () => {
    const items = [item(1)];
    mountForm(items);

    await fill.fillVisibleItems(items);

    expect((document.getElementById("txItemObservation_1") as HTMLTextAreaElement).value).toBe("Observação do item 1");
    expect((document.getElementById("txWarrantyDescription_1") as HTMLTextAreaElement).value).toBe("Garantia do item 1");
  });

  it("regrava por cima de rascunho já preenchido no portal", async () => {
    const items = [item(1, { nuValueByItem: 4.25, totalValue: 1402.5 })];
    mountForm(items);

    const input = document.getElementById("nuValueByItem_1") as HTMLInputElement;
    input.value = "R$ 99,99"; // rascunho antigo na tela

    const report = await fill.fillVisibleItems(items);

    expect(report.mismatched).toEqual([]);
    expect(fill.readTotal(1)).toBe(1402.5);
    expect(input.value).toBe("R$ 4,25");
  });

  it("acusa divergência quando o campo aceita texto mas o modelo não registra", async () => {
    const items = [item(1)];
    mountForm(items, { deadMask: true });

    const report = await fill.fillVisibleItems(items);

    expect(report.filled).toEqual([]);
    expect(report.mismatched).toHaveLength(1);
    expect(report.mismatched[0]).toMatchObject({ itemOrder: 1, expected: 2277, read: 0 });
  });

  it("separa item de outra página de item que não existe", async () => {
    const items = [item(1), item(2)];
    mountForm([items[0]]);

    const report = await fill.fillVisibleItems(items);

    expect(report.missing).toEqual([{ itemOrder: 2, name: "Item 2", reason: "fora-desta-pagina" }]);

    document.body.innerHTML = "";
    expect(fill.missingReason(2)).toBe("inexistente");
  });

  it("confere item a item lendo totalValue", async () => {
    const items = [item(1), item(2)];
    mountForm(items);
    await fill.fillVisibleItems(items);

    expect(fill.verifyItems(items).ok).toBe(true);

    (document.getElementById("totalValue_2") as HTMLInputElement).value = "R$ 1,00";
    const broken = fill.verifyItems(items);
    expect(broken.ok).toBe(false);
    expect(broken.mismatched).toHaveLength(1);
    expect(broken.mismatched[0]).toMatchObject({ itemOrder: 2 });
  });
});
