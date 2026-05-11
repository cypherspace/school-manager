import { RNG } from "./rng.ts";
import {
  ALL_SUBJECTS,
  YEAR_GROUPS,
  type AllocationStyle,
  type GameState,
  type Headteacher,
  type ID,
  type Pupil,
  type ReputationAxes,
  type School,
  type SettingPolicy,
  type Staff,
  type StaffRole,
  type Subject,
  type TeachingGroup,
  type YearGroup,
} from "./types.ts";
import { firstName, schoolName, surname, townName } from "./names.ts";

let _idCounter = 0;
export function makeId(prefix: string, rng: RNG): ID {
  // Deterministic within a seeded generation pass: incorporate rng state and a
  // local counter so we don't collide across batches.
  _idCounter++;
  return `${prefix}_${rng.int(0, 0xffffff).toString(16)}${_idCounter.toString(36)}`;
}

export function resetIdCounter(): void {
  _idCounter = 0;
}

// -----------------------------------------------------------------------------
// Pupils
// -----------------------------------------------------------------------------

const PUPILS_PER_YEAR = 120;
const FORMS_PER_YEAR = 4; // A-D

export function generatePupil(rng: RNG, yearGroup: YearGroup, schoolYearStart: number): Pupil {
  const sex: "f" | "m" = rng.chance(0.5) ? "f" : "m";
  const given = firstName(rng, sex);
  const sur = surname(rng);
  const form = `${yearGroup}${String.fromCharCode(65 + rng.int(0, FORMS_PER_YEAR - 1))}`;

  // Age 11 in Y7, 15 in Y11 at start of academic year.
  const ageAtStart = 11 + (yearGroup - 7);
  const birthYear = schoolYearStart - ageAtStart;
  const birthMonth = rng.int(0, 11);
  const birthDay = rng.int(1, 28);
  const dob = new Date(Date.UTC(birthYear, birthMonth, birthDay)).toISOString().slice(0, 10);

  const send = rng.chance(0.15);
  const eal = rng.chance(0.12);
  const premiumEligible = rng.chance(0.22);

  // Prior attainment lightly nudged by background flags.
  let priorBase = rng.bounded(55, 18, 10, 98);
  if (send) priorBase -= 6;
  if (eal) priorBase -= 3;
  if (premiumEligible) priorBase -= 4;
  const priorAttainment = Math.round(Math.max(10, Math.min(98, priorBase)));

  // Per-subject ability is a perturbation of prior attainment.
  const ability = {} as Record<Subject, number>;
  const attainment = {} as Record<Subject, number>;
  for (const subj of ALL_SUBJECTS) {
    const a = Math.round(rng.bounded(priorAttainment, 12, 5, 99));
    ability[subj] = a;
    attainment[subj] = Math.round(rng.bounded(a - 5, 8, 1, 99));
  }

  const behaviourPropensity = Math.round(rng.bounded(35, 18, 0, 100));
  const attendancePct = Math.round(rng.bounded(94, 5, 60, 100));
  const engagement = Math.round(rng.bounded(60, 18, 0, 100));
  const wellbeing = Math.round(rng.bounded(70, 15, 5, 100));

  return {
    id: makeId("p", rng),
    givenName: given,
    surname: sur,
    sex,
    yearGroup,
    formGroup: form,
    dob,
    send,
    eal,
    premiumEligible,
    priorAttainment,
    ability,
    attainment,
    behaviourPropensity,
    behaviourPoints: 0,
    incidentsThisYear: 0,
    attendancePct,
    engagement,
    wellbeing,
    ambition: Math.round(rng.bounded(50, 22, 0, 100)),
    resilience: Math.round(rng.bounded(55, 20, 0, 100)),
    familySupport: Math.round(rng.bounded(60, 22, 0, 100)),
    parentalEngagement: Math.round(rng.bounded(55, 22, 0, 100)),
    flagged: false,
    notes: [],
    groupBySubject: {},
    progressHistory: [],
  };
}

