import { h, bar } from "../dom.ts";
import { store } from "../store.ts";
import { dayInfo, formatDate } from "../../sim/calendar.ts";

export function renderDashboard(): HTMLElement {
  const s = store.require();
  const info = dayInfo(s.schoolYearStart, s.dayIndex);

  const repPanel = h(
    "div",
    { class: "panel" },
    h("h2", {}, "Reputation"),
    repRow("Discipline", s.school.reputation.discipline),
    repRow("Pastoral", s.school.reputation.pastoral),
    repRow("Parent relations", s.school.reputation.parentRelations),
    repRow("Staff morale", s.school.reputation.staffMorale),
    repRow("Governor relations", s.school.reputation.governorRelations),
  );

  const schoolPanel = h(
    "div",
    { class: "panel" },
    h("h2", {}, s.school.name),
    kv("Town", s.school.town),
    kv("Type", titleCase(s.school.type)),
    kv("Pupils", String(s.school.pupilIds.length)),
    kv("Staff", String(s.school.staffIds.length)),
    kv("Capacity", String(s.school.capacity)),
    kv("Last inspection grade", s.school.inspectionGrade),
    kv("Years since inspection", String(s.school.yearsInspected)),
  );

  const moneyPanel = h(
    "div",
    { class: "panel" },
    h("h2", {}, "Money & calendar"),
    kv("Reserves", "£" + s.school.reserves.toLocaleString()),
    kv("Annual budget", "£" + s.school.annualBudget.toLocaleString()),
    kv("Date", formatDate(info.date)),
    kv("Term", info.inTerm ? `${info.termLabel} — half-term ${info.halfTerm}` : "Holiday / weekend"),
    kv("School year", info.schoolYearLabel),
    kv("Inbox", String(s.inbox.length)),
  );

  const headPanel = h(
    "div",
    { class: "panel" },
    h("h2", {}, "Headteacher"),
    kv("Name", `${s.headteacher.givenName} ${s.headteacher.surname}`),
    kv("Age", String(s.headteacher.age)),
    kv("Years as head", String(s.headteacher.yearsAsHead)),
    kv("Public reputation", String(s.headteacher.reputationPublic)),
    kv("Private reputation", String(s.headteacher.reputationPrivate)),
    s.ironman ? kv("Mode", "Ironman") : kv("Mode", "Standard"),
  );

  const recent = s.history.slice(-10).reverse();
  const historyPanel = h(
    "div",
    { class: "panel" },
    h("h2", {}, "Recent activity"),
    recent.length === 0
      ? h("p", { class: "muted" }, "Nothing yet. Press Continue.")
      : h(
          "div",
          { class: "history" },
          ...recent.map((e) =>
            h(
              "div",
              {},
              h("span", { class: "day" }, e.date + ":"),
              h("span", {}, e.text),
            ),
          ),
        ),
  );

  return h(
    "div",
    {},
    h(
      "div",
      { class: "grid" },
      schoolPanel,
      moneyPanel,
      headPanel,
    ),
    h("div", { class: "grid-2" }, repPanel, historyPanel),
  );
}

function repRow(label: string, value: number): HTMLElement {
  return h(
    "div",
    { style: { marginBottom: "6px" } },
    h(
      "div",
      { class: "kv" },
      h("span", { class: "k" }, label),
      h("span", { class: "v" }, String(Math.round(value))),
    ),
    bar(value),
  );
}

function kv(k: string, v: string): HTMLElement {
  return h(
    "div",
    { class: "kv" },
    h("span", { class: "k" }, k),
    h("span", { class: "v" }, v),
  );
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
