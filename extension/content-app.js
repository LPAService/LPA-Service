/**
 * Ponte entre o app LPA e a extensão.
 *
 * A página do app não consegue falar com a extensão direto, então o handshake é
 * por window.postMessage: o app avisa que tem um job, este script repassa para o
 * service worker, que abre/foca a aba do portal e dispara o piloto.
 *
 * Só aceita mensagem da própria janela e da própria origem.
 */
(() => {
  const APP_CHANNEL = "lpa-modo-piloto";
  const EXT_CHANNEL = "lpa-modo-piloto-ext";
  const VERSION = chrome.runtime.getManifest().version;

  function reply(payload) {
    window.postMessage({ source: EXT_CHANNEL, ...payload }, window.location.origin);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.source !== APP_CHANNEL) return;

    if (data.type === "ping") {
      reply({ type: "pong", version: VERSION, requestId: data.requestId });
      return;
    }

    if (data.type === "job") {
      chrome.runtime
        .sendMessage({ type: "pilot-job", job: data.job })
        .then((result) => reply({ type: "job-ack", requestId: data.requestId, ...(result ?? { ok: false }) }))
        .catch((error) =>
          reply({ type: "job-ack", requestId: data.requestId, ok: false, error: String(error?.message ?? error) })
        );
    }
  });

  // Marca para o app detectar a extensão antes mesmo do ping.
  document.documentElement.setAttribute("data-lpa-modo-piloto", VERSION);
  reply({ type: "ready", version: VERSION });
})();
