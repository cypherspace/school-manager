import { h } from "../dom.ts";
import { store } from "../store.ts";
import { autosave } from "../../sim/save.ts";

export function renderRules(): HTMLElement {
  const s = store.require();
  const r = s.interruption;

  function row(
    label: string,
    key: "pauseOnCritical" | "pauseOnSerious" | "pauseOnRoutine" | "pauseOnReportingPoint" | "pauseOnTermBoundary",
    desc: string,
  ): HTMLElement {
    return h(
      "label",
      { style: { display: "block", margin: "6px 0" } },
      h("input", {
        type: "checkbox",
        checked: r[key],
        onchange: (e: Event) => {
          r[key] = (e.target as HTMLInputElement).checked;
          autosave(s);
          store.emit();
        },
      }),
      " ",
      h("strong", {}, label),
      " — ",
      h("span", { class: "dim" }, desc),
    );
  }

  const inboxRow = h(
    "label",
    { style: { display: "block", margin: "6px 0" } },
    h("strong", {}, "Pause when inbox reaches "),
    h("input", {
      type: "number",
      min: "1",
      max: "200",
      value: r.pauseOnInboxSize,
      style: { width: "60px" },
      onchange: (e: Event) => {
        const n = Number((e.target as HTMLInputElement).value);
        r.pauseOnInboxSize = Math.max(1, Math.min(200, n));
        autosave(s);
        store.emit();
      },
    }),
    " items",
  );

  return h(
    "div",
    {},
    h("h2", {}, "Interruption rules"),
    h(
      "p",
      { class: "dim" },
      'These rules decide when "Continue" stops running. Tune them to match your tolerance for being interrupted.',
    ),
    h(
      "div",
      { class: "panel" },
      row("Critical incidents", "pauseOnCritical", "safeguarding, allegations, inspector contact"),
      row("Serious incidents", "pauseOnSerious", "fights, press contact, senior resignation"),
      row("Routine incidents", "pauseOnRoutine", "behaviour referrals, parent complaints, sickness"),
      row("Reporting points", "pauseOnReportingPoint", "termly data drops — three per year"),
      row("Term boundaries", "pauseOnTermBoundary", "end of each term"),
      inboxRow,
    ),
    h(
      "div",
      { class: "panel" },
      h("h3", {}, "Ironman"),
      s.ironman
        ? h("p", {}, "Active. One save. Decisions stick.")
        : h("p", {}, "Off. Standard mode — you can save and reload freely."),
    ),
  );
}
