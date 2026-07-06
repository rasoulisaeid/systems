/* Encrypted Notes — a private notebook.
 * Locked by the app password (set in Settings). Every note's title and body
 * are stored AES-GCM encrypted via window.Vault; nothing is readable on disk
 * without the password. */
window.NotesTool = function mount(container, ctx) {
  const h = ctx.UI.el;
  const clear = ctx.UI.clear;
  const Vault = window.Vault;
  const store = ctx.store;          // scoped to "notes"

  let sessions = [];                // decrypted, in memory while unlocked
  let saveTimer = null;
  let disposed = false;

  /* ── persistence ─────────────────────────────────── */
  async function load() {
    const blob = store.get("data", null);
    if (!blob) { sessions = []; return; }
    try { sessions = (await Vault.decrypt(blob)) || []; }
    catch (e) { sessions = []; }
  }
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try { store.set("data", await Vault.encrypt(sessions)); } catch (e) {}
    }, 300);
  }

  /* ── screens ─────────────────────────────────────── */
  function render() {
    if (disposed) return;
    clear(container);
    if (!Vault.hasPassword()) return renderNoPassword();
    if (!Vault.isUnlocked())  return renderLock();
    return renderList();
  }

  function renderNoPassword() {
    container.appendChild(h("div", { class: "lock" },
      h("div", { class: "lock-badge" }, icon("lock")),
      h("button", { class: "btn primary", onclick: () => ctx.Router.go("#/settings") }, "Set a password")
    ));
  }

  function renderLock() {
    const input = h("input", { type: "password", class: "lock-input", placeholder: "Password", autocomplete: "current-password" });
    const card = h("div", { class: "lock" },
      h("div", { class: "lock-badge" }, icon("lock")),
      input,
      h("button", { class: "btn primary", onclick: submit }, "Unlock")
    );
    async function submit() {
      const ok = await Vault.unlock(input.value);
      if (ok) { await load(); render(); }
      else {
        card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
        input.value = ""; input.focus();
      }
    }
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    container.appendChild(card);
    setTimeout(() => input.focus(), 30);
  }

  function renderList() {
    container.appendChild(h("div", { class: "notes-head" },
      h("h1", { class: "notes-title" }, "Notes"),
      h("button", { class: "add-btn", title: "New note", onclick: newNote }, icon("add"))
    ));

    if (sessions.length === 0) {
      container.appendChild(h("div", { class: "notes-empty" }, icon("edit_note")));
      return;
    }

    const list = h("div", { class: "note-list" });
    sessions.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).forEach((s) => {
      list.appendChild(h("button", { class: "note-row", onclick: () => openNote(s.id) },
        h("span", { class: "note-row-title" }, s.title || "Untitled"),
        h("span", { class: "note-row-date" }, fmtDate(s.updatedAt))
      ));
    });
    container.appendChild(list);
  }

  function openNote(id) {
    const s = sessions.find((x) => x.id === id);
    if (!s) return render();
    clear(container);

    const title = h("input", { class: "note-title-input", placeholder: "Title" });
    const body  = h("textarea", { class: "note-body-input" });
    title.value = s.title || "";
    body.value  = s.body || "";
    title.addEventListener("input", () => { s.title = title.value; s.updatedAt = Date.now(); persist(); });
    body.addEventListener("input",  () => { s.body  = body.value;  s.updatedAt = Date.now(); persist(); });

    container.appendChild(h("div", { class: "editor-top" },
      h("button", { class: "round-btn", title: "Back", onclick: render }, icon("arrow_back")),
      h("button", { class: "round-btn danger", title: "Delete", onclick: () => deleteNote(id) }, icon("delete"))
    ));
    container.appendChild(h("div", { class: "editor" }, title, body));
    setTimeout(() => (s.title ? body : title).focus(), 30);
  }

  function newNote() {
    const s = {
      id: "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: "", body: "", updatedAt: Date.now(),
    };
    sessions.push(s);
    persist();
    openNote(s.id);
  }

  function deleteNote(id) {
    sessions = sessions.filter((x) => x.id !== id);
    persist();
    render();
  }

  /* ── helpers ─────────────────────────────────────── */
  function icon(name) { return h("span", { class: "material-symbols-rounded" }, name); }
  function fmtDate(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toDateString() === new Date().toDateString()
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  /* re-render if the vault gets locked / password changes while we're open */
  const unsub = Vault.onChange(() => render());
  ctx.onCleanup(() => { disposed = true; clearTimeout(saveTimer); unsub(); });

  /* boot */
  (async () => { if (Vault.isUnlocked()) await load(); render(); })();
};