// -----------------------------------------------------------------------------
// Staff
// -----------------------------------------------------------------------------

const ARCHETYPES = [
  { key: "inspirational NQT", ageMin: 22, ageMax: 28, salary: 32000, biasYoung: true },
  { key: "burnt-out veteran", ageMin: 50, ageMax: 64, salary: 48000, biasOld: true },
  { key: "politicking deputy", ageMin: 38, ageMax: 55, salary: 65000, role: "Senior Leader" as StaffRole },
  { key: "brilliant-but-difficult specialist", ageMin: 30, ageMax: 55, salary: 52000 },
  { key: "safe pair of hands", ageMin: 35, ageMax: 55, salary: 45000 },
  { key: "careerist", ageMin: 28, ageMax: 42, salary: 50000 },
  { key: "lifer-local", ageMin: 40, ageMax: 62, salary: 46000 },
  { key: "ideological warrior", ageMin: 32, ageMax: 55, salary: 47000 },
  { key: "competent journeyman", ageMin: 30, ageMax: 55, salary: 44000 },
];

function scoreFromArchetype(rng: RNG, archetype: string): Staff["attrs"] {
  const base = () => rng.int(8, 14);
  const high = () => rng.int(13, 19);
  const low = () => rng.int(3, 9);
  const a: Staff["attrs"] = {
    subjectKnowledge: base(),
    classroomManagement: base(),
    lessonPlanning: base(),
    markingEfficiency: base(),
    pastoralSkill: base(),
    energy: base(),
    ambition: base(),
    loyalty: base(),
    mentoring: base(),
    adminTolerance: base(),
    leadershipPotential: base(),
  };
  switch (archetype) {
    case "inspirational NQT":
      a.energy = high();
      a.ambition = high();
      a.classroomManagement = low();
      a.adminTolerance = low();
      break;
    case "burnt-out veteran":
      a.energy = low();
      a.ambition = low();
      a.subjectKnowledge = high();
      a.classroomManagement = base() + 2;
      break;
    case "politicking deputy":
      a.ambition = high();
      a.leadershipPotential = high();
      a.loyalty = low();
      a.adminTolerance = high();
      break;
    case "brilliant-but-difficult specialist":
      a.subjectKnowledge = 19;
      a.classroomManagement = low();
      a.pastoralSkill = low();
      break;
    case "safe pair of hands":
      a.classroomManagement = high();
      a.markingEfficiency = high();
      a.ambition = low();
      a.loyalty = high();
      break;
    case "careerist":
      a.ambition = high();
      a.adminTolerance = high();
      a.loyalty = low();
      break;
    case "lifer-local":
      a.loyalty = 19;
      a.pastoralSkill = high();
      a.ambition = low();
      break;
    case "ideological warrior":
      a.classroomManagement = high();
      a.adminTolerance = low();
      a.ambition = base() + 2;
      break;
    default:
      break;
  }
  return a;
}

// Translate a HoD's attrs into a class-allocation strategy. Surfaced on the
// Sets view so the player can see why the department's strongest sets land
// where they do.
export function deriveAllocationStyle(attrs: Staff["attrs"]): AllocationStyle {
  if (attrs.ambition >= 14 && attrs.loyalty <= 10) return "careerist";
  if (attrs.loyalty >= 14 && attrs.mentoring >= 13) return "collegiate";
  return "balanced";
}

