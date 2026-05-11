// The career layer: vacancy waves, applications, multi-question interview
// scoring, accept/decline, and the school-archive shuffle when the player
// changes posting.

import { RNG } from "./rng.ts";
import { CONFIG } from "./config.ts";
import {
  backfillSectorHead,
  generateSector,
  pickWaveVacancies,
  tickSectorYear,
  type SectorYearOutcome,
} from "./sector.ts";
import { hireAtSectorSchool, makeId } from "./generators.ts";
import { hydrateLiveSchoolFromBag, persistLiveSchoolToBag } from "./formerSchools.ts";
import { perkAffinity } from "./perks.ts";
import { isHireable } from "./reputation.ts";
import type {
  Application,
  ApplicationAnswer,
  CareerPosting,
  GameState,
  GovernorBias,
  Headteacher,
  ID,
  PromiseTag,
  School,
  SectorSchool,
  Vacancy,
  VacancyWave,
} from "./types.ts";

// ---- Interview question pool -------------------------------------------------

export interface StanceChoice {
  id: string;
  label: string;
  fitDelta: Partial<GovernorBias>;
  promiseTag?: PromiseTag;
  promiseValue?: number;
}

export interface InterviewQuestion {
  id: string;
  prompt: string;
  // Which governor-bias axes this question primarily probes.
  axisWeights: Partial<Record<keyof GovernorBias, number>>;
  choices: StanceChoice[];
}

