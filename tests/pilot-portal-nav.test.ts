// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import "../extension/portal-fill.js";

/**
 * Navegação do piloto contra um DOM copiado do portal real (22/09/2026).
 *
 * Os formatos aqui vieram de inspeção ao vivo em
 * https://caixaescolar.educacao.mg.gov.br/compras/orcamentos:
 * o campo de busca tem id `budget-order`, a linha traz Excluir/Editar/Visualizar
 * com Editar desabilitado enquanto não existe rascunho, e o modal
 * "Solicitação de Orçamento" NÃO contém o número do orçamento.
 */
type PortalApi = {
  findOrderInput(): HTMLInputElement | null;
  formMatchesOrder(orderId: string, schoolName?: string | null): boolean;
  openProposalForm(row: Element): Promise<string>;
};

const chromeStub = {
  runtime: {
    onMessage: { addListener: () => {} },
    sendMessage: () => Promise.reject(new Error("sem extensão no teste"))
  }
};
(globalThis as unknown as { chrome: unknown }).chrome = chromeStub;

await import("../extension/content-portal.js");
const portal = (globalThis as unknown as { LPA_PORTAL: PortalApi }).LPA_PORTAL;

/** happy-dom não calcula layout: finge que tudo que está no documento é visível. */
function makeVisible() {
  for (const el of document.querySelectorAll("*")) {
    (el as HTMLElement).getBoundingClientRect = () =>
      ({ width: 100, height: 20, top: 0, left: 0, right: 100, bottom: 20, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  }
}

const FILTRO_REAL = `
  <input type="text" />
  <input type="text" id="school-name" placeholder="Digite o nome da Escola" />
  <input type="text" id="budget-order" placeholder="Digite o ID do orçamento" />
  <button>Limpar</button>
  <button>Buscar</button>
`;

const linhaReal = (orderId: string, escola: string, editarHabilitado: boolean) => `
  <table><tbody><tr>
    <td>2026</td><td>${orderId}</td><td>${escola}</td><td>Betim</td><td>Gêneros Alimentícios</td>
    <td>24/09/2026</td><td>Não Enviada</td>
    <td>
      <button disabled>Excluir</button>
      <button ${editarHabilitado ? "" : "disabled"}>Editar</button>
      <button>Visualizar</button>
    </td>
  </tr></tbody></table>
`;

/** Modal como o real: escola, município, prazos, itens — e nenhum número de orçamento. */
const MODAL_REAL = `
  <div class="modal show">
    Solicitação de Orçamento
    Detalhamento do solicitante
    Nome da Escola EE ESTUDANTE LIVIA MARA DE CASTRO
    Município Betim
    Prazo de Envio de Propostas 24/09/2026
    <button>Cancelar</button>
    <button>Cadastrar Proposta</button>
  </div>
`;

describe("navegação do piloto no portal", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    window.history.replaceState({}, "", "/compras/orcamentos");
  });

  it("acha o campo de busca pelo id budget-order, não pelo vizinho da escola", () => {
    document.body.innerHTML = FILTRO_REAL;
    makeVisible();
    expect(portal.findOrderInput()?.id).toBe("budget-order");
  });

  it("ainda acha o campo pelo placeholder se o id sumir", () => {
    document.body.innerHTML = FILTRO_REAL.replace('id="budget-order" ', "");
    makeVisible();
    expect(portal.findOrderInput()?.getAttribute("placeholder")).toBe("Digite o ID do orçamento");
  });

  it("aceita a ficha pela escola quando o modal não traz o número do orçamento", () => {
    document.body.innerHTML = MODAL_REAL;
    makeVisible();
    expect(portal.formMatchesOrder("2026204936", "EE Estudante Livia Mara de Castro")).toBe(true);
  });

  it("recusa quando a escola do modal é outra", () => {
    document.body.innerHTML = MODAL_REAL;
    makeVisible();
    expect(portal.formMatchesOrder("2026204936", "EE Delfino Magalhaes")).toBe(false);
  });

  it("aceita pela URL quando o portal escreve budgetOrder", () => {
    window.history.replaceState({}, "", "/compras/orcamentos?budgetOrder=2026204936&page=1");
    document.body.innerHTML = MODAL_REAL;
    makeVisible();
    // Escola errada, mas a URL é prova mais forte.
    expect(portal.formMatchesOrder("2026204936", "Escola Errada")).toBe(true);
  });

  it("não aborta quando o pré-orçamento não tem escola", () => {
    document.body.innerHTML = MODAL_REAL;
    makeVisible();
    expect(portal.formMatchesOrder("2026204936", null)).toBe(true);
  });

  /** Liga a linha ao modal como o portal faz: Visualizar abre a ficha, Cadastrar Proposta abre o form. */
  function wireRow(row: Element, registro: { clicado: string }) {
    for (const botao of row.querySelectorAll("button")) {
      botao.addEventListener("click", () => {
        registro.clicado += botao.textContent?.trim() + " ";
        if (botao.textContent?.trim() !== "Visualizar") return;
        document.body.insertAdjacentHTML("beforeend", MODAL_REAL);
        makeVisible();
        document.querySelector(".modal button:last-of-type")!.addEventListener("click", () => {
          document.body.insertAdjacentHTML(
            "beforeend",
            `<input id="nuValueByItem_1" /><input id="totalValue_1" /><textarea id="txItemObservation_1"></textarea>`
          );
        });
      });
    }
  }

  it("usa Visualizar quando Editar está desabilitado e chega no formulário", async () => {
    document.body.innerHTML = linhaReal("2026204936", "EE ESTUDANTE LIVIA MARA DE CASTRO", false);
    makeVisible();
    const row = document.querySelector("tr")!;
    const registro = { clicado: "" };
    wireRow(row, registro);

    expect(await portal.openProposalForm(row)).toBe("ok");
    expect(registro.clicado).toContain("Visualizar");
    expect(registro.clicado).not.toContain("Excluir");
  });

  it("prefere Editar quando o portal já tem rascunho", async () => {
    document.body.innerHTML = linhaReal("2026204936", "EE ESTUDANTE", true);
    makeVisible();
    const row = document.querySelector("tr")!;
    const registro = { clicado: "" };
    wireRow(row, registro);
    row.querySelectorAll("button")[1].addEventListener("click", () => {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<input id="nuValueByItem_1" /><input id="totalValue_1" /><textarea id="txItemObservation_1"></textarea>`
      );
    });

    expect(await portal.openProposalForm(row)).toBe("ok");
    expect(registro.clicado.trim()).toBe("Editar");
  });

  it("nunca clica em Excluir, que fica na mesma linha", async () => {
    document.body.innerHTML = linhaReal("2026204936", "EE ESTUDANTE", false);
    makeVisible();
    const row = document.querySelector("tr")!;
    const registro = { clicado: "" };
    wireRow(row, registro);

    await portal.openProposalForm(row);
    expect(registro.clicado).not.toContain("Excluir");
  });
});