export function generateStaff(rng: RNG, role: StaffRole, subject: Subject | null): Staff {
  const sex: "f" | "m" = rng.chance(0.55) ? "f" : "m";
  const archetype = rng.pick(ARCHETYPES);
  const age = rng.int(archetype.ageMin, archetype.ageMax);
  const yearsInProfession = Math.max(0, age - 22 - rng.int(0, 3));
  const yearsAtSchool = Math.min(yearsInProfession, rng.int(0, 15));
  const salaryBase = (archetype.role === "Senior Leader" || role === "Senior Leader" ? 70000 : archetype.salary);
  const salary =
    role === "Teaching Assistant"
      ? Math.round(18000 + rng.int(0, 6000))
      : role === "Pastoral"
      ? Math.round(28000 + rng.int(0, 8000))
      : Math.round(salaryBase + rng.int(-3000, 6000));

  const attrs = scoreFromArchetype(rng, archetype.key);
  const staff: Staff = {
    id: makeId("s", rng),
    givenName: firstName(rng, sex),
    surname: surname(rng),
    sex,
    age,
    role,
    subject,
    yearsAtSchool,
    yearsInProfession,
    salary,
    attrs,
    hidden: {
      integrity: rng.int(4, 19),
      professionalism: rng.int(6, 19),
      controversyRisk: rng.int(1, 18),
      unionSympathy: rng.int(1, 19),
      politicalTendency: rng.int(1, 20),
    },
    archetype: archetype.key,
    morale: Math.round(rng.bounded(65, 15, 20, 100)),
    workload: Math.round(rng.bounded(60, 15, 10, 100)),
    performanceRating: Math.round(rng.bounded(60, 15, 10, 100)),
    flagged: false,
  };
  if (role === "Head of Department") {
    staff.allocationStyle = deriveAllocationStyle(attrs);
  }
  return staff;
}

// -----------------------------------------------------------------------------
// Setting policy & teaching groups
// -----------------------------------------------------------------------------

// Build the initial per-subject setting policy left in place by the previous
// Head. The probability ladder is nested — a school only considers setting a
// less-common subject if it already sets the more-common ones. This matches
// the realistic distribution of English secondary schools (Sutton Trust/EEF
// surveys): nearly all set Maths, most also set English, half also set
// Science, etc.
export function generateInitialSettingPolicy(
  rng: RNG,
): Record<Subject, SettingPolicy> {
  const policy = {} as Record<Subject, SettingPolicy>;
  for (const s of ALL_SUBJECTS) policy[s] = { isSetted: false, introducedFromYear: null };

  const pickYear = (options: ReadonlyArray<readonly [YearGroup, number]>): YearGroup => {
    return rng.weighted(options);
  };

  // 1. Maths.
  if (rng.chance(0.9)) {
    policy.Mathematics = {
      isSetted: true,
      introducedFromYear: pickYear([[7, 0.6], [8, 0.4]]),
    };
  } else {
    return policy;
  }
  // 2. English.
  if (rng.chance(0.65)) {
    policy.English = {
      isSetted: true,
      introducedFromYear: pickYear([[8, 0.5], [9, 0.5]]),
    };
  } else {
    return policy;
  }
  // 3. Science.
  if (rng.chance(0.75)) {
    policy.Science = { isSetted: true, introducedFromYear: 9 };
  } else {
    return policy;
  }
  // 4. Languages.
  if (rng.chance(0.45)) {
    policy.Languages = {
      isSetted: true,
      introducedFromYear: pickYear([[9, 0.4], [10, 0.6]]),
    };
  } else {
    return policy;
  }
  // 5. Humanities.
  if (rng.chance(0.3)) {
    policy.Humanities = { isSetted: true, introducedFromYear: 10 };
  } else {
    return policy;
  }
  // 6. Tech/PE/Arts — independent rolls at the bottom of the ladder.
  if (rng.chance(0.15)) policy.Technology = { isSetted: true, introducedFromYear: 10 };
  if (rng.chance(0.15)) policy.PE = { isSetted: true, introducedFromYear: 10 };
  if (rng.chance(0.15)) policy.Arts = { isSetted: true, introducedFromYear: 10 };
  return policy;
}

