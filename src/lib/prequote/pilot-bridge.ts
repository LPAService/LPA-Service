/**
 * Ponte do app com a extensão "LPA Modo Piloto".
 *
 * A página não fala com a extensão direto: o content script dela escuta
 * window.postMessage na origem do app e repassa para o service worker, que abre
 * ou foca a aba do portal e dispara o preenchimento.
 *
 * Sem extensão instalada, quem chama cai no plano B (copiar /lance-portal e usar
 * o Claude in Chrome).
 */
const APP_CHANNEL = "lpa-modo-piloto";
const EXT_CHANNEL = "lpa-modo-piloto-ext";
const PING_TIMEOUT_MS = 1200;
const JOB_TIMEOUT_MS = 8000;

export type PilotJob = {
  proposta: unknown;
  portal: { orderId: string; quotationExternalId: string; proposalUrl?: string | null };
};

export type PilotDispatch = { ok: boolean; where?: string; error?: string };

type ExtensionMessage = {
  source?: string;
  type?: string;
  requestId?: string;
  version?: string;
  ok?: boolean;
  where?: string;
  error?: string;
};

function newRequestId() {
  return `pilot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A extensão marca o <html> assim que carrega; serve como detecção barata. */
export function pilotExtensionVersion(): string | null {
  if (typeof document === "undefined") return null;
  return document.documentElement.getAttribute("data-lpa-modo-piloto");
}

function request(
  payload: Record<string, unknown>,
  expectedType: string,
  timeoutMs: number
): Promise<ExtensionMessage | null> {
  if (typeof window === "undefined") return Promise.resolve(null);

  const requestId = newRequestId();

  return new Promise((resolve) => {
    let settled = false;

    function finish(value: ExtensionMessage | null) {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      resolve(value);
    }

    function onMessage(event: MessageEvent) {
      if (event.source !== window) return;
      const data = event.data as ExtensionMessage | null;
      if (!data || data.source !== EXT_CHANNEL) return;
      if (data.type !== expectedType) return;
      if (data.requestId && data.requestId !== requestId) return;
      finish(data);
    }

    const timer = setTimeout(() => finish(null), timeoutMs);
    window.addEventListener("message", onMessage);
    window.postMessage({ source: APP_CHANNEL, requestId, ...payload }, window.location.origin);
  });
}

/** Confirma que a extensão está viva de verdade, não só o atributo no <html>. */
export async function pingPilotExtension(): Promise<string | null> {
  if (!pilotExtensionVersion()) return null;
  const pong = await request({ type: "ping" }, "pong", PING_TIMEOUT_MS);
  return pong?.version ?? null;
}

/** Manda o piloto rodar. A extensão cuida de achar/abrir a aba do portal. */
export async function sendPilotJob(job: PilotJob): Promise<PilotDispatch> {
  const ack = await request({ type: "job", job }, "job-ack", JOB_TIMEOUT_MS);
  if (!ack) return { ok: false, error: "A extensão não respondeu. Recarregue a página e tente de novo." };
  return { ok: Boolean(ack.ok), where: ack.where, error: ack.error };
}