export const QUESTION_POOL: InterviewQuestion[] = [
  {
    id: "exclusions",
    prompt: "On exclusions and zero-tolerance discipline?",
    axisWeights: { parent: 1, faith: 0.8, business: 0.5 },
    choices: [
      {
        id: "zero-tolerance",
        label: "Zero tolerance. Excluded means excluded.",
        fitDelta: { business: 0.4, parent: 0.2, exteacher: -0.2 },
        promiseTag: "exclusions-cap",
        promiseValue: 20,
      },
      {
        id: "restorative",
        label: "Restorative wherever possible.",
        fitDelta: { exteacher: 0.3, parent: -0.1, faith: 0.1 },
        promiseTag: "exclusions-cap",
        promiseValue: 5,
      },
      {
        id: "case-by-case",
        label: "Case by case. The Head decides.",
        fitDelta: { eminence: 0.2, exteacher: 0.1 },
      },
    ],
  },
  {
    id: "league-tables",
    prompt: "On the league tables — what's the strategy?",
    axisWeights: { business: 1, eminence: 0.7 },
    choices: [
      {
        id: "results-first",
        label: "Results first. We aim for top quartile.",
        fitDelta: { business: 0.4, eminence: 0.3, parent: 0.1 },
        promiseTag: "results-floor",
        promiseValue: 75,
      },
      {
        id: "rounded",
        label: "A rounded education. The numbers will follow.",
        fitDelta: { faith: 0.2, parent: 0.2, business: -0.2 },
        promiseTag: "results-floor",
        promiseValue: 55,
      },
      {
        id: "honest",
        label: "Stop teaching to the test.",
        fitDelta: { exteacher: 0.4, business: -0.3, eminence: -0.2 },
      },
    ],
  },
  {
    id: "ofsted",
    prompt: "On Ofsted preparation?",
    axisWeights: { eminence: 1, business: 0.7, councillor: 0.5 },
    choices: [
      {
        id: "always-ready",
        label: "Always ready. Every day a deep dive.",
        fitDelta: { business: 0.3, eminence: 0.3, exteacher: -0.2 },
        promiseTag: "ofsted-grade",
        promiseValue: 3,
      },
      {
        id: "outstanding-or-bust",
        label: "Outstanding in three years.",
        fitDelta: { business: 0.4, eminence: 0.4 },
        promiseTag: "ofsted-grade",
        promiseValue: 4,
      },
      {
        id: "honest-leaders",
        label: "Inspections are a snapshot. We focus on the term.",
        fitDelta: { exteacher: 0.3, faith: 0.1, business: -0.3 },
      },
    ],
  },
  {
    id: "union",
    prompt: "On union negotiations and staff workload?",
    axisWeights: { exteacher: 1, councillor: 0.7 },
    choices: [
      {
        id: "robust",
        label: "Robust. The school comes first.",
        fitDelta: { business: 0.3, exteacher: -0.3 },
      },
      {
        id: "collaborative",
        label: "Collaborative. They are professionals.",
        fitDelta: { exteacher: 0.4, councillor: 0.2 },
      },
      {
        id: "pragmatic",
        label: "Pragmatic. We trade workload for goodwill.",
        fitDelta: { exteacher: 0.3, business: -0.1 },
      },
    ],
  },
  {
    id: "budget",
    prompt: "On budget discipline?",
    axisWeights: { business: 1, councillor: 0.7 },
    choices: [
      {
        id: "surplus",
        label: "Surplus every year. No exceptions.",
        fitDelta: { business: 0.4, councillor: 0.2 },
        promiseTag: "budget-surplus",
        promiseValue: 1,
      },
      {
        id: "invest",
        label: "Invest in staff first, balance second.",
        fitDelta: { exteacher: 0.3, business: -0.2 },
      },
      {
        id: "creative",
        label: "Creative — donations, partnerships, capital bids.",
        fitDelta: { business: 0.2, eminence: 0.2 },
      },
    ],
  },
  {
    id: "phones",
    prompt: "On phones in school?",
    axisWeights: { parent: 1, exteacher: 0.4 },
    choices: [
      {
        id: "banned",
        label: "Full ban. Lockers at reception.",
        fitDelta: { parent: 0.3, exteacher: 0.2, business: 0.1 },
      },
      {
        id: "bell-to-bell",
        label: "Pockets bell-to-bell. Trust them.",
        fitDelta: { parent: 0.2 },
      },
      {
        id: "permissive",
        label: "They live with phones. We teach them to use them.",
        fitDelta: { parent: -0.3, exteacher: -0.1 },
      },
    ],
  },
  {
    id: "faith",
    prompt: "On the place of faith / collective worship?",
    axisWeights: { faith: 1, parent: 0.4 },
    choices: [
      {
        id: "central",
        label: "Central. It defines the school.",
        fitDelta: { faith: 0.5, parent: 0.1 },
      },
      {
        id: "respectful",
        label: "Respectful, inclusive, optional.",
        fitDelta: { faith: 0.1, parent: 0.2 },
      },
      {
        id: "secular",
        label: "A secular school in a secular state.",
        fitDelta: { faith: -0.4 },
      },
    ],
  },
  {
    id: "parents",
    prompt: "On parent engagement?",
    axisWeights: { parent: 1, councillor: 0.5 },
    choices: [
      {
        id: "open-door",
        label: "Open door. Parents are partners.",
        fitDelta: { parent: 0.4, councillor: 0.2 },
      },
      {
        id: "structured",
        label: "Structured channels only.",
        fitDelta: { business: 0.2, parent: -0.1 },
      },
      {
        id: "selective",
        label: "We listen to parents who listen to us.",
        fitDelta: { eminence: 0.2, parent: -0.2 },
      },
    ],
  },
  {
    id: "curriculum",
    prompt: "On curriculum design?",
    axisWeights: { eminence: 0.8, exteacher: 0.7 },
    choices: [
      {
        id: "knowledge-rich",
        label: "Knowledge-rich, rigorously sequenced.",
        fitDelta: { eminence: 0.4, business: 0.2 },
      },
      {
        id: "skills",
        label: "Skills-led, real-world.",
        fitDelta: { eminence: -0.3, business: 0.1 },
      },
      {
        id: "broad",
        label: "Broad and balanced. Arts and PE count too.",
        fitDelta: { parent: 0.2, exteacher: 0.2 },
      },
    ],
  },
  {
    id: "community",
    prompt: "On the school's place in the community?",
    axisWeights: { councillor: 1, parent: 0.6 },
    choices: [
      {
        id: "visible",
        label: "Visible. Open evenings, fêtes, festivals.",
        fitDelta: { councillor: 0.4, parent: 0.3 },
      },
      {
        id: "focused",
        label: "Focused on the children, not the high street.",
        fitDelta: { business: 0.2, councillor: -0.2 },
      },
      {
        id: "civic",
        label: "Civic partner. The council expects nothing less.",
        fitDelta: { councillor: 0.5 },
      },
    ],
  },
  {
    id: "send",
    prompt: "On SEND provision?",
    axisWeights: { parent: 0.8, exteacher: 0.6 },
    choices: [
      {
        id: "fully-funded",
        label: "Fully funded. Whatever it takes.",
        fitDelta: { parent: 0.4, exteacher: 0.3, business: -0.2 },
      },
      {
        id: "compliant",
        label: "Compliant with what the LA pays for.",
        fitDelta: { business: 0.3, parent: -0.2 },
      },
      {
        id: "mainstream",
        label: "Mainstream where possible; specialist where needed.",
        fitDelta: { exteacher: 0.2, parent: 0.1 },
      },
    ],
  },
  {
    id: "tradition",
    prompt: "On uniform, houses, and tradition?",
    axisWeights: { faith: 0.6, eminence: 0.5, parent: 0.5 },
    choices: [
      {
        id: "strict",
        label: "Strict. Blazer, tie, ties tightened.",
        fitDelta: { eminence: 0.3, faith: 0.2, parent: 0.2 },
      },
      {
        id: "modern",
        label: "Modern. Pragmatic. Polo shirts in summer.",
        fitDelta: { eminence: -0.2, parent: 0.1 },
      },
      {
        id: "minimal",
        label: "Minimal. Children are not soldiers.",
        fitDelta: { exteacher: 0.3, eminence: -0.4 },
      },
    ],
  },
  {
    id: "leadership",
    prompt: "Your first six months — what changes?",
    axisWeights: { business: 0.5, eminence: 0.5, exteacher: 0.5 },
    choices: [
      {
        id: "listening",
        label: "Listening tour. No big changes yet.",
        fitDelta: { exteacher: 0.3, parent: 0.1 },
      },
      {
        id: "sharp",
        label: "Three or four sharp moves on day one.",
        fitDelta: { business: 0.4, eminence: 0.2, exteacher: -0.2 },
      },
      {
        id: "data",
        label: "Data audit, then a plan by half-term.",
        fitDelta: { business: 0.3, eminence: 0.2 },
      },
    ],
  },
];