// Number of teaching groups for a given subject/year. Derived from cohort
// size: aim for ~30 per group, clamped to [3, 6]. Maths gets +1 when setted
// (smaller top + bottom sets is typical practice).
export function computeGroupsForYear(
  cohortSize: number,
  subject: Subject,
  isSettedAtYear: boolean,
): number {
  const base = Math.max(3, Math.min(6, Math.ceil(cohortSize / 30)));
  if (subject === "Mathematics" && isSettedAtYear) {
    return Math.min(6, base + 1);
  }
  return base;
}

// Build empty TeachingGroup records for a (subject × year), populating
// state.groups. Returns the group ids in order (top set first when setted).
function buildEmptyGroups(
  rng: RNG,
  state: GameState,
  subject: Subject,
  year: YearGroup,
  count: number,
  isSetted: boolean,
): ID[] {
  const ids: ID[] = [];
  for (let i = 1; i <= count; i++) {
    const g: TeachingGroup = {
      id: makeId("g", rng),
      subject,
      yearGroup: year,
      setNumber: i,
      isSetted,
      teacherIds: [],
      pupilIds: [],
    };
    state.groups[g.id] = g;
    ids.push(g.id);
  }
  return ids;
}

// Remove all groups for a given subject × year (and unlink pupils from them).
function clearGroupsForYear(state: GameState, subject: Subject, year: YearGroup): void {
  const toDelete: ID[] = [];
  for (const g of Object.values(state.groups)) {
    if (g.subject === subject && g.yearGroup === year) toDelete.push(g.id);
  }
  for (const gid of toDelete) delete state.groups[gid];
  for (const p of Object.values(state.pupils)) {
    if (p.yearGroup === year && p.groupBySubject[subject]) {
      delete p.groupBySubject[subject];
    }
  }
}

// Rebuild teaching groups + populate them for a single (year). Called at
// generation time for every year, and at rollover for years whose membership
// changed. Setting state for the year is drawn from school.settingPolicy.
//
// When `populate` is false, the groups are still created (so the Sets view
// has something to render) but pupils are left unassigned — used when the
// player has chosen to allocate pupils to sets manually.
export function assignPupilsToGroupsForYear(
  rng: RNG,
  state: GameState,
  year: YearGroup,
  populate = true,
): void {
  const pupilsInYear = Object.values(state.pupils).filter((p) => p.yearGroup === year);
  if (pupilsInYear.length === 0) return;
  for (const subject of ALL_SUBJECTS) {
    const policy = state.school.settingPolicy[subject];
    const isSettedAtYear = policy.isSetted &&
      policy.introducedFromYear != null &&
      year >= policy.introducedFromYear;
    clearGroupsForYear(state, subject, year);
    const groupCount = computeGroupsForYear(pupilsInYear.length, subject, isSettedAtYear);
    const groupIds = buildEmptyGroups(rng, state, subject, year, groupCount, isSettedAtYear);

    if (!populate) continue;

    if (isSettedAtYear) {
      // Stream pupils by per-subject ability into N sets, top down.
      const sorted = [...pupilsInYear].sort(
        (a, b) => b.ability[subject] - a.ability[subject],
      );
      const target = Math.ceil(sorted.length / groupCount);
      for (let i = 0; i < sorted.length; i++) {
        const setIdx = Math.min(groupCount - 1, Math.floor(i / target));
        const gid = groupIds[setIdx]!;
        state.groups[gid]!.pupilIds.push(sorted[i]!.id);
        sorted[i]!.groupBySubject[subject] = gid;
      }
    } else {
      // Mixed-ability: shuffle, then deal round-robin so SEND / high-behaviour
      // outliers spread across groups instead of clustering.
      const ordered = [...pupilsInYear].sort((a, b) => {
        // Use behaviour propensity + SEND flag to pre-sort, then deal.
        const ka = a.behaviourPropensity + (a.send ? 30 : 0);
        const kb = b.behaviourPropensity + (b.send ? 30 : 0);
        return kb - ka;
      });
      for (let i = 0; i < ordered.length; i++) {
        // Snake-deal: 0,1,2,3, 3,2,1,0, 0,1,2,3 … flattens both ends.
        const cycle = Math.floor(i / groupCount);
        const inCycle = i % groupCount;
        const setIdx = cycle % 2 === 0 ? inCycle : groupCount - 1 - inCycle;
        const gid = groupIds[setIdx]!;
        state.groups[gid]!.pupilIds.push(ordered[i]!.id);
        ordered[i]!.groupBySubject[subject] = gid;
      }
    }
  }
}

