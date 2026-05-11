// Core entity types for the simulation. Phase 0/1 scope only — these will
// expand significantly in later phases (alumni life simulation, rivals,
// politics, estate). Fields marked "hidden" are visible only to the sim,
// not to the player UI.

export type ID = string;

export type Subject =
  | "English"
  | "Mathematics"
  | "Science"
  | "Humanities"
  | "Languages"
  | "Arts"
  | "PE"
  | "Technology";

export const ALL_SUBJECTS: readonly Subject[] = [
  "English",
  "Mathematics",
  "Science",
  "Humanities",
  "Languages",
  "Arts",
  "PE",
  "Technology",
] as const;

export type YearGroup = 7 | 8 | 9 | 10 | 11;
export const YEAR_GROUPS: readonly YearGroup[] = [7, 8, 9, 10, 11] as const;

export interface ProgressSnapshot {
  day: number; // dayIndex at which it was recorded
  date: string; // ISO date, for convenience in views
  perSubject: Record<Subject, number>; // attainment at this reporting point
}

export interface Pupil {
  id: ID;
  givenName: string;
  surname: string;
  sex: "f" | "m";
  yearGroup: YearGroup;
  formGroup: string; // e.g. "7A"
  dob: string; // ISO date
  // Background
  send: boolean;
  eal: boolean;
  premiumEligible: boolean;
  priorAttainment: number; // 0-100, snapshot at intake
  // Academic
  ability: Record<Subject, number>; // 0-100, hidden ceiling
  attainment: Record<Subject, number>; // 0-100, current observable
  // Per-subject teaching-group assignment (TeachingGroup id).
  // Empty entries mean "not yet allocated" — common during manual allocation.
  groupBySubject: Partial<Record<Subject, ID>>;
  // Half-termly snapshots of attainment, oldest first. Capped at ~30 entries.
  progressHistory: ProgressSnapshot[];
  // Behaviour
  behaviourPropensity: number; // 0-100, hidden — higher = more likely to act out
  behaviourPoints: number; // signed running total (negative = bad)
  incidentsThisYear: number;
  // Pastoral
  attendancePct: number; // 0-100
  engagement: number; // 0-100
  wellbeing: number; // 0-100
  // Hidden long-term
  ambition: number;
  resilience: number;
  familySupport: number;
  parentalEngagement: number;
  // Flags
  flagged: boolean; // surfaced to player by incidents/outliers/staff
  notes: string[];
}

export type StaffRole =
  | "Teacher"
  | "Head of Department"
  | "Senior Leader"
  | "Teaching Assistant"
  | "Pastoral";

export interface Staff {
  id: ID;
  givenName: string;
  surname: string;
  sex: "f" | "m";
  age: number;
  role: StaffRole;
  subject: Subject | null; // null for TAs / pastoral
  yearsAtSchool: number;
  yearsInProfession: number;
  salary: number;
  // FM-style 1-20 attributes
  attrs: {
    subjectKnowledge: number;
    classroomManagement: number;
    lessonPlanning: number;
    markingEfficiency: number;
    pastoralSkill: number;
    energy: number;
    ambition: number;
    loyalty: number;
    mentoring: number;
    adminTolerance: number;
    leadershipPotential: number;
  };
  // Hidden
  hidden: {
    integrity: number; // 1-20
    professionalism: number; // 1-20
    controversyRisk: number; // 1-20
    unionSympathy: number; // 1-20
    politicalTendency: number; // 1-20 (1 = progressive, 20 = traditional)
  };
  archetype: string;
  morale: number; // 0-100, derived/updated by sim
  workload: number; // 0-100
  performanceRating: number; // 0-100, updated by appraisals
  flagged: boolean;
  // HoD-only: how this HoD distributes classes to their staff. Derived from
  // attrs at school generation. UI surfaces this so the player can see *why*
  // a collegiate HoD keeps taking the hardest sets.
  allocationStyle?: AllocationStyle;
}

export type AllocationStyle = "careerist" | "collegiate" | "balanced";

// Per-subject setting policy. Captures the state the previous Head left in
// place when the player arrives. Mutable — the player can change it later.
export interface SettingPolicy {
  isSetted: boolean;
  // Lowest year group at which this subject is setted. null when not setted.
  introducedFromYear: YearGroup | null;
}

export interface TeachingGroup {
  id: ID;
  subject: Subject;
  yearGroup: YearGroup;
  // 1-indexed. 1 = top set when setted; arbitrary stable index when not setted.
  setNumber: number;
  isSetted: boolean;
  teacherIds: ID[]; // typically one, kept as array for future co-teaching
  pupilIds: ID[];
}

