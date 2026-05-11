import { RNG } from "./rng.ts";
import {
  ALL_SUBJECTS,
  YEAR_GROUPS,
  type GameState,
  type Headteacher,
  type ID,
  type Pupil,
  type ReputationAxes,
  type School,
  type Staff,
  type StaffRole,
  type Subject,
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

  return {
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
    attrs: scoreFromArchetype(rng, archetype.key),
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

  return {
    seedLabel: opts.seed,
    rngState: rng.getState(),
    dayIndex: 0,
    schoolYearStart,
    ironman: opts.ironman,
    school,
    headteacher,
    pupils,
    staff,
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