// Assign teachers to every TeachingGroup in the state. HoDs pick first using
// their AllocationStyle; remaining teachers are round-robin distributed with
// a soft cap so no one is buried in 30 classes a week.
export function assignTeachersToGroups(state: GameState): void {
  // Clear existing assignments.
  for (const g of Object.values(state.groups)) g.teacherIds = [];

  for (const subject of ALL_SUBJECTS) {
    const subjectGroups = Object.values(state.groups)
      .filter((g) => g.subject === subject)
      .sort((a, b) => a.yearGroup - b.yearGroup || a.setNumber - b.setNumber);
    if (subjectGroups.length === 0) continue;

    const subjectStaff = Object.values(state.staff).filter(
      (s) => s.subject === subject && (s.role === "Teacher" || s.role === "Head of Department"),
    );
    if (subjectStaff.length === 0) continue;

    const hod = subjectStaff.find((s) => s.role === "Head of Department");
    const others = subjectStaff.filter((s) => s.id !== hod?.id);

    // HoD picks one group per year, style-dependent.
    const claimed = new Set<ID>();
    if (hod) {
      const byYear = new Map<YearGroup, TeachingGroup[]>();
      for (const g of subjectGroups) {
        const list = byYear.get(g.yearGroup) ?? [];
        list.push(g);
        byYear.set(g.yearGroup, list);
      }
      const style = hod.allocationStyle ?? "balanced";
      for (const [, groups] of byYear) {
        let pick: TeachingGroup | undefined;
        if (groups.length === 1) {
          pick = groups[0];
        } else if (style === "careerist") {
          pick = groups[0]; // top set
        } else if (style === "collegiate") {
          pick = groups[groups.length - 1]; // bottom set / hardest
        } else {
          pick = groups[Math.floor((groups.length - 1) / 2)]; // middle
        }
        if (pick) {
          pick.teacherIds.push(hod.id);
          claimed.add(pick.id);
        }
      }
    }

    // Round-robin remaining groups across non-HoD subject teachers, soft-cap 5.
    const pool = others.length > 0 ? others : (hod ? [hod] : []);
    if (pool.length === 0) continue;
    const load = new Map<ID, number>();
    for (const s of pool) load.set(s.id, 0);
    if (hod) load.set(hod.id, claimed.size);
    const unclaimed = subjectGroups.filter((g) => !claimed.has(g.id));
    let idx = 0;
    for (const g of unclaimed) {
      // Pick lightest-loaded teacher; round-robin breaks ties.
      let bestId: ID | undefined;
      let best = Infinity;
      for (let i = 0; i < pool.length; i++) {
        const s = pool[(idx + i) % pool.length]!;
        const l = load.get(s.id) ?? 0;
        if (l < best) {
          best = l;
          bestId = s.id;
        }
      }
      if (!bestId) bestId = pool[0]!.id;
      g.teacherIds.push(bestId);
      load.set(bestId, (load.get(bestId) ?? 0) + 1);
      idx = (idx + 1) % pool.length;
    }
  }
}

// -----------------------------------------------------------------------------
// School & game-state generation
// -----------------------------------------------------------------------------

export interface NewGameOptions {
  seed: string;
  ironman: boolean;
  schoolYearStart?: number;
  headteacherAge?: number;
  startingReputation?: number; // 0-100
}

