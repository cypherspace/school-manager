import { h } from "../dom.ts";
import { store } from "../store.ts";
import { advanceToNextYear } from "../../sim/engine.ts";
import { autosave } from "../../sim/save.ts";
import { YEAR_GROUPS, type AllocationDecider } from "../../sim/types.ts";
import { tabState } from "../tabs.ts";

export function renderResults(): HTMLElement {
  const s = store.require();
  if (s.results.length === 0) {
    return h(
      "div",
      {},
      h("h2", {}, "Results"),
      h("p", { class: "muted" }, "No results yet. Get through a full year."),
    );
  }

  const r = s.results[s.results.length - 1]!;
  const subjRows = (Object.keys(r.perSubjectAverage) as Array<keyof typeof r.perSubjectAverage>)
    .map((k) =>
      h(
        "tr",
        {},
        h("td", {}, String(k)),
        h("td", { class: "numeric" }, r.perSubjectAverage[k].toFixed(1) + "%"),
      ),
    );
  const yearRows = YEAR_GROUPS.map((k) =>
    h(
      "tr",
      {},
      h("td", {}, "Year " + String(k)),
      h("td", { class: "numeric" }, r.perYearAverage[k].toFixed(1) + "%"),
    ),
  );

  const topNames = r.topPerformers
    .map((id) => s.pupils[id])
    .filter((p) => p != null)
    .map((p) => `${p!.givenName} ${p!.surname} (${p!.formGroup})`);
  const concernNames = r.concernPupils
    .map((id) => s.pupils[id])
    .filter((p) => p != null)
    .map((p) => `${p!.givenName} ${p!.surname} (${p!.formGroup})`);

  const banner = h(
    "div",
    { class: "banner" },
    h("strong", {}, `Results day — ${r.schoolYearLabel}.`),
    " ",
    "Overall average: ",
    h("strong", {}, r.overallAverage.toFixed(1) + "%"),
    ". Y11 pass rate: ",
    h("strong", {}, r.passRate.toFixed(1) + "%"),
    ". Inspection drift: ",
    h(
      "strong",
      {},
      (r.inspectionGradeImpact >= 0 ? "+" : "") + r.inspectionGradeImpact,
    ),
    ". Budget delta: £",
    h("strong", {}, r.budgetDelta.toLocaleString()),
    ".",
  );

  const nextChoice = s.school?.allocationDelegation.nextYear ?? "deputy";
  const setNext = (v: AllocationDecider): void => {
    if (s.school) s.school.allocationDelegation.nextYear = v;
    autosave(s);
    store.emit();
  };
  const allocationPanel = h(
    "div",
    { class: "panel" },
    h("h3", {}, "Next year — class allocation"),
    h(
      "p",
      { class: "dim" },
      "Who decides which pupils land in which set? You can change your mind any time before rollover.",
    ),
    h(
      "label",
      { style: { display: "block", margin: "4px 0" } },
      h("input", {
        type: "radio",
        name: "alloc-next",
        checked: nextChoice === "deputy",
        onchange: () => setNext("deputy"),
      }),
      " ",
      h("strong", {}, "Delegate to deputy"),
      h(
        "span",
        { class: "dim" },
        " — pupils are streamed/grouped automatically using the current setting policy.",
      ),
    ),
    h(
      "label",
      { style: { display: "block", margin: "4px 0" } },
      h("input", {
        type: "radio",
        name: "alloc-next",
        checked: nextChoice === "head",
        onchange: () => setNext("head"),
      }),
      " ",
      h("strong", {}, "I'll set them myself"),
      h(
        "span",
        { class: "dim" },
        " — empty sets will be created and the Sets view will open in edit mode.",
      ),
    ),
  );

  const rollover = h(
    "div",
    { style: { marginTop: "12px" } },
    h(
      "button",
      {
        class: "primary",
        onclick: () => {
          const wantsManual =
            s.school?.allocationDelegation.nextYear === "head";
          advanceToNextYear(s);
          autosave(s);
          if (wantsManual) {
            // Land the player straight in Sets so they can place pupils.
            tabState.top = "timetable";
            tabState.sub.timetable = "sets";
          }
          store.emit();
        },
      },
      "Advance to next school year",
    ),
  );

  return h(
    "div",
    {},
    h("h2", {}, `Results — ${r.schoolYearLabel}`),
    banner,
    h(
      "div",
      { class: "grid-2" },
      h(
        "div",
        { class: "panel" },
        h("h3", {}, "By subject"),
        h(
          "table",
          {},
          h("thead", {}, h("tr", {}, h("th", {}, "Subject"), h("th", { class: "numeric" }, "Avg"))),
          h("tbody", {}, ...subjRows),
        ),
      ),
      h(
        "div",
        { class: "panel" },
        h("h3", {}, "By year group"),
        h(
          "table",
          {},
          h("thead", {}, h("tr", {}, h("th", {}, "Year"), h("th", { class: "numeric" }, "Avg"))),
          h("tbody", {}, ...yearRows),
        ),
      ),
    ),
    h(
      "div",
      { class: "panel" },
      h("h3", {}, "Notes"),
      h("ul", {}, ...r.notes.map((n) => h("li", {}, n))),
    ),
    h(
      "div",
      { class: "grid-2" },
      h(
        "div",
        { class: "panel" },
        h("h3", {}, "Top performers"),
        h("ol", {}, ...topNames.map((n) => h("li", {}, n))),
      ),
      h(
        "div",
        { class: "panel" },
        h("h3", {}, "Concern list"),
        h("ol", {}, ...concernNames.map((n) => h("li", {}, n))),
      ),
    ),
    allocationPanel,
    rollover,
  );
}
