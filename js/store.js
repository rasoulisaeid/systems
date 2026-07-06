/* Store — namespaced localStorage. All keys live under "systems:v1:".
 * Each tool gets its own sandbox via Store.scope(toolId). */
(function () {
  const NS = "systems:v1:";

  function get(key, def) {
    try {
      const raw = localStorage.getItem(NS + key);
      return raw === null ? def : JSON.parse(raw);
    } catch (e) { return def; }
  }
  function set(key, val) {
    try { localStorage.setItem(NS + key, JSON.stringify(val)); }
    catch (e) { console.warn("Store.set failed", e); }
  }
  function del(key) {
    try { localStorage.removeItem(NS + key); } catch (e) {}
  }

  // Returns a store whose keys are prefixed with the tool id, so tools
  // can never collide with each other or with app-level settings.
  function scope(toolId) {
    const p = "tool:" + toolId + ":";
    return {
      get: (k, d) => get(p + k, d),
      set: (k, v) => set(p + k, v),
      del: (k) => del(p + k),
    };
  }

  window.Store = { get, set, del, scope, NS };
})();
