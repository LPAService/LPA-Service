/**
 * Motor de preenchimento da proposta do SGD (Caixa Escolar MG).
 *
 * Roda no mundo isolado do content script: o DOM é o mesmo da página, então os
 * eventos que disparamos aqui chegam nos listeners do Angular normalmente.
 *
 * POR QUE DÁ PARA DIGITAR SEM TECLADO DE VERDADE:
 * o campo de valor usa a máscara de moeda do portal (ngx-currency, confirmado em
 * research/portal/chunk-CWW7GISC.js). A diretiva registra host listeners de
 * `keydown`/`keypress`/`keyup`/`paste`, e `handleKeypress` lê
 * `event.which || event.charCode || event.keyCode` antes de chamar
 * `addNumber()` + `onModelChange()`. Host listener de Angular é addEventListener
 * comum: dispara também com evento sintético (`isTrusted:false`). Por isso um
 * `KeyboardEvent('keypress')` com o charCode certo alimenta o modelo do Angular
 * — coisa que `input.value = "6,90"` NÃO faz (medido em 15/09/2026: a tela
 * mostrava 6,90 e o totalValue continuava R$ 0,00).
 *
 * A máscara insere o dígito na posição do cursor (`addNumber` usa
 * selectionStart/selectionEnd) e remonta o texto a partir dos dígitos. Por isso
 * forçamos o cursor para o fim antes de cada dígito: "690" vira R$ 6,90.
 *
 * A prova de que o valor entrou continua sendo `totalValue_<n>`, que vem do
 * modelo do Angular, nunca o texto do próprio campo de valor.
 *
 * O QUE ESTE MOTOR NUNCA FAZ: prazo de entrega, aceite ("Declaro..."),
 * enviar cotação, fechar aba, alert/confirm/prompt.
 */
