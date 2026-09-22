/**
 * Piloto dentro do portal Caixa Escolar MG.
 *
 * Recebe o job (pré-orçamento já traduzido para os campos do SGD), navega até o
 * formulário de proposta do orçamento certo e preenche valor, observação e
 * garantia de cada item, conferindo totalValue item a item.
 *
 * PARA ANTES DE: prazo de entrega, aceite ("Declaro...") e Enviar Cotação.
 * Esses três são decisão comercial do humano — lance em licitação pública não
 * sai daqui. Também nunca fecha a aba e nunca usa alert/confirm/prompt
 * (dialog nativo trava a automação do navegador).
 */
(() => {
  const F = globalThis.LPA_FILL;
  const ORCAMENTOS_PATH = "/compras/orcamentos";
  const FRASE_FINAL = "Falta você preencher a data de entrega, marcar o Declaro e clicar Enviar Cotação.";

  let running = false;

  /* ------------------------------------------------------------------ HUD */

  const hud = (() => {
    let root = null;
    let stepEl = null;
    let barEl = null;
    let logEl = null;
    let noteEl = null;

    function ensure() {
      if (root && document.body.contains(root)) return;
      root = document.createElement("section");
      root.className = "lpa-hud";
      root.setAttribute("role", "status");
      root.innerHTML = `
        <div class="lpa-hud__head">
          <span class="lpa-hud__title">Modo piloto — LPA</span>
          <button class="lpa-hud__close" type="button" aria-label="Fechar">×</button>
        </div>
        <p class="lpa-hud__step"></p>
        <div class="lpa-hud__bar"><span></span></div>
        <ul class="lpa-hud__log"></ul>
        <div class="lpa-hud__note" hidden></div>
      `;
      root.querySelector(".lpa-hud__close").addEventListener("click", () => root.remove());
      document.body.appendChild(root);
      stepEl = root.querySelector(".lpa-hud__step");
      barEl = root.querySelector(".lpa-hud__bar > span");
      logEl = root.querySelector(".lpa-hud__log");
      noteEl = root.querySelector(".lpa-hud__note");
    }

    return {
      step(text, percent) {
        ensure();
        stepEl.textContent = text;
        if (typeof percent === "number") barEl.style.width = `${Math.min(100, Math.max(0, percent))}%`;
      },
      log(text, kind) {
        ensure();
        const li = document.createElement("li");
        li.textContent = text;
        if (kind) li.className = kind === "ok" ? "is-ok" : "is-bad";
        logEl.appendChild(li);
        logEl.parentElement.scrollTop = logEl.parentElement.scrollHeight;
      },
      note(text, kind) {
        ensure();
        noteEl.hidden = false;
        noteEl.className = `lpa-hud__note is-${kind}`;
        noteEl.textContent = text;
      },
      reset() {
        ensure();
        logEl.innerHTML = "";
        noteEl.hidden = true;
        barEl.style.width = "0%";
      }
    };
  })();

  /* ------------------------------------------------------------ navegação */

  function onLoginScreen() {
    const path = location.pathname.toLowerCase();
    return path.includes("/login") || path.includes("/selecionar-perfil");
  }

  function onOrcamentosScreen() {
    return location.pathname.toLowerCase().startsWith(ORCAMENTOS_PATH);
  }

  /** Campo "ID Orçamento" da busca. `#budget-order` confirmado no portal em 22/09/2026. */
  function findOrderInput() {
    const byId = document.getElementById("budget-order");
    if (byId && F.isVisible(byId)) return byId;

    const inputs = Array.from(document.querySelectorAll("input[type='text'], input:not([type]), input[type='search'], input[type='tel'], input[type='number']"))
      .filter(F.isVisible);

    const byPlaceholder = inputs.find((input) => {
      const hint = F.norm(input.placeholder);
      return hint.includes("id do orcamento") || hint.includes("digite o id");
    });
    if (byPlaceholder) return byPlaceholder;

    return (
      inputs.find((input) => {
        const label = F.norm(input.getAttribute("aria-label") ?? input.name ?? input.getAttribute("formcontrolname"));
        return label.includes("orcamento") || label.includes("nubudgetorder");
      }) ?? null
    );
  }

  async function goToOrcamentos() {
    if (onOrcamentosScreen()) return true;

    const link = Array.from(document.querySelectorAll("a[href]")).find(
      (anchor) => anchor.getAttribute("href")?.includes("compras/orcamentos") && F.isVisible(anchor)
    );
    if (link) {
      F.clickElement(link);
    } else {
      const compras = F.findClickable(["compras"], { exact: false });
      if (compras) {
        F.clickElement(compras);
        await F.sleep(600);
      }
      const orcamento = F.findClickable(["orcamento", "orcamentos"], { exact: true });
      if (!orcamento) return false;
      F.clickElement(orcamento);
    }

    return Boolean(await F.waitFor(() => onOrcamentosScreen() && findOrderInput(), { timeout: 20000 }));
  }

  async function searchOrder(orderId) {
    const input = findOrderInput();
    if (!input) return false;
    F.setTextField(input, String(orderId));

    const buscar = F.findClickable(["buscar", "pesquisar", "filtrar"], { exact: true });
    if (buscar) F.clickElement(buscar);
    else F.dispatchKey(input, "keydown", 13);

    // A tabela mostra spinner e os contadores do topo carregam antes das linhas.
    const row = await F.waitFor(
      () =>
        Array.from(document.querySelectorAll("tr, .p-datatable-row, [role='row']")).find(
          (candidate) => F.isVisible(candidate) && (candidate.textContent ?? "").includes(String(orderId))
        ) ?? null,
      { timeout: 25000 }
    );
    return row ?? false;
  }

  /**
   * Abre o formulário de proposta a partir da linha do orçamento.
   * Editar quando já existe rascunho no portal; senão Visualizar e, no rodapé do
   * modal "Solicitação de Orçamento", Cadastrar Proposta. Nunca Excluir.
   */
  async function openProposalForm(row) {
    const editar = F.findClickable(["editar"], { root: row, exact: true });
    if (editar) {
      F.clickElement(editar);
    } else {
      const visualizar = F.findClickable(["visualizar", "ver", "detalhar"], { root: row, exact: true });
      if (!visualizar) return "sem-botao";
      F.clickElement(visualizar);

      const cadastrar = await F.waitFor(() => F.findClickable(["cadastrar proposta"], { exact: true }), {
        timeout: 20000
      });
      if (!cadastrar) return "sem-cadastrar-proposta";
      F.clickElement(cadastrar);
    }

    const ready = await F.waitFor(() => document.querySelector("[id^='nuValueByItem_']"), { timeout: 25000 });
    return ready ? "ok" : "sem-campos";
  }

  /**
   * Confere que a ficha aberta é mesmo o orçamento do pré-orçamento.
   *
   * Medido no portal em 22/09/2026: o modal `Solicitacao de Orcamento` NÃO traz
   * o numero do orcamento — só escola, municipio, endereco, prazos e itens. Por
   * isso a conferencia vai em tres camadas, da mais forte para a mais fraca:
   *
   * 1. `budgetOrder=<ordem>` na URL, que o portal escreve no caminho `Editar`;
   * 2. o nome da escola do pre-orcamento contra o texto do modal;
   * 3. a linha da tabela, que ja foi achada pelo proprio orderId depois de uma
   *    busca filtrada por ele — garantia suficiente para nao abortar à toa.
   *
   * Só recusa quando encontra prova de que é OUTRO orçamento (escola diferente).
   */
  function formMatchesOrder(orderId, schoolName) {
    if (new RegExp(`budgetOrder=${String(orderId)}\\b`).test(location.href)) return true;

    const scope =
      document.querySelector(".p-dialog, [role='dialog'], .modal.show, .modal, app-budget-proposal-form") ??
      document.body;
    const text = F.norm(scope.textContent ?? "");
    if (text.includes(F.norm(orderId))) return true;

    const school = F.norm(schoolName ?? "");
    if (school) return text.includes(school);

    // Sem escola no payload não há como cruzar; a linha buscada pelo orderId vale.
    return true;
  }

  /** Paginação dos itens dentro do formulário. */
  async function goToNextItemsPage() {
    const known = [
      ".p-paginator-next:not(.p-disabled)",
      "[aria-label='Next Page']",
      "[aria-label='Próxima']",
      ".mat-paginator-navigate-next:not([disabled])"
    ];
    for (const selector of known) {
      const button = document.querySelector(selector);
      if (button && F.isVisible(button) && !F.isDisabled(button)) {
        const before = document.querySelector("[id^='nuValueByItem_']")?.id ?? "";
        F.clickElement(button);
        const changed = await F.waitFor(
          () => (document.querySelector("[id^='nuValueByItem_']")?.id ?? "") !== before,
          { timeout: 15000 }
        );
        return Boolean(changed);
      }
    }
    return false;
  }

  /* --------------------------------------------------------------- piloto */

  async function run(job) {
    if (running) return;
    running = true;
    hud.reset();

    const { proposta, portal } = job;
    const orderId = String(portal.orderId);
    const items = proposta.items;

    try {
      hud.step("Conferindo sessão do portal…", 5);
      if (onLoginScreen()) {
        hud.note("Portal não está logado. Entre na sua conta e clique Modo piloto de novo.", "error");
        return;
      }

      hud.step("Abrindo Compras › Orçamento…", 12);
      if (!(await goToOrcamentos())) {
        hud.note("Não achei a tela Compras › Orçamento. Abra ela na mão e rode o Modo piloto de novo.", "error");
        return;
      }

      hud.step(`Buscando orçamento ${orderId}…`, 22);
      const row = await searchOrder(orderId);
      if (!row) {
        hud.note(`Orçamento ${orderId} não apareceu na busca. Confira se a conta enxerga essa cotação.`, "error");
        return;
      }
      hud.log(`Orçamento ${orderId} encontrado`, "ok");

      hud.step("Abrindo o formulário de proposta…", 32);
      const opened = await openProposalForm(row);
      if (opened !== "ok") {
        const motivos = {
          "sem-botao": "A linha do orçamento não tem Editar nem Visualizar habilitado.",
          "sem-cadastrar-proposta": "O modal abriu mas não achei o botão Cadastrar Proposta.",
          "sem-campos": "O formulário abriu sem os campos dos itens (nuValueByItem)."
        };
        hud.note(`${motivos[opened] ?? "Não consegui abrir o formulário."} Abra na mão e rode de novo.`, "error");
        return;
      }

      if (!formMatchesOrder(orderId, portal.schoolName)) {
        hud.note(
          `A ficha aberta não bate com ${portal.schoolName ?? orderId}. Parei sem preencher nada.`,
          "error"
        );
        return;
      }
      hud.log("Formulário de proposta aberto", "ok");

      // Preenche página a página: o portal pagina os itens do orçamento.
      let pending = items;
      const filled = [];
      const mismatched = [];
      let page = 1;

      // Teto de páginas: se a paginação avançar sem trazer os itens que faltam,
      // é melhor parar e avisar do que ficar girando na tela do lance.
      while (pending.length > 0 && page <= 20) {
        hud.step(`Preenchendo itens (página ${page})…`, 40 + Math.min(45, filled.length * 4));
        const report = await F.fillVisibleItems(pending, (item) => {
          hud.step(`Item ${item.itemOrder} — ${item.name}`.slice(0, 70), 40 + Math.min(45, filled.length * 4));
        });

        for (const line of report.filled) {
          filled.push(line);
          hud.log(`Item ${line.itemOrder}: ${money(line.read)}`, "ok");
        }
        for (const line of report.mismatched) {
          mismatched.push(line);
          hud.log(`Item ${line.itemOrder}: esperado ${money(line.expected)}, portal ${money(line.read)}`, "bad");
        }

        const inexistente = report.missing.filter((line) => line.reason === "inexistente");
        if (inexistente.length > 0) {
          hud.note(
            `Itens que não existem neste orçamento: ${inexistente.map((line) => line.itemOrder).join(", ")}. Parei aqui.`,
            "error"
          );
          return;
        }

        const outraPagina = report.missing.filter((line) => line.reason === "fora-desta-pagina");
        if (outraPagina.length === 0) break;

        hud.step("Indo para a próxima página de itens…", 80);
        if (!(await goToNextItemsPage())) {
          hud.note(
            `Faltaram os itens ${outraPagina.map((line) => line.itemOrder).join(", ")} e não achei a paginação. Preencha esses na mão.`,
            "warn"
          );
          break;
        }
        const next = outraPagina
          .map((line) => items.find((item) => item.itemOrder === line.itemOrder))
          .filter(Boolean);
        if (next.length >= pending.length) {
          hud.note(
            `A paginação avançou mas os itens ${outraPagina.map((line) => line.itemOrder).join(", ")} continuam fora da tela. Preencha esses na mão.`,
            "warn"
          );
          break;
        }
        pending = next;
        page += 1;
      }

      hud.step("Conferindo os totais…", 92);
      // Reconfere o que ainda está no DOM; as páginas anteriores já foram
      // conferidas na hora de preencher, e o total sai do acumulado.
      const check = F.verifyItems(items.filter((item) => F.itemFields(item.itemOrder).total));
      const totalPortal = filled.reduce((sum, line) => sum + (line.read ?? 0), 0);

      const divergentes = new Set([...mismatched, ...check.mismatched].map((line) => line.itemOrder));
      if (divergentes.size > 0) {
        hud.step("Terminou com divergência", 100);
        hud.note(
          `Divergência nos itens ${[...divergentes].join(", ")}. Confira na tela antes de enviar.`,
          "error"
        );
        return;
      }

      if (filled.length < items.length) {
        hud.step(`${filled.length} de ${items.length} item(ns) preenchido(s)`, 100);
        hud.note(
          `Faltaram ${items.length - filled.length} item(ns). Preencha na mão antes de enviar, e só então marque o Declaro.`,
          "warn"
        );
        return;
      }

      hud.step(`${filled.length} item(ns) preenchido(s)`, 100);
      hud.log(`Total no portal: ${money(totalPortal)}`, "ok");
      hud.log(`Total do pré-orçamento: ${money(proposta.itemsTotal)}`, "ok");
      hud.note(FRASE_FINAL, "warn");
    } catch (error) {
      hud.note(`Erro no piloto: ${error?.message ?? error}`, "error");
    } finally {
      running = false;
      chrome.runtime.sendMessage({ type: "pilot-done" }).catch(() => {});
    }
  }

  function money(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  /* ------------------------------------------------------------- entrada */

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "pilot-start" && message.job) run(message.job);
  });

  // Aba recém-aberta pelo botão: o job já está guardado no service worker.
  chrome.runtime
    .sendMessage({ type: "pilot-take" })
    .then((response) => {
      if (response?.job) run(response.job);
    })
    .catch(() => {});

  // Exposto para teste e para depurar na aba do portal; a extensão não usa.
  globalThis.LPA_PORTAL = {
    onLoginScreen,
    onOrcamentosScreen,
    findOrderInput,
    goToOrcamentos,
    searchOrder,
    openProposalForm,
    formMatchesOrder,
    goToNextItemsPage,
    run
  };
})();
