/* Router — dead-simple hash router.
 *   #/            -> { route: "home" }
 *   #/settings    -> { route: "settings" }
 *   #/t/<id>      -> { route: "tool", id }
 */
(function () {
  const subs = [];

  function parse() {
    const h = location.hash.replace(/^#\/?/, "");
    const parts = h.split("/").filter(Boolean);
    if (parts[0] === "settings") return { route: "settings", id: null };
    if (parts[0] === "t" && parts[1]) return { route: "tool", id: decodeURIComponent(parts[1]) };
    return { route: "home", id: null };
  }

  function emit() {
    const cur = parse();
    subs.forEach((fn) => { try { fn(cur); } catch (e) { console.error(e); } });
  }

  window.addEventListener("hashchange", emit);

  window.Router = {
    parse,
    onChange(fn) { subs.push(fn); },
    start() { emit(); },
    go(hash) { location.hash = hash; },
    home: () => "#/",
    settings: () => "#/settings",
    toolHash: (id) => "#/t/" + encodeURIComponent(id),
  };
})();
