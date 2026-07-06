/* Firebase sync — mirrors the Systems cache to Firebase Realtime Database.
 *
 * Reuses your existing RTDB, namespaced under /systems (no collision with the
 * TOEFL app's /families). Everything stored is already AES-GCM encrypted
 * client-side by vault.js, so only ciphertext + the wrapped key ever leave the
 * browser — the password never does.
 *
 *   on load : Firebase -> localStorage (bounded, so the app always boots)
 *   on write: localStorage -> Firebase (debounced)
 *   live    : SSE stream applies changes from your other devices
 */
(function () {
  const DB_URL    = "https://toefl-c71e5-default-rtdb.firebaseio.com";
  const USER_KEY  = "rasoulisaeid";
  const NODE_URL  = `${DB_URL}/systems/${USER_KEY}/data.json`;
  const CLIENT_ID = Math.random().toString(36).slice(2);

  let pushTimer = null;
  let lastSynced = null;             // JSON of the last state we pushed or applied
  let evtSource = null;
  let resolveReady;
  const ready = new Promise((r) => (resolveReady = r));

  function applyRemote(record) {
    if (!record || !record.data) return false;
    let obj;
    try { obj = JSON.parse(record.data); } catch (e) { return false; }
    const asJson = JSON.stringify(obj);
    if (asJson === lastSynced) return false;   // nothing new
    window.Store.restore(obj);
    lastSynced = asJson;
    window.dispatchEvent(new CustomEvent("systems-synced"));
    return true;
  }

  async function pullOnce() {
    if (!navigator.onLine) return;
    try {
      const res = await fetch(NODE_URL);
      if (!res.ok) throw new Error("HTTP " + res.status);
      applyRemote(await res.json());
    } catch (e) { console.warn("Systems: pull failed —", e.message); }
  }

  function schedulePush() {
    if (!navigator.onLine) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      const asJson = JSON.stringify(window.Store.dump());
      if (asJson === lastSynced) return;
      lastSynced = asJson;
      try {
        const res = await fetch(NODE_URL, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: asJson, updatedAt: Date.now(), clientId: CLIENT_ID }),
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
      } catch (e) {
        lastSynced = null;           // force a retry on the next change
        console.error("Systems: save failed —", e.message);
      }
    }, 700);
  }

  function subscribeSSE() {
    if (!navigator.onLine || typeof EventSource === "undefined") return;
    try {
      if (evtSource) evtSource.close();
      evtSource = new EventSource(NODE_URL);
      const onEvent = (e) => {
        let payload;
        try { payload = JSON.parse(e.data); } catch (_) { return; }
        if (!payload || payload.path !== "/") return;   // we always PUT the whole node
        const record = payload.data;
        if (!record || record.clientId === CLIENT_ID) return; // ignore our own echo
        applyRemote(record);
      };
      evtSource.addEventListener("put", onEvent);
      evtSource.addEventListener("patch", onEvent);
    } catch (e) { console.warn("Systems: live sync unavailable —", e.message); }
  }

  async function init() {
    // 1) initial load — bounded so a slow/offline network never blocks boot
    await Promise.race([pullOnce(), new Promise((r) => setTimeout(r, 4000))]);
    resolveReady();
    // 2) push on every local change (direct or via a tool scope)
    window.Store.onChange(schedulePush);
    // 3) live updates + reconnect when the network returns
    subscribeSSE();
    window.addEventListener("online", () => { pullOnce(); subscribeSSE(); });
  }

  window.Sync = { ready, pullOnce, schedulePush, CLIENT_ID };
  init();
})();
