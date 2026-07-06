/* Encrypted Notes — a private notebook.
 * Locked by the app password (set in Settings). Every note's title and body
 * are stored AES-GCM encrypted via window.Vault; nothing is readable on disk
 * (or on Firebase) without the password. */
window.NotesTool = function mount(container, ctx) {
  const h = ctx.UI.el;
  const clear = ctx.UI.clear;
  const Vault = window.Vault;
  const store = ctx.store;          // scoped to "notes"

  const LINE_H = 44;                 // must match .paper-body line-height in style.css
  const LINES_PER_PAGE = 15;
  const PAGE_H = LINE_H * LINES_PER_PAGE; // one A4-style page

  let sessions = [];                 // decrypted, in memory while unlocked
  let saveTimer = null;
  let disposed = false;
  let resizeHandler = null;

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

  function dropResize() {
    if (resizeHandler) { window.removeEventListener("resize", resizeHandler); resizeHandler = null; }
  }

  /* ── screens ─────────────────────────────────────── */
  function render() {
    if (disposed) return;
    dropResize();
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
    dropResize();
    clear(container);

    const title = h("input", { class: "paper-title", placeholder: "Title" });
    const body  = h("textarea", { class: "paper-body", spellcheck: "false" });
    title.value = s.title || "";
    body.value  = s.body || "";

    // grow the sheet to fit the text, but never shorter than one full page
    function grow() {
      body.style.height = "auto";
      body.style.height = Math.max(body.scrollHeight, PAGE_H) + "px";
    }

    title.addEventListener("input", () => { s.title = title.value; s.updatedAt = Date.now(); persist(); });
    body.addEventListener("input",  () => { s.body  = body.value;  s.updatedAt = Date.now(); grow(); persist(); });

    resizeHandler = grow;
    window.addEventListener("resize", resizeHandler);

    container.appendChild(h("div", { class: "editor" },
      h("div", { class: "editor-top" },
        h("button", { class: "round-btn", title: "Back", onclick: render }, icon("arrow_back")),
        h("button", { class: "round-btn danger", title: "Delete", onclick: () => deleteNote(id) }, icon("delete"))
      ),
      title,
      h("div", { class: "paper" }, body)
    ));
    setTimeout(() => { grow(); (s.title ? body : title).focus(); }, 30);
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
  ctx.onCleanup(() => { disposed = true; clearTimeout(saveTimer); dropResize(); unsub(); });

  /* boot */
  (async () => { if (Vault.isUnlocked()) await load(); render(); })();
};
