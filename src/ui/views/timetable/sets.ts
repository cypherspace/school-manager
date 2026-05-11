import { h } from "../../dom.ts";
import { store } from "../../store.ts";
import { autosave } from "../../../sim/save.ts";
import {
  ALL_SUBJECTS,
  YEAR_GROUPS,
  type ID,
  type Pupil,
  type Subject,
  type TeachingGroup,
  type YearGroup,
} from "../../../sim/types.ts";

interface SetsViewState {
  subject: Subject;
  year: YearGroup;
}

const view: SetsViewState = {
  subject: "Mathematics",
  year: 9,
};

export function renderSets(): HTMLElement {
  const s = store.require();

  const policy = s.school.settingPolicy[view.subject];
  const policySummary = policy.isSetted
    ? `Setted from Y${policy.introducedFromYear}`
    : "Mixed-ability";

  const subjectChips = h(
    "div",
    { class: "chips" },
    ...ALL_SUBJECTS.map((sub) =>
      h(
        "button",
        {
          class: "chip" + (view.subject === sub ? " active" : ""),
          onclick: () => {
            view.subject = sub;
            store.emit();
          },
        },
        sub,
      ),
    ),
  );

  const yearChips = h(
    "div",
    { class: "chips" },
    ...YEAR_GROUPS.map((y) =>
      h(
        "button",
        {
          class: "chip" + (view.year === y ? " active" : ""),
          onclick: () => {
            view.year = y;
            store.emit();
          },
        },
        "Y" + y,
      ),
    ),
  );

  const groupsForView = Object.values(s.groups)
    .filter((g) => g.subject === view.subject && g.yearGroup === view.year)
    .sort((a, b) => a.setNumber - b.setNumber);

  const delegationBanner = s.school.allocationDelegation.thisYear === "head"
    ? h(
        "div",
        { class: "banner" },
        h("strong", {}, "Manual allocation: "),
        "You opted to set classes yourself this year. ",
        "Click any pupil row to move them between sets; teacher rows to reassign.",
      )
    : null;

  return h(
    "div",
    {},
    h("h2", {}, "Timetable — Sets"),
    h(
      "p",
      { class: "dim" },
      `${view.subject} · Y${view.year} · `,
      h("strong", {}, policySummary),
      policy.isSetted &&
        policy.introducedFromYear != null &&
        view.year < policy.introducedFromYear
        ? ` (this year still mixed-ability — setting starts Y${policy.introducedFromYear})`
        : "",
    ),
    delegationBanner,
    h("div", { class: "panel" }, h("div", { class: "kv" }, h("span", { class: "k" }, "Subject")), subjectChips),
    h("div", { class: "panel" }, h("div", { class: "kv" }, h("span", { class: "k" }, "Year")), yearChips),
    groupsForView.length === 0
      ? h("p", { class: "muted" }, "No groups for this subject/year. Run rollover to rebuild.")
      : h(
          "div",
          { class: "sets-grid" },
          ...groupsForView.map((g) => renderGroupPanel(g, groupsForView)),
        ),
  );
}

function renderGroupPanel(g: TeachingGroup, siblings: TeachingGroup[]): HTMLElement {
  const s = store.require();
  const pupils = g.pupilIds
    .map((id) => s.pupils[id])
    .filter((p): p is Pupil => p != null);
  const meanAbility =
    pupils.length === 0
      ? 0
      : pupils.reduce((sum, p) => sum + p.ability[g.subject], 0) / pupils.length;
  const meanAttainment =
    pupils.length === 0
      ? 0
      : pupils.reduce((sum, p) => sum + p.attainment[g.subject], 0) / pupils.length;

  const teacher = g.teacherIds[0] ? s.staff[g.teacherIds[0]] : null;
  const teacherLabel = teacher
    ? `${teacher.givenName} ${teacher.surname}${teacher.role === "Head of Department" ? " (HoD)" : ""}`
    : "— unassigned —";

  const label = g.isSetted ? `Set ${g.setNumber}` : `Group ${g.setNumber}`;

  return h(
    "div",
    { class: "panel set-panel" },
    h(
      "div",
      { class: "set-head" },
      h("h3", {}, label),
      h("span", { class: "dim" }, `${pupils.length} pupils`),
    ),
    h(
      "button",
      {
        class: "teacher-row",
        onclick: () => pickTeacher(g),
        title: "Click to reassign teacher",
      },
      h("span", { class: "dim" }, "Teacher: "),
      teacherLabel,
    ),
    h(
      "div",
      { class: "set-stats" },
      h("span", { class: "dim" }, "Ability "),
      h("strong", {}, meanAbility.toFixed(0)),
      h("span", { class: "dim" }, "  ·  Attainment "),
      h("strong", {}, meanAttainment.toFixed(0)),
    ),
    h(
      "div",
      { class: "scroll set-pupils" },
      h(
        "table",
        {},
        h(
          "thead",
          {},
          h(
            "tr",
            {},
            h("th", {}, "Name"),
            h("th", { class: "numeric" }, "Ab."),
            h("th", { class: "numeric" }, "Att."),
          ),
        ),
        h(
          "tbody",
          {},
          ...sortPupils(pupils, g.subject).map((p) => renderPupilRow(p, g, siblings)),
        ),
      ),
    ),
  );
}

