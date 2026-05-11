import { h } from "../../dom.ts";
import { store } from "../../store.ts";
import { formerSchoolFocus } from "./cv.ts";

export function renderFormerSchool(): HTMLElement {
  const s = store.require();
  if (!formerSchoolFocus.id) {
    return h(
      "div",
      {},
      h("h2", {}, "Former school"),
      h("p", { class: "muted" }, "Click a row on the CV tab to peek at how a former school is getting on."),
    );
  }
  const school = s.formerSchools[formerSchoolFocus.id];
  if (!school) {
    return h(
      "div",
      {},
      h("h2", {}, "Former school"),
      h("p", { class: "muted" }, "No archived record for that posting."),
    );
  }
  const pupilCount = school.pupilIds.length;
  const staffCount = school.staffIds.length;
  return h(
    "div",
    {},
    h("h2", {}, school.name),
    h(
      "p",
      { class: "dim" },
      `${school.town} · ${school.type} · ${school.archetype} · ${school.inspectionGrade}`,
    ),
    h(
      "div",
      { class: "panel" },
      h("h3", {}, "Snapshot today"),
      kv("Pupils on roll", String(pupilCount)),
      kv("Staff", String(staffCount)),
      kv("Reserves", "£" + school.reserves.toLocaleString()),
      kv("Maintenance backlog", `${school.maintenanceBacklog}/100`),
      kv("Last inspection grade", school.inspectionGrade),
    ),
    h(
      "p",
      { class: "dim", style: { fontSize: "12px" } },
      "The world has continued without you. Pupils have moved up, leavers have left, staff have aged or moved on. Numbers reflect a yearly tick — not a live sim.",
    ),
  );
}

function kv(k: string, v: string): HTMLElement {
  return h("div", { class: "kv" }, h("span", { class: "k" }, k), h("span", { class: "v" }, v));
}
