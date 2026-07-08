/* Books — a reading list.
 * Two sections:
 *   Library — grid of books with a circular cover, title, who recommended it,
 *             and a status pill (To read → Reading → Read) that cycles on click.
 *   Discover — ask Claude (Opus 4.8) for a ranked reading list from an author
 *              name, a description of a kind of book, or a link (web search /
 *              web fetch run server-side). Each book has a short review note
 *              and a cover built from its ISBN via Open Library. Lists are
 *              saved and any book can be added to the Library.
 * Data (plain, not encrypted):
 *   "data"    → [{ id, title, image, recommendedBy, status, updatedAt }]
 *   "authors" → [{ id, label, books: [{ title, author, isbn, image, note }], updatedAt }]
 *               books array order = ranking (first = read first) */
window.BooksTool = function mount(container, ctx) {
  const h = ctx.UI.el;
  const clear = ctx.UI.clear;
  const store = ctx.store;           // scoped to "books"

  const STATUSES = ["toread", "reading", "read"];
  const STATUS_LABEL = { toread: "To read", reading: "Reading", read: "Read" };

  let books = store.get("data", []);
  let authors = store.get("authors", []);
  let filter = "all";                // all | toread | reading | read
  let tab = "library";               // library | authors
  let asking = false;                // an API request is in flight

  function persistBooks()   { store.set("data", books); }
  function persistAuthors() { store.set("authors", authors); }

  /* ── shell: header + tabs ────────────────────────── */
  function render() {
    clear(container);

    container.appendChild(h("div", { class: "notes-head" },
      h("h1", { class: "notes-title" }, "Books"),
      tab === "library"
        ? h("button", { class: "add-btn", title: "Add book", onclick: () => renderForm(null) }, icon("add"))
        : null
    ));

    container.appendChild(h("div", { class: "book-tabs" },
      tabBtn("library", "Library", "auto_stories"),
      tabBtn("authors", "Discover", "travel_explore")
    ));

    if (tab === "library") renderLibrary();
    else renderAuthors();
  }

  function tabBtn(value, label, ic) {
    return h("button", {
      class: "book-tab" + (tab === value ? " active" : ""),
      onclick: () => { tab = value; render(); },
    }, icon(ic), " " + label);
  }

  /* ── Library ─────────────────────────────────────── */
  function renderLibrary() {
    container.appendChild(h("div", { class: "book-filters" },
      chip("all", "All"),
      chip("toread", STATUS_LABEL.toread),
      chip("reading", STATUS_LABEL.reading),
      chip("read", STATUS_LABEL.read)
    ));

    const shown = books
      .filter((b) => filter === "all" || b.status === filter)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    if (shown.length === 0) {
      container.appendChild(h("div", { class: "notes-empty" }, icon("auto_stories")));
      return;
    }

    const grid = h("div", { class: "book-grid" });
    shown.forEach((b) => grid.appendChild(bookCard(b)));
    container.appendChild(grid);
  }

  function chip(value, label) {
    return h("button", {
      class: "filter-chip" + (filter === value ? " active" : ""),
      onclick: () => { filter = value; render(); },
    }, label);
  }

  function bookCard(b) {
    const pill = h("button", {
      class: "status-pill " + b.status,
      title: "Change status",
      onclick: () => {
        b.status = STATUSES[(STATUSES.indexOf(b.status) + 1) % STATUSES.length];
        b.updatedAt = Date.now();
        persistBooks();
        render();
      },
    }, STATUS_LABEL[b.status] || b.status);

    return h("div", { class: "book-card" },
      h("button", { class: "book-main", title: "Edit book", onclick: () => renderForm(b) },
        cover(b.image, b.title, "book-cover"),
        h("div", { class: "book-title" }, b.title || "Untitled"),
        b.recommendedBy
          ? h("div", { class: "book-rec" }, icon("person"), " " + b.recommendedBy)
          : null
      ),
      pill
    );
  }

  /* circular cover with a first-letter fallback when the image is missing/broken */
  function cover(src, title, cls) {
    const letter = (title || "?").trim().charAt(0).toUpperCase();
    if (!src) return h("div", { class: cls + " book-cover-fallback" }, letter);
    const img = h("img", { class: cls, src: src, alt: title || "Book cover" });
    img.addEventListener("error", () => {
      img.replaceWith(h("div", { class: cls + " book-cover-fallback" }, letter));
    });
    // Open Library returns a 1x1 pixel instead of a 404 for unknown covers
    img.addEventListener("load", () => {
      if (img.naturalWidth <= 1) img.replaceWith(h("div", { class: cls + " book-cover-fallback" }, letter));
    });
    return img;
  }

  /* ── Library: add / edit form ────────────────────── */
  function renderForm(existing) {
    clear(container);

    const title = h("input", { class: "field", placeholder: "Title", value: existing ? existing.title : "" });
    const image = h("input", { class: "field", placeholder: "Cover image URL (optional)", value: existing && existing.image ? existing.image : "" });
    const rec   = h("input", { class: "field", placeholder: "Recommended by (optional)", value: existing && existing.recommendedBy ? existing.recommendedBy : "" });

    let status = existing ? existing.status : "toread";
    const statusRow = h("div", { class: "status-choice" });
    function drawStatuses() {
      clear(statusRow);
      STATUSES.forEach((s) => statusRow.appendChild(
        h("button", {
          class: "status-pill " + s + (status === s ? " selected" : " dim"),
          onclick: () => { status = s; drawStatuses(); },
        }, STATUS_LABEL[s])
      ));
    }
    drawStatuses();

    const msg = h("p", { class: "form-msg" });
    const save = h("button", { class: "btn success", onclick: submit }, existing ? "Save" : "Add book");

    function submit() {
      if (!title.value.trim()) {
        msg.textContent = "Give the book a title.";
        msg.className = "form-msg err";
        return;
      }
      if (existing) {
        existing.title = title.value.trim();
        existing.image = image.value.trim();
        existing.recommendedBy = rec.value.trim();
        existing.status = status;
        existing.updatedAt = Date.now();
      } else {
        addToLibrary(title.value.trim(), image.value.trim(), rec.value.trim(), status);
      }
      persistBooks();
      render();
    }

    const top = h("div", { class: "editor-top" },
      h("button", { class: "round-btn", title: "Back", onclick: render }, icon("arrow_back")),
      existing
        ? h("button", { class: "round-btn danger", title: "Delete", onclick: () => {
            books = books.filter((x) => x.id !== existing.id);
            persistBooks();
            render();
          } }, icon("delete"))
        : null
    );

    container.appendChild(h("div", { class: "book-form" }, top,
      h("div", { class: "card-panel" },
        h("div", { class: "panel-title" }, existing ? "Edit book" : "New book"),
        title, image, rec, statusRow, save, msg
      )
    ));
    title.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    setTimeout(() => title.focus(), 30);
  }

  function addToLibrary(title, image, recommendedBy, status) {
    books.push({
      id: "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: title,
      image: image || "",
      recommendedBy: recommendedBy || "",
      status: status || "toread",
      updatedAt: Date.now(),
    });
  }

  function inLibrary(title) {
    const t = title.trim().toLowerCase();
    return books.some((b) => (b.title || "").trim().toLowerCase() === t);
  }

  /* ── Discover ────────────────────────────────────── */
  function renderAuthors() {
    const apiKey = window.Store.get("claude:apiKey", "");

    if (!apiKey) {
      container.appendChild(h("div", { class: "lock" },
        h("div", { class: "lock-badge" }, icon("key")),
        h("p", { class: "authors-hint" }, "Add your Claude API key in Settings to discover books."),
        h("button", { class: "btn primary", onclick: () => ctx.Router.go("#/settings") }, "Open Settings")
      ));
      return;
    }

    const input = h("textarea", { class: "field discover-input", rows: "2",
      placeholder: "An author, a kind of book, or a link…\ne.g. \"Haruki Murakami\", \"funny sci-fi with heart\", or a URL" });
    const msg = h("p", { class: "form-msg" });
    const btn = h("button", { class: "btn primary", disabled: asking ? "true" : null },
      asking ? "Asking Claude…" : "Ask Claude");

    async function submit() {
      const query = input.value.trim();
      if (!query || asking) return;
      asking = true;
      btn.disabled = true;
      btn.textContent = "Asking Claude…";
      msg.textContent = "Claude is compiling the reading list — this can take a minute.";
      msg.className = "form-msg";
      try {
        const result = await fetchBookList(apiKey, query);
        // replace an existing list with the same label rather than duplicating
        authors = authors.filter((a) => listLabel(a).toLowerCase() !== result.label.toLowerCase());
        authors.push(result);
        persistAuthors();
        asking = false;
        render();
      } catch (e) {
        asking = false;
        btn.disabled = false;
        btn.textContent = "Ask Claude";
        msg.textContent = (e && e.message) || "Request failed.";
        msg.className = "form-msg err";
      }
    }
    btn.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
    });

    container.appendChild(h("div", { class: "author-ask card-panel" },
      h("div", { class: "panel-title" }, "Find books"),
      h("div", { class: "author-ask-row" }, input, btn),
      msg
    ));

    if (authors.length === 0) {
      container.appendChild(h("div", { class: "notes-empty" }, icon("person_search")));
      return;
    }

    authors
      .slice()
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .forEach((a) => container.appendChild(listSection(a)));
  }

  /* older saved entries used {name}; newer ones use {label} */
  function listLabel(a) { return a.label || a.name || "Books"; }

  function listSection(a) {
    const grid = h("div", { class: "abook-grid" });
    a.books.forEach((b, i) => grid.appendChild(listBookCard(a, b, i + 1)));

    return h("section", { class: "author-section" },
      h("div", { class: "author-head" },
        h("h2", { class: "author-name" }, listLabel(a)),
        h("span", { class: "author-count" }, a.books.length + " books"),
        h("button", { class: "round-btn danger author-del", title: "Remove list", onclick: () => {
          authors = authors.filter((x) => x.id !== a.id);
          persistAuthors();
          render();
        } }, icon("delete"))
      ),
      grid
    );
  }

  function listBookCard(a, b, rank) {
    const added = inLibrary(b.title);
    const addBtn = h("button", {
      class: "btn abook-add" + (added ? "" : " success"),
      disabled: added ? "true" : null,
    }, added ? "✓ In list" : "Add");
    if (!added) {
      addBtn.addEventListener("click", () => {
        addToLibrary(b.title, b.image, "Claude", "toread");
        persistBooks();
        render();
      });
    }

    return h("div", { class: "abook-card" },
      h("div", { class: "abook-rank" }, String(rank)),
      cover(b.image, b.title, "book-cover abook-cover"),
      h("div", { class: "book-title" }, b.title),
      b.author ? h("div", { class: "abook-author" }, b.author) : null,
      h("p", { class: "abook-note" }, b.note || ""),
      addBtn
    );
  }

  /* ── Claude API (Opus 4.8, structured output + web tools) ──
   * The query can be an author name, a description of a kind of book, or a
   * URL. Web search/fetch run server-side; when the server tool loop pauses
   * (stop_reason "pause_turn") we append the assistant turn and re-send. */
  async function fetchBookList(apiKey, query) {
    const schema = {
      type: "object",
      properties: {
        label: {
          type: "string",
          description: "A short heading for this list (2-6 words). For an author request, the author's canonical name; for a theme or link, a concise topic title.",
        },
        books: {
          type: "array",
          description: "The recommended books, best-ranked first: the book to read first comes first.",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              author: { type: "string", description: "The book's author." },
              isbn: { type: "string", description: "ISBN-13 or ISBN-10 of a common edition, digits only. Empty string if not confidently known." },
              note: { type: "string", description: "A short review note, 1-2 sentences: what the book is and why it earns its place in the ranking." },
            },
            required: ["title", "author", "isbn", "note"],
            additionalProperties: false,
          },
        },
      },
      required: ["label", "books"],
      additionalProperties: false,
    };

    const body = {
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema: schema } },
      tools: [
        { type: "web_search_20260209", name: "web_search", max_uses: 5 },
        { type: "web_fetch_20260209", name: "web_fetch", max_uses: 5 },
      ],
      messages: [{
        role: "user",
        content:
          "Build a ranked reading list for this request:\n\n" + query + "\n\n" +
          "Interpret the request naturally: if it's an author's name, list their notable books in the order a " +
          "newcomer should read them. If it describes a kind of book (genre, mood, topic, \"books like X\"), " +
          "recommend the best matches ranked best-first. If it contains a URL, fetch it and base the list on its " +
          "content — the book or author it discusses, or books it points to. Use web search when it helps you get " +
          "titles, authors, or ISBNs right. Give each book a short review note saying what it is and why it earns " +
          "its place. Include the ISBN of a common edition when confidently known, else an empty string. " +
          "If the request is unintelligible or matches no real books, return an empty books array.\n\n" +
          "Always write the label and every review note in English, no matter what language this request is in. " +
          "Keep each book's title in its original published form.",
      }],
    };

    async function call() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 240000); // 4-minute ceiling
      let res;
      try {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (e) {
        if (e && e.name === "AbortError") throw new Error("Claude took over 4 minutes — try a shorter or simpler request.");
        // fetch itself rejected: no network, or the browser blocked the response (CORS)
        throw new Error("Couldn't reach the Claude API — network blocked or offline. See the browser console (F12) for details.");
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) {
        let detail = "";
        try { detail = (await res.json()).error.message; } catch (e) {}
        console.warn("[books] Claude API " + res.status, detail);
        if (res.status === 401) throw new Error("Invalid API key — check it in Settings.");
        throw new Error("Claude API error " + res.status + (detail ? ": " + detail : ""));
      }
      return res.json();
    }

    let data = await call();
    // server-side tool loop can pause; append the assistant turn and resume
    for (let i = 0; i < 5 && data.stop_reason === "pause_turn"; i++) {
      body.messages.push({ role: "assistant", content: data.content });
      data = await call();
    }

    console.log("[books] Claude response", data);
    if (data.stop_reason === "refusal") throw new Error("Claude declined this request.");
    // with server tools the answer is the LAST text block
    const textBlock = (data.content || []).filter((b) => b.type === "text").pop();
    if (!textBlock) throw new Error("Claude returned no answer (stop reason: " + (data.stop_reason || "unknown") + "). See the console (F12).");
    const parsed = JSON.parse(textBlock.text);
    if (!parsed.books || parsed.books.length === 0) {
      throw new Error("No books found for that request — try rephrasing it.");
    }

    return {
      id: "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      label: parsed.label || query.slice(0, 60),
      books: parsed.books.map((b) => ({
        title: b.title,
        author: b.author || "",
        isbn: b.isbn || "",
        image: b.isbn ? "https://covers.openlibrary.org/b/isbn/" + encodeURIComponent(b.isbn) + "-M.jpg" : "",
        note: b.note || "",
      })),
      updatedAt: Date.now(),
    };
  }

  /* ── helpers ─────────────────────────────────────── */
  function icon(name) { return h("span", { class: "material-symbols-rounded" }, name); }

  render();
};