function sortPupils(pupils: Pupil[], subject: Subject): Pupil[] {
  return [...pupils].sort((a, b) => b.ability[subject] - a.ability[subject]);
}

function renderPupilRow(
  p: Pupil,
  current: TeachingGroup,
  siblings: TeachingGroup[],
): HTMLElement {
  return h(
    "tr",
    {
      class: "pupil-row",
      onclick: () => movePupil(p, current, siblings),
      title: "Click to move to another set",
    },
    h("td", {}, `${p.givenName} ${p.surname}`),
    h("td", { class: "numeric" }, String(p.ability[current.subject])),
    h("td", { class: "numeric" }, String(p.attainment[current.subject])),
  );
}

function movePupil(p: Pupil, current: TeachingGroup, siblings: TeachingGroup[]): void {
  const options = siblings.filter((g) => g.id !== current.id);
  if (options.length === 0) return;
  const labelFor = (g: TeachingGroup): string =>
    `${g.isSetted ? "Set" : "Group"} ${g.setNumber} (${g.pupilIds.length})`;
  const choice = prompt(
    `Move ${p.givenName} ${p.surname} to which group?\n\n` +
      options.map((g, i) => `${i + 1}. ${labelFor(g)}`).join("\n"),
    "1",
  );
  if (!choice) return;
  const idx = Number(choice) - 1;
  const target = options[idx];
  if (!target) return;

  // Remove from current, add to target, update pupil pointer.
  current.pupilIds = current.pupilIds.filter((id) => id !== p.id);
  target.pupilIds.push(p.id);
  p.groupBySubject[current.subject] = target.id;

  const s = store.require();
  autosave(s);
  store.emit();
}

function pickTeacher(g: TeachingGroup): void {
  const s = store.require();
  const candidates = Object.values(s.staff)
    .filter(
      (t) =>
        t.subject === g.subject &&
        (t.role === "Teacher" || t.role === "Head of Department"),
    )
    .sort((a, b) => a.surname.localeCompare(b.surname));
  if (candidates.length === 0) {
    alert("No staff for this subject.");
    return;
  }
  const loadFor = (tid: ID): number => {
    let n = 0;
    for (const grp of Object.values(s.groups)) {
      if (grp.teacherIds.includes(tid)) n++;
    }
    return n;
  };
  const labelFor = (idx: number, t: typeof candidates[number]): string => {
    const role = t.role === "Head of Department" ? "HoD" : "T";
    return `${idx + 1}. ${t.givenName} ${t.surname} [${role}] · load ${loadFor(t.id)}`;
  };
  const choice = prompt(
    `Assign which teacher to ${g.subject} ${g.isSetted ? "Set" : "Group"} ${g.setNumber}?\n\n` +
      candidates.map((t, i) => labelFor(i, t)).join("\n") +
      "\n\nEnter 0 to clear.",
    "1",
  );
  if (choice == null) return;
  const idx = Number(choice);
  if (idx === 0) {
    g.teacherIds = [];
  } else {
    const target = candidates[idx - 1];
    if (!target) return;
    g.teacherIds = [target.id];
  }
  autosave(s);
  store.emit();
}