export type AllocationDecider = "head" | "deputy";

export type IncidentCategory =
  | "Safeguarding"
  | "Behaviour"
  | "Staff"
  | "Parent"
  | "Governor"
  | "Press"
  | "Operations"
  | "Pastoral";

export type Severity = "trivial" | "routine" | "serious" | "critical";

export interface IncidentChoice {
  label: string;
  hint?: string;
  effects: ResolutionEffects;
}

export interface ResolutionEffects {
  // Reputation axes from the design doc
  discipline?: number;
  pastoral?: number;
  parentRelations?: number;
  staffMorale?: number;
  governorRelations?: number;
  budget?: number;
  // Pupil/staff-specific consequences (resolved at apply time)
  pupilNotes?: string[];
  flagPupil?: boolean;
  flagStaff?: boolean;
  // Free-text narration appended to history
  narration: string;
}

export interface IncidentInstance {
  id: ID;
  templateId: string;
  category: IncidentCategory;
  severity: Severity;
  pausesGame: boolean;
  title: string;
  body: string;
  choices: IncidentChoice[];
  raisedOnDay: number; // calendar day index
  expiresOnDay: number; // if unresolved past this, auto-resolves badly
  pupilId?: ID | undefined;
  staffId?: ID | undefined;
  resolved: boolean;
  resolutionLabel?: string;
  autoResolved?: boolean;
}

export interface ReputationAxes {
  discipline: number; // each axis is 0-100, starts at 50
  pastoral: number;
  parentRelations: number;
  staffMorale: number;
  governorRelations: number;
}

export interface InterruptionRules {
  // Severities at which the engine should stop the "continue" loop.
  pauseOnCritical: boolean;
  pauseOnSerious: boolean;
  pauseOnRoutine: boolean;
  pauseOnReportingPoint: boolean;
  pauseOnTermBoundary: boolean;
  // Stop if inbox pile-up reaches this size.
  pauseOnInboxSize: number;
}

export interface School {
  id: ID;
  name: string;
  town: string;
  type: "state" | "academy" | "independent";
  capacity: number;
  pupilIds: ID[];
  staffIds: ID[];
  reserves: number; // £
  annualBudget: number; // £
  reputation: ReputationAxes;
  inspectionGrade: "Outstanding" | "Good" | "Requires Improvement" | "Inadequate";
  yearsInspected: number; // years since last inspection
  // Site (placeholder for Phase 6)
  rooms: number;
  maintenanceBacklog: number; // 0-100
  // Setting policy by subject. The Head (player) can change this later.
  settingPolicy: Record<Subject, SettingPolicy>;
  // Who allocates pupils to teaching groups next time round.
  // "deputy" auto-assigns; "head" waits for the player to do it manually.
  allocationDelegation: {
    thisYear: AllocationDecider;
    nextYear: AllocationDecider;
  };
}

export interface Headteacher {
  id: ID;
  givenName: string;
  surname: string;
  age: number;
  reputationPublic: number; // 0-100
  reputationPrivate: number; // 0-100
  yearsAsHead: number;
}

export interface HistoryEntry {
  day: number;
  date: string;
  text: string;
}

export interface ResultsReport {
  schoolYearLabel: string; // e.g. "2026/27"
  endYear: number;
  perSubjectAverage: Record<Subject, number>;
  perYearAverage: Record<YearGroup, number>;
  overallAverage: number;
  passRate: number; // % of Y11 pupils >= 50 average
  topPerformers: ID[];
  concernPupils: ID[];
  inspectionGradeImpact: number; // -5..+5
  budgetDelta: number;
  notes: string[];
}

export interface GameState {
  // RNG
  seedLabel: string;
  rngState: number;
  // Calendar
  dayIndex: number; // days since game start
  schoolYearStart: number; // calendar year of September
  // Mode
  ironman: boolean;
  // World
  school: School;
  headteacher: Headteacher;
  pupils: Record<ID, Pupil>;
  staff: Record<ID, Staff>;
  groups: Record<ID, TeachingGroup>;
  // Inbox
  inbox: IncidentInstance[];
  resolvedInbox: IncidentInstance[];
  // Rules
  interruption: InterruptionRules;
  // History
  history: HistoryEntry[];
  // Reports
  results: ResultsReport[];
  // Bookkeeping
  pauseReason?: string | undefined;
  gameOver: boolean;
  gameOverReason?: string;
}
