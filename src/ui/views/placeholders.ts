import { h } from "../dom.ts";

export function renderPlaceholder(title: string, phase: string, blurb: string): HTMLElement {
  return h(
    "div",
    {},
    h("h2", {}, title),
    h(
      "div",
      { class: "panel" },
      h("p", { class: "dim" }, h("strong", {}, phase + ":"), " " + blurb),
    ),
  );
}