(() => {
  const BACKSPACE = 8;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /** Normaliza para comparar texto de botão/menu sem depender de acento ou caixa. */
  function norm(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  /** Espera `check()` devolver algo verdadeiro. Devolve null no timeout — quem chama decide parar. */
  async function waitFor(check, { timeout = 15000, interval = 250 } = {}) {
    const limit = Date.now() + timeout;
    for (;;) {
      let result = null;
      try {
        result = await check();
      } catch {
        result = null;
      }
      if (result) return result;
      if (Date.now() > limit) return null;
      await sleep(interval);
    }
  }

  function isVisible(el) {
    if (!(el instanceof Element)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  function isDisabled(el) {
    return Boolean(
      el.disabled ||
        el.getAttribute("disabled") === "true" ||
        el.getAttribute("aria-disabled") === "true" ||
        el.classList.contains("disabled")
    );
  }

  const CLICKABLE = "button, a, [role='button'], [role='menuitem'], [role='tab'], li, .p-button, .menu-item";

  /**
   * Acha o elemento clicável cujo texto bate. Prefere o mais interno (menos
   * texto): "Editar" dentro da linha, não a linha inteira.
   */
  function findClickable(texts, { root = document, exact = true } = {}) {
    const wanted = (Array.isArray(texts) ? texts : [texts]).map(norm);
    const candidates = Array.from(root.querySelectorAll(CLICKABLE))
      .filter(isVisible)
      .filter((el) => !isDisabled(el));

    const matches = candidates.filter((el) => {
      const label = norm(el.textContent) || norm(el.getAttribute("aria-label")) || norm(el.title);
      if (!label) return false;
      return wanted.some((target) => (exact ? label === target : label.includes(target)));
    });

    matches.sort((a, b) => (a.textContent ?? "").length - (b.textContent ?? "").length);
    return matches[0] ?? null;
  }

  function clickElement(el) {
    el.scrollIntoView({ block: "center", behavior: "instant" });
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el.click();
  }

  /** Setter nativo + eventos: é assim que o ControlValueAccessor do Angular enxerga texto. */
  function setTextField(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    el.focus();
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  /** KeyboardEvent com keyCode/charCode/which preenchidos — o construtor não aceita esses campos. */
  function dispatchKey(el, type, code) {
    const event = new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      key: code >= 48 && code <= 57 ? String.fromCharCode(code) : "Backspace"
    });
    for (const prop of ["keyCode", "charCode", "which"]) {
      Object.defineProperty(event, prop, { get: () => code });
    }
    el.dispatchEvent(event);
  }

  function caretToEnd(el) {
    try {
      const end = el.value.length;
      el.setSelectionRange(end, end);
    } catch {
      // input type=number não aceita setSelectionRange; a máscara usa text/tel.
    }
  }

  /** 6.9 -> "690": a máscara monta os centavos a partir dos dígitos. */
  function toDigits(value) {
    return String(Math.round(Math.abs(value) * 100));
  }

  /**
   * Limpa o campo de valor como um humano: seleciona tudo e manda Backspace.
   * Com a seleção cobrindo o valor inteiro a diretiva chama setValue(null) e
   * avisa o modelo; sobra o campo vazio.
   */
  function clearCurrency(el) {
    el.focus();
    clickElement(el);
    try {
      el.setSelectionRange(0, el.value.length);
    } catch {
      /* ignora */
    }
    dispatchKey(el, "keydown", BACKSPACE);
    if (el.value.replace(/\D/g, "").replace(/0/g, "") !== "") {
      // Sobrou dígito significativo: apaga um a um.
      for (let i = 0; i < 24 && el.value.replace(/\D/g, "").replace(/0/g, "") !== ""; i += 1) {
        caretToEnd(el);
        dispatchKey(el, "keydown", BACKSPACE);
      }
    }
  }

  /** Digita o valor dígito a dígito, sempre no fim do campo. */
  function typeCurrency(el, digits) {
    clearCurrency(el);
    for (const char of digits) {
      caretToEnd(el);
      dispatchKey(el, "keypress", char.charCodeAt(0));
      dispatchKey(el, "keyup", char.charCodeAt(0));
    }
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.blur();
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  /** "R$ 1.234,56" -> 1234.56. Campo vazio devolve null: "não li nada" não é zero. */
  function toNumber(text) {
    const clean = String(text ?? "")
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    if (!/\d/.test(clean)) return null;
    const parsed = Number(clean);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const fieldId = (prefix, itemOrder) => `${prefix}_${itemOrder}`;

  function itemFields(itemOrder) {
    return {
      value: document.getElementById(fieldId("nuValueByItem", itemOrder)),
      total: document.getElementById(fieldId("totalValue", itemOrder)),
      observation: document.getElementById(fieldId("txItemObservation", itemOrder)),
      warranty: document.getElementById(fieldId("txWarrantyDescription", itemOrder))
    };
  }

  /** Item sem campo: está em outra página do formulário ou não existe mesmo. */
  function missingReason(itemOrder) {
    const suffix = `_${itemOrder}`;
    const others = document.querySelectorAll(
      "[id^='nuValueByItem_'], [id^='totalValue_'], [id^='txItemObservation_'], [id^='txWarrantyDescription_']"
    );
    const hasOthers = Array.from(others).some((field) => typeof field.id === "string" && !field.id.endsWith(suffix));
    return hasOthers ? "fora-desta-pagina" : "inexistente";
  }

  function readTotal(itemOrder) {
    const field = itemFields(itemOrder).total;
    if (!field) return null;
    return toNumber("value" in field ? field.value : field.textContent);
  }

  /**
   * Preenche os itens que existem NESTA página do formulário.
   * Tenta o valor até 3 vezes e só aceita quando totalValue confere.
   */
  async function fillVisibleItems(items, onProgress = () => {}) {
    const report = { filled: [], missing: [], mismatched: [] };

    for (const item of items) {
      const fields = itemFields(item.itemOrder);
      if (!fields.value || !fields.observation) {
        report.missing.push({
          itemOrder: item.itemOrder,
          name: item.name,
          reason: missingReason(item.itemOrder)
        });
        continue;
      }

      onProgress(item);

      setTextField(fields.observation, item.txItemObservation);
      if (fields.warranty && item.txWarrantyDescription) {
        setTextField(fields.warranty, item.txWarrantyDescription);
      }

      const digits = toDigits(item.nuValueByItem);
      let read = null;
      let ok = false;
      for (let attempt = 1; attempt <= 3 && !ok; attempt += 1) {
        typeCurrency(fields.value, digits);
        await sleep(120);
        read = readTotal(item.itemOrder);
        ok = read !== null && Math.abs(read - item.totalValue) <= 0.01;
      }

      if (ok) {
        report.filled.push({ itemOrder: item.itemOrder, expected: item.totalValue, read });
      } else {
        report.mismatched.push({
          itemOrder: item.itemOrder,
          name: item.name,
          expected: item.totalValue,
          read
        });
      }
    }

    return report;
  }

  /** Conferência final, item a item, lendo só totalValue. */
  function verifyItems(items) {
    const lines = [];
    const missing = [];
    const mismatched = [];

    for (const item of items) {
      const read = readTotal(item.itemOrder);
      if (read === null) {
        missing.push({ itemOrder: item.itemOrder, name: item.name, reason: missingReason(item.itemOrder) });
        lines.push({ itemOrder: item.itemOrder, expected: item.totalValue, read: null, ok: false });
        continue;
      }
      const ok = Math.abs(read - item.totalValue) <= 0.01;
      lines.push({ itemOrder: item.itemOrder, expected: item.totalValue, read, ok });
      if (!ok) mismatched.push({ itemOrder: item.itemOrder, name: item.name, expected: item.totalValue, read });
    }

    return { ok: missing.length === 0 && mismatched.length === 0, lines, missing, mismatched };
  }

  globalThis.LPA_FILL = {
    sleep,
    norm,
    waitFor,
    isVisible,
    isDisabled,
    findClickable,
    clickElement,
    setTextField,
    dispatchKey,
    typeCurrency,
    toDigits,
    toNumber,
    itemFields,
    missingReason,
    readTotal,
    fillVisibleItems,
    verifyItems
  };
})();
