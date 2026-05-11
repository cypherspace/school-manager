// Tiny vanilla-DOM helpers. Not a virtual DOM — just less boilerplate around
// createElement / classList / attributes.

export type Child = Node | string | null | undefined | false;

export function h(
  tag: string,
  attrs: Record<string, unknown> = {},
  ...children: Array<Child | Child[]>
): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class" || k === "className") el.className = String(v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (k === "html") {
      el.innerHTML = String(v);
    } else if (typeof v === "boolean") {
      if (v) el.setAttribute(k, "");
    } else {
      el.setAttribute(k, String(v));
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return el;
}

export function clear(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function mount(root: HTMLElement, node: Node): void {
  clear(root);
  root.appendChild(node);
}

export function bar(value: number, max = 100): HTMLElement {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return h("div", { class: "bar" }, h("span", { style: { width: pct + "%" } }));
}