// ---- Question selection ------------------------------------------------------

// Pick N interview questions weighted by the school's governor bias. Questions
// that probe heavily-weighted axes are more likely to appear.
export function pickInterviewQuestions(
  rng: RNG,
  vacancy: Vacancy,
  count = CONFIG.interviewQuestionCount,
): InterviewQuestion[] {
  const scored = QUESTION_POOL.map((q) => {
    let score = 0;
    for (const [axis, weight] of Object.entries(q.axisWeights) as Array<
      [keyof GovernorBias, number]
    >) {
      score += weight * vacancy.governorBias[axis];
    }
    // Add a small per-call random jitter so the same vacancy presents a
    // different selection if applied to twice.
    return { q, score: score + rng.next() * 0.4 };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.min(count, scored.length)).map((x) => x.q);
}

// ---- Application + scoring ---------------------------------------------------

export function submitApplication(
  state: GameState,
  vacancyId: ID,
  answers: ApplicationAnswer[],
): Application {
  const vac = state.sector.vacancies[vacancyId];
  const app: Application = {
    id: makeId("ap", rngFor(state, `submit:${vacancyId}:${state.dayIndex}`)),
    vacancyId,
    headId: state.headteacher.id,
    isPlayer: true,
    submittedYear: state.schoolYearStart,
    submittedWave: vac?.openedWave ?? "post-christmas",
    submittedOnDay: state.dayIndex,
    resolveOnDay: state.dayIndex + CONFIG.interviewLeadDays,
    answers,
    score: 0,
    result: "pending",
  };
  state.sector.applications[app.id] = app;
  return app;
}

// Score an application: baseline (rep + attribute fit) sigmoid + stance modifier.
export function scoreApplication(
  app: Application,
  vacancy: Vacancy,
  headteacher: Headteacher,
): number {
  const w = CONFIG.interviewBaselineWeights;
  // Normalise to [-1, +1].
  const pub = (headteacher.reputationPublic - 50) / 50;
  const prv = (headteacher.reputationPrivate - 50) / 50;
  const fit = attributeFitForVacancy(headteacher, vacancy);
  const baseline = w.publicRep * pub + w.privateRep * prv + w.attributeFit * fit;

  const affinity = perkAffinity(headteacher);
  // Stance modifier: mean of weighted fitDelta against bias.
  let stance = 0;
  for (const ans of app.answers) {
    let s = 0;
    for (const [axis, delta] of Object.entries(ans.fitDelta) as Array<
      [keyof GovernorBias, number]
    >) {
      s += (vacancy.governorBias[axis] + (affinity[axis] ?? 0)) * delta;
    }
    stance += s;
  }
  if (app.answers.length > 0) stance /= app.answers.length;

  // Sigmoid output 0..1.
  const raw = baseline + stance;
  return 1 / (1 + Math.exp(-raw * 2));
}

function attributeFitForVacancy(headteacher: Headteacher, vacancy: Vacancy): number {
  // Reformer-style schools (high innovation) want leadership+politics; faith
  // schools want pastoral; struggling schools want leadership+finance.
  const a = headteacher.attrs;
  const norm = (v: number) => (v - 10.5) / 9.5;
  const lead = norm(a.leadership);
  const pol = norm(a.politics);
  const ped = norm(a.pedagogy);
  const pas = norm(a.pastoral);
  const fin = norm(a.finance);
  const cha = norm(a.charisma);
  const e = vacancy.expectations;
  return (
    lead * 0.25 +
    pol * (0.1 + e.budgetDiscipline * 0.1) +
    ped * e.resultsPressure * 0.3 +
    pas * e.behaviourPressure * 0.2 +
    fin * e.budgetDiscipline * 0.2 +
    cha * e.communityVisibility * 0.2
  );
}

// Generate a synthetic NPC application against a vacancy. Used so that the
// player isn't unopposed.
export function generateRivalApplication(
  state: GameState,
  rng: RNG,
  vacancy: Vacancy,
): Application {
  // Mimic a Headteacher with random attributes tuned to the school's tier.
  const sector = state.sector.schools[vacancy.schoolId];
  const tierBoost = sector ? (sector.reputationTier - 3) * 6 : 0;
  const rivalReputation = Math.round(45 + tierBoost + rng.int(-12, 18));
  const rivalAttrs: Headteacher["attrs"] = {
    leadership: rng.int(8, 17),
    politics: rng.int(8, 17),
    pedagogy: rng.int(8, 17),
    pastoral: rng.int(8, 17),
    finance: rng.int(8, 17),
    charisma: rng.int(8, 17),
  };
  const rivalHead: Headteacher = {
    id: makeId("rh", rng),
    givenName: "?",
    surname: "?",
    age: rng.int(38, 60),
    sex: "m",
    reputationPublic: rivalReputation,
    reputationPrivate: rivalReputation,
    yearsAsHead: rng.int(2, 18),
    background: "career-teacher",
    perks: [],
    attrs: rivalAttrs,
    careerHistory: [],
    currentSchoolId: null,
    unemployedSinceYear: null,
    yearInReview: [],
    totalSackings: 0,
    inadequateStreak: 0,
    lastYearReputation: { public: rivalReputation, private: rivalReputation },
  };
  // Rival answers: tilt toward the school's strongest axis.
  const answers: ApplicationAnswer[] = [];
  const questions = pickInterviewQuestions(rng, vacancy);
  for (const q of questions) {
    // Pick the choice that best matches the school's bias.
    let best: StanceChoice | null = null;
    let bestScore = -Infinity;
    for (const c of q.choices) {
      let s = 0;
      for (const [axis, delta] of Object.entries(c.fitDelta) as Array<
        [keyof GovernorBias, number]
      >) {
        s += vacancy.governorBias[axis] * delta;
      }
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    if (best) {
      answers.push({
        questionId: q.id,
        choiceId: best.id,
        fitDelta: best.fitDelta,
        promiseTag: best.promiseTag,
        promiseValue: best.promiseValue,
      });
    }
  }
  const app: Application = {
    id: makeId("ap", rng),
    vacancyId: vacancy.id,
    headId: rivalHead.id,
    isPlayer: false,
    submittedYear: state.schoolYearStart,
    submittedWave: vacancy.openedWave,
    submittedOnDay: state.dayIndex,
    resolveOnDay: state.dayIndex + CONFIG.interviewLeadDays,
    answers,
    score: 0,
    result: "pending",
  };
  app.score = scoreApplication(app, vacancy, rivalHead);
  return app;
}

// ---- Vacancy waves -----------------------------------------------------------

export function fireVacancyWave(
  state: GameState,
  wave: VacancyWave,
  outcome: SectorYearOutcome | null,
): void {
  // Avoid double-firing in a single year.
  if (state.sector.lastWaveFiredYear[wave] === state.schoolYearStart) return;
  state.sector.lastWaveFiredYear[wave] = state.schoolYearStart;

  const rng = rngFor(state, `vacancy:${wave}:${state.schoolYearStart}`);
  // Collect schools that have no head and no open vacancy for this year yet.
  const pending: ID[] = [];
  for (const ss of Object.values(state.sector.schools)) {
    if (ss.headId != null) continue;
    const hasOpen = Object.values(state.sector.vacancies).some(
      (v) => v.schoolId === ss.id && v.status === "open" && v.startYear >= state.schoolYearStart,
    );
    if (!hasOpen) pending.push(ss.id);
  }
  // Bias to this wave's share. Schools left over carry to the next wave.
  const chosen = pickWaveVacancies(pending, wave, rng);
  void outcome;
  for (const schoolId of chosen) {
    const ss = state.sector.schools[schoolId];
    if (!ss) continue;
    const startTerm = startTermFor(wave);
    const startYearOffset = wave === "summer" ? 1 : 0;
    const vacancy: Vacancy = {
      id: makeId("vc", rng),
      schoolId,
      openedWave: wave,
      openedYear: state.schoolYearStart,
      openedOnDay: state.dayIndex,
      closesOnDay: state.dayIndex + CONFIG.vacancyOpenDays,
      startTerm,
      startYear: state.schoolYearStart + startYearOffset,
      minPublicReputation: Math.max(0, ss.reputationTier * 10 - 5),
      minPrivateReputation: Math.max(0, ss.reputationTier * 10 - 10),
      governorBias: ss.governorBias,
      expectations: ss.expectations,
      salaryBand: ss.salaryBand,
      status: "open",
    };
    state.sector.vacancies[vacancy.id] = vacancy;
  }
}

function startTermFor(wave: VacancyWave): "easter" | "summer" | "autumn" {
  if (wave === "post-christmas") return "easter";
  if (wave === "post-easter") return "summer";
  return "autumn";
}

// Resolve all open applications belonging to vacancies whose deadline is this
// wave. Player offers land as inbox-style notifications via state.pauseReason.
export interface InterviewOutcome {
  vacancyId: ID;
  winnerApplicationId: ID;
  playerOffered: boolean;
  playerRejected: boolean;
}

// Close vacancies that have been open too long with nobody pending. A rival
// NPC takes the seat. Keeps the sector moving when the player ignores a
// vacancy or never qualified for one.
export function closeStaleVacancies(state: GameState): void {
  for (const vac of Object.values(state.sector.vacancies)) {
    if (vac.status !== "open") continue;
    if (vac.openedYear !== state.schoolYearStart) {
      // Carry-over vacancy from a previous year — apply the same rule using
      // dayIndex-from-now beyond the closesOnDay value (treated as
      // year-relative). For simplicity, give carry-overs another 30 days
      // before forcing closure.
      if (state.dayIndex < 30) continue;
    } else if (state.dayIndex < vac.closesOnDay) {
      continue;
    }
    // Pending player application? Let it run; resolveDueApplications will
    // handle it.
    const pendingPlayer = Object.values(state.sector.applications).some(
      (a) => a.vacancyId === vac.id && a.isPlayer && a.result === "pending",
    );
    if (pendingPlayer) continue;
    const rng = rngFor(state, `auto-close:${vac.id}`);
    backfillSectorHead(state, rng, vac.schoolId);
    vac.status = "filled";
  }
}

// Resolve any pending applications whose resolveOnDay has arrived. Each
// application stands on its own — the panel sits a fortnight after you
// applied, full stop.
export function resolveDueApplications(state: GameState): InterviewOutcome[] {
  const outcomes: InterviewOutcome[] = [];
  for (const app of Object.values(state.sector.applications)) {
    if (app.result !== "pending") continue;
    if (!app.isPlayer) continue;
    if (state.dayIndex < app.resolveOnDay) continue;
    const out = resolveApplicationNow(state, app);
    if (out) outcomes.push(out);
  }
  return outcomes;
}

// Resolve a single player application immediately. Generates 2 NPC rivals,
// scores everyone, picks the winner. If the player won, marks them "offered"
// and leaves the vacancy open until they accept/decline. If a rival won, the
// rival fills the school straight away.
function resolveApplicationNow(
  state: GameState,
  playerApp: Application,
): InterviewOutcome | null {
  const vac = state.sector.vacancies[playerApp.vacancyId];
  if (!vac || vac.status !== "open") {
    // Vacancy already filled while we were thinking. Polite rejection.
    playerApp.result = "rejected";
    return {
      vacancyId: playerApp.vacancyId,
      winnerApplicationId: playerApp.id,
      playerOffered: false,
      playerRejected: true,
    };
  }
  const rng = rngFor(state, `resolve:${playerApp.id}`);
  // Generate two NPC rival applications for the panel comparison.
  const rivals: Application[] = [
    generateRivalApplication(state, rng, vac),
    generateRivalApplication(state, rng, vac),
  ];
  for (const r of rivals) state.sector.applications[r.id] = r;
  // Score player.
  playerApp.score = scoreApplication(playerApp, vac, state.headteacher);
  if (
    state.headteacher.reputationPublic < vac.minPublicReputation &&
    state.headteacher.reputationPrivate < vac.minPrivateReputation
  ) {
    playerApp.score -= 0.3;
  }
  const all = [playerApp, ...rivals].sort((a, b) => b.score - a.score);
  const winner = all[0]!;
  for (const a of all) {
    a.result = a.id === winner.id ? "offered" : "rejected";
  }
  if (winner.id === playerApp.id) {
    return {
      vacancyId: vac.id,
      winnerApplicationId: playerApp.id,
      playerOffered: true,
      playerRejected: false,
    };
  }
  // Rival won: fill the seat immediately.
  backfillSectorHead(state, rng, vac.schoolId);
  vac.status = "filled";
  return {
    vacancyId: vac.id,
    winnerApplicationId: winner.id,
    playerOffered: false,
    playerRejected: true,
  };
}

// ---- Accept / decline -------------------------------------------------------

export function acceptOffer(state: GameState, applicationId: ID): boolean {
  const app = state.sector.applications[applicationId];
  if (!app || !app.isPlayer || app.result !== "offered") return false;
  const vac = state.sector.vacancies[app.vacancyId];
  if (!vac) return false;
  archiveCurrentSchool(state, "moved");
  app.result = "accepted";
  vac.status = "filled";
  // Move into the new school.
  moveIntoSchool(state, vac.schoolId);
  return true;
}

export function declineOffer(state: GameState, applicationId: ID): boolean {
  const app = state.sector.applications[applicationId];
  if (!app || !app.isPlayer || app.result !== "offered") return false;
  const vac = state.sector.vacancies[app.vacancyId];
  if (!vac) return false;
  app.result = "declined";
  // Fill the seat with the runner-up rival.
  const rng = rngFor(state, `decline:${applicationId}`);
  backfillSectorHead(state, rng, vac.schoolId);
  vac.status = "filled";
  return true;
}

// Move the head into a sector school. If the school has an archived record,
// resume it; otherwise generate fresh.
export function moveIntoSchool(state: GameState, sectorSchoolId: ID): void {
  const ss = state.sector.schools[sectorSchoolId];
  if (!ss) return;
  const archived = state.formerSchools[sectorSchoolId];
  if (archived) {
    delete state.formerSchools[sectorSchoolId];
    state.school = archived;
    state.mode = "in-post";
    state.dayIndex = 0;
    hydrateLiveSchoolFromBag(state, archived);
    ss.headId = state.headteacher.id;
    ss.yearsSinceTurnover = 0;
    state.headteacher.currentSchoolId = archived.id;
    state.headteacher.unemployedSinceYear = null;
    state.headteacher.careerHistory.push({
      schoolId: archived.id,
      schoolName: archived.name,
      town: archived.town,
      type: archived.type,
      startYear: state.schoolYearStart,
      endYear: null,
      finalGrade: null,
      headlineResultsAvg: null,
      departureReason: "current",
    });
    return;
  }
  // Otherwise generate a fresh school and mount.
  hireAtSectorSchool(state, sectorSchoolId);
}

// Move the player's current school into formerSchools and close out the
// current career posting with a reason. Idempotent — if already unemployed,
// does nothing.
export function archiveCurrentSchool(
  state: GameState,
  reason: CareerPosting["departureReason"],
): void {
  if (!state.school) return;
  persistLiveSchoolToBag(state);
  const last = state.headteacher.careerHistory[state.headteacher.careerHistory.length - 1];
  if (last && last.endYear === null) {
    last.endYear = state.schoolYearStart;
    last.departureReason = reason;
    last.finalGrade = state.school.inspectionGrade;
    const lastResult = state.results[state.results.length - 1];
    last.headlineResultsAvg = lastResult ? lastResult.overallAverage : null;
  }
  state.formerSchools[state.school.id] = state.school;
  // Clear current school caches.
  state.school = null;
  state.pupils = {};
  state.staff = {};
  state.groups = {};
  state.inbox = [];
  // Mark unemployed (caller may immediately call moveIntoSchool to flip back).
  state.mode = "unemployed";
  state.headteacher.currentSchoolId = null;
  state.headteacher.unemployedSinceYear = state.schoolYearStart;
}

// Convenience: applications/vacancies the player can apply to.
export function availableVacancies(state: GameState): Vacancy[] {
  return Object.values(state.sector.vacancies).filter((v) => {
    if (v.status !== "open") return false;
    // Already applied?
    const has = Object.values(state.sector.applications).some(
      (a) => a.vacancyId === v.id && a.isPlayer && (a.result === "pending" || a.result === "offered"),
    );
    if (has) return false;
    return true;
  });
}

export function pendingOffer(state: GameState): Application | null {
  return (
    Object.values(state.sector.applications).find(
      (a) => a.isPlayer && a.result === "offered",
    ) ?? null
  );
}

// Ensure a sector exists. Called at character-creation time. The seedLabel
// drives reproducibility.
export function ensureSector(state: GameState): void {
  if (Object.keys(state.sector.schools).length > 0) return;
  const rng = rngFor(state, `sector:initial`);
  const sector = generateSector(rng);
  state.sector = sector;
}

// ---- internal ---------------------------------------------------------------

function rngFor(state: GameState, label: string): RNG {
  return new RNG(`${state.seedLabel}:${label}`);
}

// Re-export for engine's convenience.
export { tickSectorYear };
