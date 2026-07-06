/* Systems — app shell: theme, search, routing, dashboard + tool host. */
(function () {
  const { el, clear } = window.UI;
  const tools = window.TOOLS || [];

  const view        = document.getElementById("view");
  const search      = document.getElementById("search");
  const themeToggle = document.getElementById("themeToggle");
  const brandHome   = document.getElementById("brandHome");
  const footNote    = document.getElementById("footNote");

  let filter = "";
  let activeCleanup = null;

  /* ── theme ────────────────────────────────────────── */
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    themeToggle.textContent = t === "dark" ? "☀️" : "🌙";
    themeToggle.title = t === "dark" ? "Switch to light" : "Switch to dark";
    window.Store.set("theme", t);
  }
  function initTheme() {
    const saved = window.Store.get("theme", null);
    const sys = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    applyTheme(saved || sys);
  }
  themeToggle.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    applyTheme(cur === "dark" ? "light" : "dark");
  });

  /* ── helpers ──────────────────────────────────────── */
  function findTool(id) { return tools.find((t) => t.id === id); }
  function runCleanup() {
    if (typeof activeCleanup === "function") { try { activeCleanup(); } catch (e) {} }
    activeCleanup = null;
  }

  /* ── dashboard ────────────────────────────────────── */
  function renderHome() {
    runCleanup();
    clear(view);
    search.style.visibility = "visible";
    document.title = "Systems";

    if (tools.length === 0) { view.appendChild(emptyState()); return; }

    const q = filter.trim().toLowerCase();
    const list = q
      ? tools.filter((t) => (t.name + " " + (t.description || "")).toLowerCase().includes(q))
      : tools;

    const grid = el("div", { class: "grid" });
    list.forEach((t) => grid.appendChild(card(t)));
    if (list.length === 0) {
      grid.appendChild(el("p", { class: "muted noresults", text: `No tools match “${filter}”.` }));
    }
    view.appendChild(grid);
  }

  function card(t) {
    return el("a", {
        class: "card",
        href: window.Router.toolHash(t.id),
        style: { "--accent": t.accent || "#6366f1" },
      },
      el("div", { class: "card-icon", text: t.icon || "🔧" }),
      el("div", { class: "card-body" },
        el("h3", { class: "card-name", text: t.name || t.id }),
        el("p", { class: "card-desc", text: t.description || "" })
      ),
      el("span", { class: "card-arrow", text: "→" })
    );
  }

  function emptyState() {
    const snippet =
`window.TOOLS = [
  {
    id: "notes",
    name: "Notes",
    icon: "📝",
    description: "A quick scratchpad.",
    mount(el, ctx) {
      el.innerHTML = "<textarea class='tool-fill'></textarea>";
      const ta = el.querySelector("textarea");
      ta.value = ctx.store.get("text", "");
      ta.oninput = () => ctx.store.set("text", ta.value);
    },
  },
];`;
    return el("div", { class: "empty" },
      el("div", { class: "empty-mark", text: "◆" }),
      el("h2", { text: "Your superapp is ready" }),
      el("p", { class: "muted", text: "No tools registered yet. Add your first one in js/registry.js — about a dozen lines:" }),
      el("pre", { class: "code", text: snippet }),
      el("p", { class: "muted small", text: "Save the file, refresh, and it shows up here as a card." })
    );
  }

  /* ── tool view ────────────────────────────────────── */
  function renderTool(id) {
    runCleanup();
    clear(view);
    search.style.visibility = "hidden";

    const t = findTool(id);
    if (!t) {
      view.appendChild(el("div", { class: "empty" },
        el("div", { class: "empty-mark", text: "⚠️" }),
        el("h2", { text: "Tool not found" }),
        el("p", { class: "muted", text: `No tool with id “${id}”.` }),
        el("a", { class: "btn", href: window.Router.home(), text: "← Back to dashboard" })
      ));
      return;
    }

    view.appendChild(
      el("div", { class: "toolbar" },
        el("a", { class: "back", href: window.Router.home(), title: "Back (Esc)", text: "←" }),
        el("span", { class: "tool-title", text: (t.icon ? t.icon + "  " : "") + (t.name || t.id) })
      )
    );
    const host = el("div", { class: "tool-host" });
    view.appendChild(host);

    const ctx = {
      store: window.Store.scope(t.id),
      UI: window.UI,
      Store: window.Store,
      Router: window.Router,
      onCleanup: (fn) => { activeCleanup = fn; },
    };
    try {
      const maybe = t.mount(host, ctx);
      if (typeof maybe === "function") activeCleanup = maybe;
    } catch (e) {
      host.appendChild(el("pre", { class: "code error", text: "Tool crashed:\n" + ((e && e.stack) || e) }));
    }
    document.title = (t.name || t.id) + " — Systems";
  }

  /* ── routing ──────────────────────────────────────── */
  window.Router.onChange((cur) => {
    if (cur.route === "tool") renderTool(cur.id);
    else renderHome();
  });

  /* ── search + keyboard ────────────────────────────── */
  search.addEventListener("input", () => {
    filter = search.value;
    if (window.Router.parse().route === "home") renderHome();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== search) {
      e.preventDefault();
      search.focus();
    } else if (e.key === "Escape") {
      if (document.activeElement === search && search.value) {
        search.value = ""; filter = ""; renderHome();
      } else if (window.Router.parse().route === "tool") {
        window.Router.go(window.Router.home());
      } else {
        search.blur();
      }
    }
  });
  brandHome.addEventListener("click", () => window.Router.go(window.Router.home()));
  brandHome.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") window.Router.go(window.Router.home());
  });

  /* ── boot ─────────────────────────────────────────── */
  initTheme();
  footNote.textContent = `Systems · ${tools.length} tool${tools.length === 1 ? "" : "s"} · vanilla, no build`;
  window.Router.start();
})();
