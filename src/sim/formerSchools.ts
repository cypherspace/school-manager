// Tick archived schools forward one year so the world doesn't freeze on the
// day the player leaves. Y11 graduate, a new Y7 cohort arrives, staff age
// (with light attrition), and the school's grade drifts based on a derived
// "absent head" multiplier.
//
// The full sim does not run for archived schools — we deliberately keep this
// cheap so save sizes stay bounded.

import { RNG } from "./rng.ts";
import { CONFIG } from "./config.ts";
import {
  assignPupilsToGroupsForYear,
  assignTeachersToGroups,
  generatePupil,
  generateStaff,
} from "./generators.ts";
import {
  ALL_SUBJECTS,
  YEAR_GROUPS,
  type GameState,
  type ID,
  type Pupil,
  type School,
  type Staff,
} from "./types.ts";

export function tickFormerSchool(state: GameState, formerSchoolId: ID): void {
  const school = state.formerSchools[formerSchoolId];
  if (!school) return;
  const rng = new RNG(`${state.seedLabel}:former:${formerSchoolId}:${state.schoolYearStart}`);

  if (!school.pupilsBag) school.pupilsBag = {};
  if (!school.staffBag) school.staffBag = {};
  const pupils = school.pupilsBag;
  const staffBag = school.staffBag;

  // Memorable-pupil capture before pupils get pruned.
  capturePromotableMemorable(state, school);

  // Cohort progression: Y11 leaves, others bump up.
  const survivingIds: ID[] = [];
  for (const pid of school.pupilIds) {
    const pp = pupils[pid];
    if (!pp) continue;
    if (pp.yearGroup === 11) {
      delete pupils[pid];
      continue;
    }
    pp.yearGroup = (pp.yearGroup + 1) as 8 | 9 | 10 | 11;
    pp.incidentsThisYear = 0;
    pp.behaviourPoints = 0;
    pp.flagged = false;
    pp.notes = [];
    pp.groupBySubject = {};
    survivingIds.push(pid);
  }

  // New Y7 intake (60% of normal cohort size to keep memory low for archived).
  const target = Math.max(40, Math.floor((school.capacity / 5) * 0.6));
  for (let i = 0; i < target; i++) {
    const p = generatePupil(rng, 7, state.schoolYearStart + 1);
    pupils[p.id] = p;
    survivingIds.push(p.id);
  }
  school.pupilIds = survivingIds;

  // Age staff and apply light attrition.
  school.staffIds = school.staffIds.filter((id) => staffBag[id] != null);
  const departing: ID[] = [];
  for (const id of school.staffIds) {
    const s = staffBag[id];
    if (!s) continue;
    s.age += 1;
    s.yearsAtSchool += 1;
    s.yearsInProfession += 1;
    if (s.age >= 67 || rng.chance(0.04)) departing.push(id);
  }
  for (const id of departing) {
    delete staffBag[id];
    school.staffIds = school.staffIds.filter((x) => x !== id);
  }
  const replacements = Math.min(departing.length, 3);
  for (let i = 0; i < replacements; i++) {
    const subj = ALL_SUBJECTS[i % ALL_SUBJECTS.length]!;
    const s = generateStaff(rng, "Teacher", subj);
    staffBag[s.id] = s;
    school.staffIds.push(s.id);
  }

  // Drift grade based on archetype — schools with high reputation hold up;
  // struggling schools tend to slide a touch.
  if (rng.chance(0.2)) {
    const ladder = ["Inadequate", "Requires Improvement", "Good", "Outstanding"] as const;
    let idx = ladder.indexOf(school.inspectionGrade);
    const bias =
      school.archetype === "struggling-academy"
        ? -0.6
        : school.archetype === "elite-selective"
        ? 0.4
        : 0;
    const dir = rng.next() < 0.5 + bias / 2 ? 1 : -1;
    idx = Math.max(0, Math.min(3, idx + dir));
    school.inspectionGrade = ladder[idx]!;
  }
  school.maintenanceBacklog = Math.min(100, school.maintenanceBacklog + 3);
}

function capturePromotableMemorable(state: GameState, school: School): void {
  const pupils = school.pupilsBag;
  if (!pupils) return;
  for (const pid of school.pupilIds) {
    const pp = pupils[pid];
    if (!pp) continue;
    if (pp.yearGroup !== 11) continue;
    const memorable =
      pp.flagged ||
      pp.notes.length >= 3 ||
      pp.incidentsThisYear >= CONFIG.memorablePupilIncidentThreshold;
    if (!memorable) continue;
    if (state.sector.memorablePupils[pid]) continue;
    state.sector.memorablePupils[pid] = {
      id: pid,
      givenName: pp.givenName,
      surname: pp.surname,
      schoolId: school.id,
      schoolName: school.name,
      yearGroupAtFlag: pp.yearGroup,
      schoolYearStart: state.schoolYearStart,
      reason: pp.flagged ? "Flagged by head" : "High-incident pupil",
      notes: [...pp.notes],
    };
  }
  const all = Object.values(state.sector.memorablePupils);
  if (all.length > 200) {
    const sorted = all.sort((a, b) => a.schoolYearStart - b.schoolYearStart);
    for (let i = 0; i < sorted.length - 200; i++) {
      delete state.sector.memorablePupils[sorted[i]!.id];
    }
  }
}

// When the player arrives at (or returns to) a school, copy the school's
// archived bags into the live state dictionaries so the engine works over
// its flat top-level pupils/staff/groups records.
export function hydrateLiveSchoolFromBag(state: GameState, school: School): void {
  state.pupils = school.pupilsBag ? { ...school.pupilsBag } : {};
  state.staff = school.staffBag ? { ...school.staffBag } : {};
  state.groups = {};
  const rng = new RNG(`${state.seedLabel}:hydrate:${school.id}:${state.schoolYearStart}`);
  for (const yg of YEAR_GROUPS) {
    assignPupilsToGroupsForYear(rng, state, yg, true);
  }
  assignTeachersToGroups(state);
}

// Snapshot live dictionaries back into the school's bags before archiving.
export function persistLiveSchoolToBag(state: GameState): void {
  if (!state.school) return;
  state.school.pupilsBag = { ...state.pupils } as Record<ID, Pupil>;
  state.school.staffBag = { ...state.staff } as Record<ID, Staff>;
}
