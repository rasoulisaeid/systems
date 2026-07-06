/* UI — tiny DOM helpers so tools can build markup without a framework.
 *
 *   el("div", { class: "box", onclick: fn }, "hello", el("b", null, "!"))
 *   clear(node)  — remove all children
 */
(function () {
  function el(tag, props) {
    const node = document.createElement(tag);
    if (props) {
      for (const key in props) {
        const v = props[key];
        if (v === null || v === undefined || v === false) continue;
        if (key === "class") node.className = v;
        else if (key === "html") node.innerHTML = v;
        else if (key === "text") node.textContent = v;
        else if (key === "style" && typeof v === "object") Object.assign(node.style, v);
        else if (key.startsWith("on") && typeof v === "function")
          node.addEventListener(key.slice(2).toLowerCase(), v);
        else node.setAttribute(key, v);
      }
    }
    for (let i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }

  function append(node, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) { child.forEach((c) => append(node, c)); return; }
    node.appendChild(
      child instanceof Node ? child : document.createTextNode(String(child))
    );
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  window.UI = { el, clear };
})();
