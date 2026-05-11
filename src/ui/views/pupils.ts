import { h } from "../dom.ts";
import { store } from "../store.ts";
import {
  ALL_SUBJECTS,
  type Pupil,
  type Subject,
  type YearGroup,
} from "../../sim/types.ts";

interface PupilFilters {
  search: string;
  yearGroup: "" | YearGroup;
  flaggedOnly: boolean;
  sortBy: "name" | "year" | "average" | "behaviour" | "attendance";
  desc: boolean;
  selectedId: string | null;
}

const filters: PupilFilters = {
  search: "",
  yearGroup: "",
  flaggedOnly: false,
  sortBy: "year",
  desc: false,
  selectedId: null,
};

export function renderPupils(): HTMLElement {
  const s = store.require();
  const all = Object.values(s.pupils);
  const view = applyFilters(all);

  const controls = h(
    "div",
    { class: "controls", style: { marginBottom: "8px" } },
    h("input", {
      type: "search",
      placeholder: "Search name / form",
      value: filters.search,
      oninput: (e: Event) => {
        filters.search = (e.target as HTMLInputElement).value;
        store.emit();
      },
    }),
    h(
      "select",
      {
        onchange: (e: Event) => {
          const v = (e.target as HTMLSelectElement).value;
          filters.yearGroup = v === "" ? "" : (Number(v) as YearGroup);
          store.emit();
        },
      },
      h("option", { value: "" }, "All years"),
      h("option", { value: "7", selected: filters.yearGroup === 7 }, "Year 7"),
      h("option", { value: "8", selected: filters.yearGroup === 8 }, "Year 8"),
      h("option", { value: "9", selected: filters.yearGroup === 9 }, "Year 9"),
      h("option", { value: "10", selected: filters.yearGroup === 10 }, "Year 10"),
      h("option", { value: "11", selected: filters.yearGroup === 11 }, "Year 11"),
    ),
    h(
      "label",
      { style: { display: "flex", alignItems: "center", gap: "4px" } },
      h("input", {
        type: "checkbox",
        checked: filters.flaggedOnly,
        onchange: (e: Event) => {
          filters.flaggedOnly = (e.target as HTMLInputElement).checked;
          store.emit();
        },
      }),
      "Flagged only",
    ),
    h("span", { class: "dim" }, `${view.length} / ${all.length} pupils`),
  );

  const headers: Array<[PupilFilters["sortBy"], string]> = [
    ["name", "Name"],
    ["year", "Yr"],
    ["average", "Avg %"],
    ["behaviour", "Behav."],
    ["attendance", "Att. %"],
  ];

  const table = h(
    "table",
    {},
    h(
      "thead",
      {},
      h(
        "tr",
        {},
        ...headers.map(([key, label]) =>
          h(
            "th",
            {
              style: { cursor: "pointer" },
              onclick: () => {
                if (filters.sortBy === key) filters.desc = !filters.desc;
                else {
                  filters.sortBy = key;
                  filters.desc = key !== "name";
                }
                store.emit();
              },
            },
            label + (filters.sortBy === key ? (filters.desc ? " ↓" : " ↑") : ""),
          ),
        ),
        h("th", {}, "Form"),
        h("th", {}, "Flags"),
        h("th", {}, "Notes"),
      ),
    ),
    h(
      "tbody",
      {},
      ...view.slice(0, 400).map((p) => renderRow(p)),
    ),
  );

  const selected = filters.selectedId ? s.pupils[filters.selectedId] : null;
  const drillDown = selected ? renderDrillDown(selected) : null;

  return h(
    "div",
    {},
    h("h2", {}, "Pupils"),
    controls,
    h("div", { class: "scroll" }, table),
    view.length > 400 ? h("p", { class: "dim" }, `Showing first 400 of ${view.length}. Refine your filter.`) : null,
    drillDown,
  );
}

function renderRow(p: Pupil): HTMLElement {
  const avg = mean(Object.values(p.attainment));
  const flags: HTMLElement[] = [];
  if (p.flagged) flags.push(h("span", { class: "tag flag" }, "FLAG"));
  if (p.send) flags.push(h("span", { class: "tag" }, "SEND"));
  if (p.eal) flags.push(h("span", { class: "tag" }, "EAL"));
  if (p.premiumEligible) flags.push(h("span", { class: "tag" }, "PP"));
  const selected = filters.selectedId === p.id;
  return h(
    "tr",
    {
      class: "pupil-row" + (selected ? " selected" : ""),
      onclick: () => {
        filters.selectedId = selected ? null : p.id;
        store.emit();
      },
    },
    h("td", {}, `${p.givenName} ${p.surname}`),
    h("td", { class: "numeric" }, String(p.yearGroup)),
    h("td", { class: "numeric" }, avg.toFixed(1)),
    h("td", { class: "numeric" }, p.behaviourPropensity.toFixed(0)),
    h("td", { class: "numeric" }, p.attendancePct.toFixed(0)),
    h("td", {}, p.formGroup),
    h("td", {}, ...flags),
    h("td", { class: "dim" }, p.notes.slice(-1)[0] ?? ""),
  );
}

