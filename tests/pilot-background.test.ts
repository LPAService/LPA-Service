import { beforeEach, describe, expect, it } from "vitest";

type Listener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: unknown) => void
) => boolean | undefined;

type Tab = { id: number; url: string; active: boolean; windowId: number };

const listeners: Listener[] = [];
const state = {
  store: {} as Record<string, unknown>,
  tabs: [] as Tab[],
  created: [] as string[],
  reloaded: [] as number[],
  sent: [] as Array<{ tabId: number; message: unknown }>,
  debuggerCommands: [] as Array<{ method: string; params: Record<string, unknown> }>,
  debuggerAttached: [] as number[],
  debuggerDetached: [] as number[],
  sendFails: false
};

/** chrome.* mínimo, com o comportamento que o service worker usa de verdade. */
(globalThis as unknown as { chrome: unknown }).chrome = {
  runtime: {
    onMessage: { addListener: (fn: Listener) => listeners.push(fn) },
    getManifest: () => ({ version: "1.0.0" })
  },
  storage: {
    session: {
      set: async (patch: Record<string, unknown>) => Object.assign(state.store, patch),
      get: async (key: string) => ({ [key]: state.store[key] }),
      remove: async (key: string) => {
        delete state.store[key];
      }
    }
  },
  tabs: {
    query: async () => state.tabs,
    create: async ({ url }: { url: string }) => state.created.push(url),
    update: async (id: number) => id,
    reload: async (id: number) => state.reloaded.push(id),
    sendMessage: async (tabId: number, message: unknown) => {
      if (state.sendFails) throw new Error("Receiving end does not exist.");
      state.sent.push({ tabId, message });
    }
  },
  windows: { update: async () => undefined },
  debugger: {
    attach: async ({ tabId }: { tabId: number }) => { state.debuggerAttached.push(tabId); },
    sendCommand: async (_target: unknown, method: string, params: Record<string, unknown>) => {
      state.debuggerCommands.push({ method, params });
    },
    detach: async ({ tabId }: { tabId: number }) => { state.debuggerDetached.push(tabId); }
  }
};

await import("../extension/background.js");

const send = (message: unknown, sender: unknown = null) =>
  new Promise<Record<string, unknown>>((resolve) => {
    for (const listener of listeners) {
      const handled = listener(message, sender, (response) => resolve(response as Record<string, unknown>));
      if (handled) return;
    }
    resolve({});
  });

const validJob = () => ({
  proposta: {
    itemsTotal: 2277,
    items: [
      {
        itemOrder: 1,
        name: "Item 1",
        nuValueByItem: 6.9,
        totalValue: 2277,
        txItemObservation: "obs",
        txWarrantyDescription: ""
      }
    ]
  },
  portal: { orderId: "2026200309", quotationExternalId: "abc" }
});

