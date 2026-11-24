// =====================================================================
// Cầu nối giữa trang Web PEM và Service Worker của Extension
// =====================================================================
(() => {
  if (window.__pemBridgeLoaded) return;
  window.__pemBridgeLoaded = true;

  // Báo cho trang PEM biết extension đã được cài sẵn
  window.postMessage({ channel: "PEM_FANPAGE_EXT", type: "PEM_EXT_READY", version: "2.2.0" }, "*");

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.channel !== "PEM_FANPAGE_WEB" || !msg.type) return;

    const { requestId, type, payload } = msg;
    chrome.runtime.sendMessage({ type, ...(payload || {}) }, (res) => {
      const err = chrome.runtime.lastError;
      window.postMessage(
        {
          channel: "PEM_FANPAGE_EXT",
          requestId,
          ...(err ? { ok: false, error: err.message } : res || { ok: false, error: "Không có phản hồi" }),
        },
        "*"
      );
    });
  });
})();