export function generateNewGame(opts: NewGameOptions): GameState {
  resetIdCounter();
  const rng = new RNG(opts.seed);
  const schoolYearStart = opts.schoolYearStart ?? new Date().getUTCFullYear();
  const startingRep = opts.startingReputation ?? 50;

  // Pupils — full roster across Y7-Y11.
  const pupils: Record<ID, Pupil> = {};
  const pupilIds: ID[] = [];
  for (const yg of YEAR_GROUPS) {
    for (let i = 0; i < PUPILS_PER_YEAR; i++) {
      const p = generatePupil(rng, yg, schoolYearStart);
      pupils[p.id] = p;
      pupilIds.push(p.id);
    }
  }

  // Staff — eight HoDs, ~3 teachers per subject, plus SLT/TAs/pastoral.
  const staff: Record<ID, Staff> = {};
  const staffIds: ID[] = [];
  const push = (s: Staff): void => {
    staff[s.id] = s;
    staffIds.push(s.id);
  };

  // Senior leadership: head's deputies and assistant heads.
  push(generateStaff(rng, "Senior Leader", null));
  push(generateStaff(rng, "Senior Leader", null));
  push(generateStaff(rng, "Senior Leader", null));

  for (const subj of ALL_SUBJECTS) {
    push(generateStaff(rng, "Head of Department", subj));
    const teacherCount = subj === "English" || subj === "Mathematics" || subj === "Science" ? 5 : 3;
    for (let i = 0; i < teacherCount; i++) {
      push(generateStaff(rng, "Teacher", subj));
    }
  }
  for (let i = 0; i < 8; i++) push(generateStaff(rng, "Teaching Assistant", null));
  for (let i = 0; i < 3; i++) push(generateStaff(rng, "Pastoral", null));

  const school: School = {
    id: makeId("sc", rng),
    name: schoolName(rng),
    town: townName(rng),
    type: "state",
    capacity: PUPILS_PER_YEAR * 5,
    pupilIds,
    staffIds,
    reserves: 380000,
    annualBudget: Math.round(pupilIds.length * 5800),
    reputation: defaultReputation(startingRep),
    inspectionGrade: "Good",
    yearsInspected: 3,
    rooms: 60,
    maintenanceBacklog: 35,
    settingPolicy: generateInitialSettingPolicy(rng),
    // Player inherits a school where the previous Head delegated allocation
    // to a deputy. They can flip "next year" on Results Day.
    allocationDelegation: { thisYear: "deputy", nextYear: "deputy" },
  };

  const headteacher: Headteacher = {
    id: makeId("ht", rng),
    givenName: firstName(rng, rng.chance(0.5) ? "f" : "m"),
    surname: surname(rng),
    age: opts.headteacherAge ?? 42,
    reputationPublic: startingRep,
    reputationPrivate: Math.round(startingRep + rng.int(-8, 8)),
    yearsAsHead: 0,
  };

  const state: GameState = {
    seedLabel: opts.seed,
    rngState: rng.getState(),
    dayIndex: 0,
    schoolYearStart,
    ironman: opts.ironman,
    school,
    headteacher,
    pupils,
    staff,
    groups: {},
    inbox: [],
    resolvedInbox: [],
    interruption: {
      pauseOnCritical: true,
      pauseOnSerious: true,
      pauseOnRoutine: false,
      pauseOnReportingPoint: true,
      pauseOnTermBoundary: true,
      pauseOnInboxSize: 25,
    },
    history: [],
    results: [],
    gameOver: false,
  };

  // Populate teaching groups + assign teachers using the just-built policy.
  for (const yg of YEAR_GROUPS) {
    assignPupilsToGroupsForYear(rng, state, yg);
  }
  assignTeachersToGroups(state);
  // Sync rngState since generation consumed more random values.
  state.rngState = rng.getState();

  return state;
}

function defaultReputation(seed: number): ReputationAxes {
  return {
    discipline: seed,
    pastoral: seed,
    parentRelations: seed,
    staffMorale: seed,
    governorRelations: seed,
  };
}

