// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { pilotExtensionVersion, pingPilotExtension, sendPilotJob } from "@/lib/prequote/pilot-bridge";

const APP_CHANNEL = "lpa-modo-piloto";
const EXT_CHANNEL = "lpa-modo-piloto-ext";

type Sent = { type?: string; requestId?: string; job?: unknown };

/**
 * Finge ser o content script da extensão.
 *
 * Responde com MessageEvent de `source: window` porque é isso que o navegador
 * faz num postMessage de mesma janela — e é o que a ponte exige.
 */
function fakeExtension(
  version: string | null,
  { reply = { ok: true, where: "aba-existente" } as Record<string, unknown>, mute = false } = {}
) {
  const received: Sent[] = [];

  if (version) document.documentElement.setAttribute("data-lpa-modo-piloto", version);

  const listener = (event: MessageEvent) => {
    const data = event.data as { source?: string } & Sent;
    if (!data || data.source !== APP_CHANNEL) return;
    received.push({ type: data.type, requestId: data.requestId, job: data.job });
    if (mute) return;

    const answer =
      data.type === "ping"
        ? { source: EXT_CHANNEL, type: "pong", version, requestId: data.requestId }
        : { source: EXT_CHANNEL, type: "job-ack", requestId: data.requestId, ...reply };

    window.dispatchEvent(
      new MessageEvent("message", { data: answer, origin: window.location.origin, source: window })
    );
  };

  window.addEventListener("message", listener);
  return {
    received,
    stop() {
      window.removeEventListener("message", listener);
      document.documentElement.removeAttribute("data-lpa-modo-piloto");
    }
  };
}

describe("ponte do modo piloto com a extensão", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-lpa-modo-piloto");
  });

  it("lê a versão que a extensão marca no <html>", () => {
    expect(pilotExtensionVersion()).toBe(null);
    document.documentElement.setAttribute("data-lpa-modo-piloto", "1.0.0");
    expect(pilotExtensionVersion()).toBe("1.0.0");
  });

  it("sem extensão instalada o ping nem sai", async () => {
    const ext = fakeExtension(null);
    expect(await pingPilotExtension()).toBe(null);
    expect(ext.received).toEqual([]);
    ext.stop();
  });

  it("confirma a extensão pelo pong", async () => {
    const ext = fakeExtension("1.0.0");
    expect(await pingPilotExtension()).toBe("1.0.0");
    expect(ext.received[0]?.type).toBe("ping");
    ext.stop();
  });

  it("extensão marcada mas muda cai no timeout", async () => {
    const ext = fakeExtension("1.0.0", { mute: true });
    expect(await pingPilotExtension()).toBe(null);
    ext.stop();
  });

  it("entrega o job e devolve o ack da extensão", async () => {
    const ext = fakeExtension("1.0.0");
    const job = {
      proposta: { items: [{ itemOrder: 1 }] },
      portal: { orderId: "2026200309", quotationExternalId: "abc" }
    };

    const result = await sendPilotJob(job);

    expect(result).toEqual({ ok: true, where: "aba-existente", error: undefined });
    expect(ext.received.at(-1)?.job).toEqual(job);
    ext.stop();
  });

  it("propaga a recusa da extensão", async () => {
    const ext = fakeExtension("1.0.0", { reply: { ok: false, error: "Proposta inválida." } });
    const result = await sendPilotJob({
      proposta: { items: [] },
      portal: { orderId: "1", quotationExternalId: "x" }
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Proposta inválida.");
    ext.stop();
  });

  it("ignora resposta de outro requestId", async () => {
    const listener = (event: MessageEvent) => {
      const data = event.data as { source?: string; type?: string };
      if (data?.source !== APP_CHANNEL || data.type !== "ping") return;
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { source: EXT_CHANNEL, type: "pong", version: "9.9.9", requestId: "outro" },
          origin: window.location.origin,
          source: window
        })
      );
    };
    document.documentElement.setAttribute("data-lpa-modo-piloto", "1.0.0");
    window.addEventListener("message", listener);

    expect(await pingPilotExtension()).toBe(null);

    window.removeEventListener("message", listener);
  });
});
