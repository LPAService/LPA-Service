/**
 * Service worker do Modo Piloto.
 *
 * Guarda o job (proposta já pronta) de forma efêmera e entrega para a aba do
 * portal. Usa chrome.storage.session de propósito: dado de lance não fica em
 * disco e some quando o navegador fecha.
 *
 * O job é entregue UMA vez (fica `claimed`) e expira em 5 minutos, para um
 * F5 no portal depois não disparar preenchimento sozinho.
 */
const JOB_KEY = "pilotJob";
const PORTAL_ORIGIN = "https://caixaescolar.educacao.mg.gov.br";
const PORTAL_HOME = `${PORTAL_ORIGIN}/`;
const TTL_MS = 5 * 60 * 1000;

function isValidJob(job) {
  if (!job || typeof job !== "object") return false;
  const { proposta, portal } = job;
  if (!portal || !portal.orderId) return false;
  if (!proposta || !Array.isArray(proposta.items) || proposta.items.length === 0) return false;
  return proposta.items.every(
    (item) =>
      Number.isInteger(item.itemOrder) &&
      typeof item.nuValueByItem === "number" &&
      typeof item.totalValue === "number" &&
      typeof item.txItemObservation === "string"
  );
}

async function storeJob(job) {
  await chrome.storage.session.set({
    [JOB_KEY]: { ...job, createdAt: Date.now(), claimed: false }
  });
}

async function readJob() {
  const bag = await chrome.storage.session.get(JOB_KEY);
  const job = bag[JOB_KEY];
  if (!job) return null;
  if (Date.now() - job.createdAt > TTL_MS) {
    await chrome.storage.session.remove(JOB_KEY);
    return null;
  }
  return job;
}

async function claimJob() {
  const job = await readJob();
  if (!job || job.claimed) return null;
  await chrome.storage.session.set({ [JOB_KEY]: { ...job, claimed: true } });
  return job;
}

async function findPortalTab() {
  const tabs = await chrome.tabs.query({ url: `${PORTAL_ORIGIN}/*` });
  return tabs.find((tab) => tab.active) ?? tabs[0] ?? null;
}

/**
 * Manda o piloto rodar. Reaproveita a aba já autenticada do portal — abrir a URL
 * do orçamento direto derruba a rota do Angular e cai na home (medido 17/09/2026).
 */
async function dispatchJob() {
  const tab = await findPortalTab();

  if (!tab) {
    await chrome.tabs.create({ url: PORTAL_HOME, active: true });
    return { ok: true, where: "nova-aba" };
  }

  await chrome.tabs.update(tab.id, { active: true });
  if (tab.windowId != null) await chrome.windows.update(tab.windowId, { focused: true });

  const job = await claimJob();
  if (!job) return { ok: true, where: "sem-job" };

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "pilot-start", job });
    return { ok: true, where: "aba-existente" };
  } catch {
    // Content script ainda não carregou nessa aba: recarrega e deixa ela pedir o job.
    await chrome.storage.session.set({ [JOB_KEY]: { ...job, claimed: false } });
    await chrome.tabs.reload(tab.id);
    return { ok: true, where: "aba-recarregada" };
  }
}

/** Digita apenas números no campo já focado pelo content script do portal. */
async function typeCurrencyInPortal(digits, sender) {
  const tabId = sender?.tab?.id;
  const url = sender?.url ?? sender?.tab?.url ?? "";
  if (!Number.isInteger(tabId) || !url.startsWith(`${PORTAL_ORIGIN}/`) || !/^\d{1,12}$/.test(digits)) {
    return { ok: false, error: "Pedido de digitação inválido." };
  }

  const target = { tabId };
  await chrome.debugger.attach(target, "1.3");
  try {
    async function key(key, code, virtualKeyCode, text) {
      await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
        type: "keyDown",
        key,
        code,
        windowsVirtualKeyCode: virtualKeyCode,
        nativeVirtualKeyCode: virtualKeyCode,
        ...(text ? { text, unmodifiedText: text } : {})
      });
      await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
        type: "keyUp",
        key,
        code,
        windowsVirtualKeyCode: virtualKeyCode,
        nativeVirtualKeyCode: virtualKeyCode
      });
    }

    await key("Backspace", "Backspace", 8);
    for (const digit of digits) {
      await key(digit, `Digit${digit}`, digit.charCodeAt(0), digit);
    }
    return { ok: true };
  } finally {
    await chrome.debugger.detach(target);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "pilot-type-currency") {
    typeCurrencyInPortal(message.digits, sender)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: String(error?.message ?? error) }));
    return true;
  }
  if (message?.type === "pilot-job") {
    if (!isValidJob(message.job)) {
      sendResponse({ ok: false, error: "Proposta inválida: item sem ordem, valor ou observação." });
      return true;
    }
    storeJob(message.job)
      .then(dispatchJob)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message ?? error) }));
    return true;
  }

  if (message?.type === "pilot-take") {
    claimJob()
      .then((job) => sendResponse({ job }))
      .catch(() => sendResponse({ job: null }));
    return true;
  }

  if (message?.type === "pilot-done") {
    chrome.storage.session
      .remove(JOB_KEY)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  return false;
});
