/* ───────────────────────────────────────────────────────────────
   TOOL REGISTRY  —  this is the only file you edit to add a tool.

   Each tool is an object in the array below:

     {
       id:          "notes",              // unique, url-safe
       name:        "Notes",              // shown on the card + header
       icon:        "📝",                 // any emoji
       description: "A quick scratchpad", // one line
       accent:      "#6366f1",            // card accent colour (optional)
       mount(el, ctx) { ... }             // render your tool into `el`
     }

   Inside mount(el, ctx):
     • el         — an empty <div> container that fills the screen
     • ctx.store  — storage scoped to THIS tool (survives refresh):
                      ctx.store.set("key", value)
                      ctx.store.get("key", fallback)
     • ctx.UI     — { el, clear } DOM helpers (optional, see js/ui.js)
     • ctx.onCleanup(fn) — register a fn to run when the user leaves the tool
       (or just `return fn` from mount)

   Big tool? Put it in js/tools/<id>.js, add its <script> tag to
   index.html BEFORE this file, expose e.g. window.NotesTool, then
   reference it here:  { ...meta, mount: window.NotesTool }
   ─────────────────────────────────────────────────────────────── */

window.TOOLS = [

  /* ── EXAMPLE — remove the surrounding comment to switch it on ──
  {
    id: "notes",
    name: "Notes",
    icon: "📝",
    description: "A quick scratchpad that saves to your browser.",
    accent: "#6366f1",
    mount(el, ctx) {
      const ta = ctx.UI.el("textarea", {
        class: "tool-fill",
        placeholder: "Type here… saved automatically.",
      });
      ta.value = ctx.store.get("text", "");
      ta.addEventListener("input", () => ctx.store.set("text", ta.value));
      el.appendChild(ta);
    },
  },
  ───────────────────────────────────────────────────────────────── */

];
