# Systems

A personal **superapp** — a single shell that hosts all your tools. Vanilla
HTML/CSS/JS, no build step, no dependencies. Open it and it works.

## Run it

- **Locally:** double-click `index.html`, or serve the folder:
  ```bash
  npx serve .        # or: python -m http.server
  ```
- **Online:** it's a static site, so GitHub Pages works with zero config
  (Settings → Pages → deploy from `main` / root).

## Add a tool

Everything lives in one file: **`js/registry.js`**. Add an object to the
`window.TOOLS` array:

```js
window.TOOLS = [
  {
    id: "notes",                 // unique, url-safe
    name: "Notes",               // shown on the card + header
    icon: "📝",                  // any emoji
    description: "A quick scratchpad.",
    accent: "#6366f1",           // optional card colour
    mount(el, ctx) {             // render your tool into `el`
      el.innerHTML = "<textarea class='tool-fill'></textarea>";
      const ta = el.querySelector("textarea");
      ta.value = ctx.store.get("text", "");           // load
      ta.oninput = () => ctx.store.set("text", ta.value); // save
    },
  },
];
```

Save, refresh — it appears on the dashboard as a card at `#/t/notes`.

### What `mount(el, ctx)` gives you

| Thing | What it is |
|-------|------------|
| `el` | An empty `<div>` that fills the screen — put your UI here. |
| `ctx.store` | `get(k, default)` / `set(k, v)` / `del(k)`, **scoped to your tool** so keys never collide. Persists in `localStorage`. |
| `ctx.UI` | `el(tag, props, ...children)` and `clear(node)` helpers — build DOM without a framework. |
| `ctx.Router` | Navigate: `ctx.Router.go(ctx.Router.home())`. |
| `ctx.onCleanup(fn)` | Runs when the user leaves the tool (or just `return fn` from `mount`). Use it to stop timers, close streams, etc. |

### Bigger tools

Put the tool in `js/tools/<id>.js`, add a `<script>` tag for it in
`index.html` **before** `registry.js`, expose it on `window`, then reference it:

```js
{ id: "big", name: "Big Tool", icon: "🛠️", mount: window.BigTool }
```

## Structure

```
index.html          app shell (header, search, containers) + script order
css/style.css       theme (dark/light), layout, cards, tool view
js/store.js         namespaced localStorage + per-tool scopes
js/ui.js            el() / clear() DOM helpers
js/router.js        hash router  (#/  and  #/t/<id>)
js/registry.js  ←   YOU EDIT THIS — the list of tools
js/app.js           dashboard, tool host, theme, keyboard
js/tools/           (optional) one file per larger tool
```

## Shortcuts

- `/` — focus search
- `Esc` — clear search / leave a tool
