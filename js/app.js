/* Systems — app shell: dashboard, tool host, settings (app password). */
(function () {
  const { el, clear } = window.UI;
  const tools = window.TOOLS || [];

  const view        = document.getElementById("view");
  const settingsBtn = document.getElementById("settingsBtn");
  const brandHome   = document.getElementById("brandHome");

  let activeCleanup = null;
  function runCleanup() {
    if (typeof activeCleanup === "function") { try { activeCleanup(); } catch (e) {} }
    activeCleanup = null;
  }

  /* ── loading (while first Firebase pull completes) ── */
  function renderLoading() {
    clear(view);
    view.appendChild(el("div", { class: "loading" }, el("div", { class: "spinner" })));
  }

  /* ── dashboard ────────────────────────────────────── */
  function renderHome() {
    runCleanup();
    clear(view);
    document.title = "Systems";

    if (tools.length === 0) { view.appendChild(emptyState()); return; }

    const grid = el("div", { class: "grid" });
    tools.forEach((t) => grid.appendChild(card(t)));
    view.appendChild(grid);
  }

  function card(t) {
    return el("a", {
        class: "card",
        href: window.Router.toolHash(t.id),
        style: { "--accent": t.accent || "#8b5cf6" },
      },
      el("div", { class: "card-icon", text: t.icon || "🔧" }),
      el("div", { class: "card-body" },
        el("div", { class: "card-name", text: t.name || t.id }),
        t.description ? el("div", { class: "card-desc", text: t.description }) : null
      ),
      el("span", { class: "card-arrow material-symbols-rounded", text: "chevron_right" })
    );
  }

  function emptyState() {
    const snippet =
`window.TOOLS = [
  {
    id: "notes",
    name: "Notes",
    icon: "📓",
    mount: window.NotesTool,
  },
];`;
    return el("div", { class: "empty" },
      el("div", { class: "empty-mark", text: "◆" }),
      el("h2", { text: "No tools yet" }),
      el("pre", { class: "code", text: snippet })
    );
  }

  /* ── tool host ────────────────────────────────────── */
  function renderTool(id) {
    runCleanup();
    clear(view);

    const t = tools.find((x) => x.id === id);
    if (!t) { renderHome(); return; }

    const host = el("div", { class: "tool-host" });
    view.appendChild(host);

    const ctx = {
      store: window.Store.scope(t.id),
      Vault: window.Vault,
      UI: window.UI,
      Store: window.Store,
      Router: window.Router,
      onCleanup: (fn) => { activeCleanup = fn; },
    };
    try {
      const maybe = t.mount(host, ctx);
      if (typeof maybe === "function") activeCleanup = maybe;
    } catch (e) {
      host.appendChild(el("pre", { class: "code", text: "Tool crashed:\n" + ((e && e.stack) || e) }));
    }
    document.title = (t.name || t.id) + " — Systems";
  }

  /* ── settings (app password) ──────────────────────── */
  function renderSettings() {
    runCleanup();
    clear(view);
    document.title = "Settings — Systems";

    const has = window.Vault.hasPassword();
    const msg = el("p", { class: "form-msg" });
    const panel = el("div", { class: "card-panel" });
    panel.appendChild(el("div", { class: "panel-title", text: "Password" }));

    let cur = null;
    if (has) {
      cur = el("input", { type: "password", class: "field", placeholder: "Current password", autocomplete: "current-password" });
      panel.appendChild(cur);
    }
    const next = el("input", { type: "password", class: "field", placeholder: "New password", autocomplete: "new-password" });
    const conf = el("input", { type: "password", class: "field", placeholder: has ? "Confirm new password" : "Confirm password", autocomplete: "new-password" });
    const btn  = el("button", { class: has ? "btn primary" : "btn success", text: has ? "Update password" : "Set password" });
    panel.appendChild(next); panel.appendChild(conf); panel.appendChild(btn); panel.appendChild(msg);

    function setMsg(text, kind) { msg.textContent = text; msg.className = "form-msg " + (kind || ""); }

    btn.addEventListener("click", async () => {
      const n = next.value, c = conf.value;
      if (!n) return setMsg("Enter a password.", "err");
      if (n !== c) return setMsg("Passwords don't match.", "err");
      btn.disabled = true;
      try {
        if (has) {
          const ok = await window.Vault.changePassword(cur.value, n);
          if (!ok) { setMsg("Current password is wrong.", "err"); btn.disabled = false; return; }
          setMsg("Password updated.", "ok");
        } else {
          await window.Vault.setPassword(n);
          setMsg("Password set.", "ok");
        }
        setTimeout(renderSettings, 700);
      } catch (e) {
        setMsg("Something went wrong.", "err");
        btn.disabled = false;
      }
    });

    const wrap = el("div", { class: "settings" },
      el("h1", { class: "page-title", text: "Settings" }),
      panel
    );
    if (has && window.Vault.isUnlocked()) {
      const lockBtn = el("button", { class: "btn ghost lock-now", text: "Lock notes now" });
      lockBtn.addEventListener("click", () => { window.Vault.lock(); renderSettings(); });
      wrap.appendChild(lockBtn);
    }
    view.appendChild(wrap);
  }

  /* ── routing ──────────────────────────────────────── */
  function route(cur) {
    if (cur.route === "tool") renderTool(cur.id);
    else if (cur.route === "settings") renderSettings();
    else renderHome();
  }
  window.Router.onChange(route);

  settingsBtn.addEventListener("click", () => window.Router.go(window.Router.settings()));
  brandHome.addEventListener("click", () => window.Router.go(window.Router.home()));
  brandHome.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.Router.go(window.Router.home()); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && window.Router.parse().route !== "home") window.Router.go(window.Router.home());
  });

  /* Re-render when fresh data arrives from another device — but never yank the
     view out from under active typing. */
  window.addEventListener("systems-synced", () => {
    const a = document.activeElement;
    if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) return;
    route(window.Router.parse());
  });

  /* ── boot: wait for the first Firebase pull, then route ── */
  renderLoading();
  window.Sync.ready.then(() => window.Router.start());
})();