function renderDrillDown(p: Pupil): HTMLElement {
  const s = store.require();
  const rows = ALL_SUBJECTS.map((subj) => {
    const gid = p.groupBySubject[subj];
    const group = gid ? s.groups[gid] : null;
    const teacher =
      group && group.teacherIds[0] ? s.staff[group.teacherIds[0]] : null;
    const groupLabel = group
      ? `${group.isSetted ? "Set" : "Group"} ${group.setNumber}`
      : "—";
    const teacherLabel = teacher
      ? `${teacher.givenName} ${teacher.surname}`
      : "—";
    return h(
      "tr",
      {},
      h("td", {}, subj),
      h("td", { class: "numeric" }, String(p.ability[subj])),
      h("td", { class: "numeric" }, String(p.attainment[subj])),
      h("td", {}, groupLabel),
      h("td", {}, teacherLabel),
      h("td", {}, sparkline(p, subj)),
    );
  });

  const notesBlock =
    p.notes.length === 0
      ? h("p", { class: "muted" }, "No notes yet.")
      : h("ul", {}, ...p.notes.map((n) => h("li", {}, n)));

  return h(
    "div",
    { class: "panel pupil-detail" },
    h(
      "h3",
      {},
      `${p.givenName} ${p.surname} (${p.formGroup})`,
      h(
        "button",
        {
          style: { marginLeft: "12px" },
          onclick: () => {
            filters.selectedId = null;
            store.emit();
          },
        },
        "Close",
      ),
    ),
    h(
      "p",
      { class: "dim" },
      `Year ${p.yearGroup} · Attendance ${p.attendancePct.toFixed(0)}% · Engagement ${p.engagement.toFixed(0)} · Wellbeing ${p.wellbeing.toFixed(0)}`,
    ),
    h(
      "table",
      {},
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          h("th", {}, "Subject"),
          h("th", { class: "numeric" }, "Ab."),
          h("th", { class: "numeric" }, "Att."),
          h("th", {}, "Group"),
          h("th", {}, "Teacher"),
          h("th", {}, "Trajectory"),
        ),
      ),
      h("tbody", {}, ...rows),
    ),
    h("h4", {}, "Notes"),
    notesBlock,
  );
}

// Tiny inline-SVG sparkline of a pupil's per-subject progress history.
// Plots [1, 99] vs the last N reporting points; baseline at 50.
function sparkline(p: Pupil, subject: Subject): HTMLElement {
  const values = p.progressHistory.map((snap) => snap.perSubject[subject] ?? 0);
  if (values.length < 2) {
    return h("span", { class: "dim" }, values.length === 1 ? "—" : "no data");
  }
  const width = 80;
  const height = 20;
  const minV = 0;
  const maxV = 100;
  const xStep = width / (values.length - 1);
  const pts = values
    .map((v, i) => {
      const x = i * xStep;
      const y = height - ((v - minV) / (maxV - minV)) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const baseY = height - ((50 - minV) / (maxV - minV)) * height;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <line x1="0" y1="${baseY}" x2="${width}" y2="${baseY}" stroke="#cdc7b6" stroke-width="0.5"/>
      <polyline points="${pts}" fill="none" stroke="#5c3a21" stroke-width="1.4"/>
    </svg>`;
  return h("span", { class: "sparkline", html: svg });
}


function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function applyFilters(all: Pupil[]): Pupil[] {
  let v = all;
  const q = filters.search.trim().toLowerCase();
  if (q) {
    v = v.filter(
      (p) =>
        p.givenName.toLowerCase().includes(q) ||
        p.surname.toLowerCase().includes(q) ||
        p.formGroup.toLowerCase().includes(q),
    );
  }
  if (filters.yearGroup !== "") {
    v = v.filter((p) => p.yearGroup === filters.yearGroup);
  }
  if (filters.flaggedOnly) {
    v = v.filter((p) => p.flagged);
  }
  v = v.slice().sort((a, b) => {
    let aa = 0;
    let bb = 0;
    switch (filters.sortBy) {
      case "name":
        return cmpString(a.surname + a.givenName, b.surname + b.givenName, filters.desc);
      case "year":
        aa = a.yearGroup;
        bb = b.yearGroup;
        break;
      case "average":
        aa = mean(Object.values(a.attainment));
        bb = mean(Object.values(b.attainment));
        break;
      case "behaviour":
        aa = a.behaviourPropensity;
        bb = b.behaviourPropensity;
        break;
      case "attendance":
        aa = a.attendancePct;
        bb = b.attendancePct;
        break;
    }
    return filters.desc ? bb - aa : aa - bb;
  });
  void ALL_SUBJECTS;
  return v;
}

function cmpString(a: string, b: string, desc: boolean): number {
  const r = a.localeCompare(b);
  return desc ? -r : r;
}
