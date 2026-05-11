import { h } from "../dom.ts";
import { store } from "../store.ts";
import type { Staff, StaffRole } from "../../sim/types.ts";

interface StaffFilters {
  search: string;
  role: StaffRole | "";
  sortBy: "name" | "role" | "age" | "morale" | "performance";
  desc: boolean;
}

const filters: StaffFilters = {
  search: "",
  role: "",
  sortBy: "role",
  desc: false,
};

export function renderStaff(): HTMLElement {
  const s = store.require();
  const all = Object.values(s.staff);
  const view = applyFilters(all);

  const controls = h(
    "div",
    { class: "controls", style: { marginBottom: "8px" } },
    h("input", {
      type: "search",
      placeholder: "Search name / subject",
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
          filters.role = (e.target as HTMLSelectElement).value as StaffRole | "";
          store.emit();
        },
      },
      h("option", { value: "" }, "All roles"),
      h("option", { value: "Senior Leader" }, "Senior Leader"),
      h("option", { value: "Head of Department" }, "Head of Department"),
      h("option", { value: "Teacher" }, "Teacher"),
      h("option", { value: "Teaching Assistant" }, "TA"),
      h("option", { value: "Pastoral" }, "Pastoral"),
    ),
    h("span", { class: "dim" }, `${view.length} / ${all.length} staff`),
  );

  const headers: Array<[StaffFilters["sortBy"], string]> = [
    ["name", "Name"],
    ["role", "Role"],
    ["age", "Age"],
    ["morale", "Morale"],
    ["performance", "Perf"],
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
                  filters.desc = key !== "name" && key !== "role";
                }
                store.emit();
              },
            },
            label + (filters.sortBy === key ? (filters.desc ? " ↓" : " ↑") : ""),
          ),
        ),
        h("th", {}, "Subject"),
        h("th", {}, "Archetype"),
        h("th", {}, "Salary"),
      ),
    ),
    h(
      "tbody",
      {},
      ...view.slice(0, 200).map((m) => renderRow(m)),
    ),
  );

  return h(
    "div",
    {},
    h("h2", {}, "Staff"),
    controls,
    h("div", { class: "scroll" }, table),
  );
}

function renderRow(m: Staff): HTMLElement {
  return h(
    "tr",
    {},
    h(
      "td",
      {},
      `${m.givenName} ${m.surname}`,
      m.flagged ? " " : null,
      m.flagged ? h("span", { class: "tag flag" }, "FLAG") : null,
    ),
    h("td", {}, m.role),
    h("td", { class: "numeric" }, String(m.age)),
    h("td", { class: "numeric" }, String(m.morale)),
    h("td", { class: "numeric" }, String(m.performanceRating)),
    h("td", {}, m.subject ?? "—"),
    h("td", { class: "dim" }, m.archetype),
    h("td", { class: "numeric" }, "£" + m.salary.toLocaleString()),
  );
}

function applyFilters(all: Staff[]): Staff[] {
  let v = all;
  const q = filters.search.trim().toLowerCase();
  if (q) {
    v = v.filter(
      (m) =>
        m.givenName.toLowerCase().includes(q) ||
        m.surname.toLowerCase().includes(q) ||
        (m.subject ?? "").toLowerCase().includes(q) ||
        m.archetype.toLowerCase().includes(q),
    );
  }
  if (filters.role) v = v.filter((m) => m.role === filters.role);
  v = v.slice().sort((a, b) => {
    let aa = 0;
    let bb = 0;
    switch (filters.sortBy) {
      case "name":
        return cmpString(a.surname + a.givenName, b.surname + b.givenName, filters.desc);
      case "role":
        return cmpString(a.role, b.role, filters.desc) ||
          cmpString(a.surname, b.surname, false);
      case "age":
        aa = a.age;
        bb = b.age;
        break;
      case "morale":
        aa = a.morale;
        bb = b.morale;
        break;
      case "performance":
        aa = a.performanceRating;
        bb = b.performanceRating;
        break;
    }
    return filters.desc ? bb - aa : aa - bb;
  });
  return v;
}

function cmpString(a: string, b: string, desc: boolean): number {
  const r = a.localeCompare(b);
  return desc ? -r : r;
}
