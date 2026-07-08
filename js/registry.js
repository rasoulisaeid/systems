/* ───────────────────────────────────────────────────────────────
   TOOL REGISTRY  —  the only file you edit to add a tool.

   { id, name, icon, accent?, description?, mount(el, ctx) }

   Inside mount(el, ctx):
     el         — empty container that fills the screen
     ctx.store  — per-tool storage: ctx.store.get(k, def) / set(k, v)
     ctx.Vault  — app-password encryption: await ctx.Vault.encrypt(obj)
     ctx.UI     — { el, clear } DOM helpers
     ctx.Router — navigation
     ctx.onCleanup(fn) — runs when the user leaves the tool

   Big tools live in js/tools/<id>.js (add its <script> in index.html
   before registry.js) and expose a mount fn on window, referenced here.
   ─────────────────────────────────────────────────────────────── */

window.TOOLS = [
  {
    id: "notes",
    name: "Notes",
    icon: "📓",
    accent: "#8b5cf6",
    mount: window.NotesTool,
  },
  {
    id: "books",
    name: "Books",
    icon: "📚",
    accent: "#1cb0f6",
    mount: window.BooksTool,
  },
];