describe("service worker do modo piloto", () => {
  beforeEach(() => {
    state.store = {};
    state.tabs = [];
    state.created = [];
    state.reloaded = [];
    state.sent = [];
    state.debuggerCommands = [];
    state.debuggerAttached = [];
    state.debuggerDetached = [];
    state.sendFails = false;
  });

  it("recusa proposta sem item", async () => {
    const job = validJob();
    job.proposta.items = [];
    expect(await send({ type: "pilot-job", job })).toMatchObject({ ok: false });
    expect(state.store.pilotJob).toBeUndefined();
  });

  it("recusa item sem observação — o portal exige e o form nem envia", async () => {
    const job = validJob();
    // @ts-expect-error: simulando payload quebrado
    delete job.proposta.items[0].txItemObservation;
    expect(await send({ type: "pilot-job", job })).toMatchObject({ ok: false });
  });

  it("recusa job sem orderId", async () => {
    const job = validJob();
    job.portal.orderId = "";
    expect(await send({ type: "pilot-job", job })).toMatchObject({ ok: false });
  });

  it("abre aba nova quando não existe aba do portal", async () => {
    const result = await send({ type: "pilot-job", job: validJob() });
    expect(result).toMatchObject({ ok: true, where: "nova-aba" });
    expect(state.created).toEqual(["https://caixaescolar.educacao.mg.gov.br/"]);
    expect(state.sent).toEqual([]);
  });

  it("reaproveita a aba do portal já aberta", async () => {
    state.tabs = [{ id: 7, url: "https://caixaescolar.educacao.mg.gov.br/compras/orcamentos", active: true, windowId: 1 }];

    const result = await send({ type: "pilot-job", job: validJob() });

    expect(result).toMatchObject({ ok: true, where: "aba-existente" });
    expect(state.created).toEqual([]);
    expect(state.sent[0]?.tabId).toBe(7);
    expect((state.sent[0]?.message as { type: string }).type).toBe("pilot-start");
  });

  it("recarrega a aba quando o content script ainda não está lá", async () => {
    state.tabs = [{ id: 9, url: "https://caixaescolar.educacao.mg.gov.br/", active: true, windowId: 1 }];
    state.sendFails = true;

    const result = await send({ type: "pilot-job", job: validJob() });

    expect(result).toMatchObject({ ok: true, where: "aba-recarregada" });
    expect(state.reloaded).toEqual([9]);
    // O job volta a ficar disponível para a aba pedir depois do reload.
    expect((state.store.pilotJob as { claimed: boolean }).claimed).toBe(false);
  });

  it("entrega o job uma vez só: F5 no portal não redispara o piloto", async () => {
    await send({ type: "pilot-job", job: validJob() });

    const first = await send({ type: "pilot-take" });
    const second = await send({ type: "pilot-take" });

    expect((first.job as { portal: { orderId: string } }).portal.orderId).toBe("2026200309");
    expect(second.job).toBe(null);
  });

  it("descarta job velho", async () => {
    await send({ type: "pilot-job", job: validJob() });
    const stored = state.store.pilotJob as { createdAt: number; claimed: boolean };
    stored.claimed = false;
    stored.createdAt = Date.now() - 6 * 60 * 1000;

    expect((await send({ type: "pilot-take" })).job).toBe(null);
    expect(state.store.pilotJob).toBeUndefined();
  });

  it("limpa o job quando o piloto termina", async () => {
    await send({ type: "pilot-job", job: validJob() });
    expect(await send({ type: "pilot-done" })).toMatchObject({ ok: true });
    expect(state.store.pilotJob).toBeUndefined();
  });

  it("digita teclas reais apenas na aba oficial do portal", async () => {
    const sender = { tab: { id: 7, url: "https://caixaescolar.educacao.mg.gov.br/compras/orcamentos" } };
    expect(await send({ type: "pilot-type-currency", digits: "690" }, sender)).toEqual({ ok: true });
    expect(state.debuggerAttached).toEqual([7]);
    expect(state.debuggerDetached).toEqual([7]);
    expect(state.debuggerCommands.map(({ method, params }) => [method, params.type, params.key])).toEqual([
      ["Input.dispatchKeyEvent", "keyDown", "Backspace"],
      ["Input.dispatchKeyEvent", "keyUp", "Backspace"],
      ["Input.dispatchKeyEvent", "keyDown", "6"],
      ["Input.dispatchKeyEvent", "keyUp", "6"],
      ["Input.dispatchKeyEvent", "keyDown", "9"],
      ["Input.dispatchKeyEvent", "keyUp", "9"],
      ["Input.dispatchKeyEvent", "keyDown", "0"],
      ["Input.dispatchKeyEvent", "keyUp", "0"]
    ]);
    expect(await send({ type: "pilot-type-currency", digits: "690" }, { tab: { id: 8, url: "https://example.com/" } })).toMatchObject({ ok: false });
    expect(await send({ type: "pilot-type-currency", digits: "690\n" }, sender)).toMatchObject({ ok: false });
    expect(state.debuggerAttached).toEqual([7]);
  });
});
