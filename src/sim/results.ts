// End-of-year results calculation, inspection-grade impact, and year rollover
// (pupil ageing, Y11 leavers, new Y7 intake).

import {
  ALL_SUBJECTS,
  YEAR_GROUPS,
  type GameState,
  type ResultsReport,
  type Subject,
  type YearGroup,
} from "./types.ts";
import { RNG } from "./rng.ts";
import {
  assignPupilsToGroupsForYear,
  assignTeachersToGroups,
  generatePupil,
} from "./generators.ts";
import {
  applyExpectationsCheck,
  applyInspectionReputation,
  applyResultsReputation,
  applyTenureLength,
} from "./reputation.ts";
import { buildYearInReview } from "./yearInReview.ts";

function meanAttainment(attainment: Record<Subject, number>): number {
  const vals = Object.values(attainment);
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

export function calculateYearEndResults(state: GameState): ResultsReport {
  if (!state.school) {
    return emptyReport(state);
  }
  const pupils = Object.values(state.pupils);
  const perSubjectTotals: Record<Subject, { sum: number; n: number }> = {} as never;
  for (const s of ALL_SUBJECTS) perSubjectTotals[s] = { sum: 0, n: 0 };
  const perYearTotals: Record<YearGroup, { sum: number; n: number }> = {} as never;
  for (const y of YEAR_GROUPS) perYearTotals[y] = { sum: 0, n: 0 };

  // Apply exam-day variance to a copy so saved attainment is the term-3
  // result. Public results are noisier than internal data.
  const rng = new RNG(`${state.seedLabel}:results:${state.schoolYearStart}`);

  let y11Sum = 0;
  let y11N = 0;
  let y11Pass = 0;
  const perPupilMean: Array<[string, number]> = [];

  for (const p of pupils) {
    let pSum = 0;
    let pN = 0;
    for (const subj of ALL_SUBJECTS) {
      const examNoise = rng.bounded(0, 5, -12, 12);
      const examScore = Math.max(1, Math.min(99, Math.round(p.attainment[subj] + examNoise)));
      perSubjectTotals[subj].sum += examScore;
      perSubjectTotals[subj].n += 1;
      perYearTotals[p.yearGroup].sum += examScore;
      perYearTotals[p.yearGroup].n += 1;
      pSum += examScore;
      pN += 1;
    }
    const pMean = pSum / pN;
    perPupilMean.push([p.id, pMean]);
    if (p.yearGroup === 11) {
      y11Sum += pMean;
      y11N += 1;
      if (pMean >= 50) y11Pass += 1;
    }
  }

  const perSubjectAverage = {} as Record<Subject, number>;
  for (const s of ALL_SUBJECTS) {
    perSubjectAverage[s] =
      perSubjectTotals[s].n === 0 ? 0 : perSubjectTotals[s].sum / perSubjectTotals[s].n;
  }
  const perYearAverage = {} as Record<YearGroup, number>;
  for (const y of YEAR_GROUPS) {
    perYearAverage[y] =
      perYearTotals[y].n === 0 ? 0 : perYearTotals[y].sum / perYearTotals[y].n;
  }

  const allMean =
    perPupilMean.reduce((s, [, v]) => s + v, 0) / Math.max(1, perPupilMean.length);
  const passRate = y11N === 0 ? 0 : (y11Pass / y11N) * 100;

  perPupilMean.sort((a, b) => b[1] - a[1]);
  const topPerformers = perPupilMean.slice(0, 8).map(([id]) => id);
  const concernPupils = perPupilMean.slice(-8).map(([id]) => id);

  // Inspection grade impact: positive when passRate above 65, negative below 45.
  let inspectionGradeImpact = 0;
  if (passRate > 75) inspectionGradeImpact = 3;
  else if (passRate > 65) inspectionGradeImpact = 1;
  else if (passRate < 35) inspectionGradeImpact = -3;
  else if (passRate < 45) inspectionGradeImpact = -1;

  // Budget delta: ±£40k based on roll stability + results.
  const budgetDelta = Math.round((passRate - 50) * 800);

  return {
    schoolYearLabel: `${state.schoolYearStart}/${String(state.schoolYearStart + 1).slice(-2)}`,
    endYear: state.schoolYearStart + 1,
    perSubjectAverage,
    perYearAverage,
    overallAverage: allMean,
    passRate,
    topPerformers,
    concernPupils,
    inspectionGradeImpact,
    budgetDelta,
    notes: buildResultsNotes(perSubjectAverage, perYearAverage, passRate),
  };
}

function buildResultsNotes(
  perSubject: Record<Subject, number>,
  perYear: Record<YearGroup, number>,
  passRate: number,
): string[] {
  const notes: string[] = [];
  const subjectEntries = Object.entries(perSubject) as Array<[Subject, number]>;
  subjectEntries.sort((a, b) => a[1] - b[1]);
  if (subjectEntries.length > 0) {
    const worst = subjectEntries[0]!;
    const best = subjectEntries[subjectEntries.length - 1]!;
    notes.push(`${best[0]} strongest at ${best[1].toFixed(1)}%; ${worst[0]} weakest at ${worst[1].toFixed(1)}%.`);
  }
  const y10 = perYear[10];
  const y11 = perYear[11];
  if (typeof y10 === "number" && typeof y11 === "number" && y10 > y11 + 5) {
    notes.push("Y10 outpacing Y11 — coaching needed before next year's results.");
  }
  if (passRate > 75) notes.push("League-table-friendly numbers. Press release writes itself.");
  else if (passRate < 45) notes.push("Below benchmark. Expect governor questions.");
  else notes.push("Steady, unspectacular. Quiet evening for the Chair.");
  return notes;
}

function emptyReport(state: GameState): ResultsReport {
  const perSubjectAverage = {} as Record<Subject, number>;
  for (const s of ALL_SUBJECTS) perSubjectAverage[s] = 0;
  const perYearAverage = {} as Record<YearGroup, number>;
  for (const y of YEAR_GROUPS) perYearAverage[y] = 0;
  return {
    schoolYearLabel: `${state.schoolYearStart}/${String(state.schoolYearStart + 1).slice(-2)}`,
    endYear: state.schoolYearStart + 1,
    perSubjectAverage,
    perYearAverage,
    overallAverage: 0,
    passRate: 0,
    topPerformers: [],
    concernPupils: [],
    inspectionGradeImpact: 0,
    budgetDelta: 0,
    notes: ["No active school — unemployed year."],
  };
}

// Year rollover: apply results consequences, age pupils, send Y11 to alumni
// (Phase 4 will give alumni a real life), intake new Y7s, reset annual counters.
export function rolloverYear(state: GameState): void {
  if (!state.school) return;
  const lastReport = state.results[state.results.length - 1];
  if (lastReport) {
    state.school.reserves += lastReport.budgetDelta;
    // Inspection grade can move on big swings.
    const ladder = ["Inadequate", "Requires Improvement", "Good", "Outstanding"] as const;
    let idx = ladder.indexOf(state.school.inspectionGrade);
    const oldIdx = idx;
    if (lastReport.inspectionGradeImpact >= 3 && idx < 3) idx += 1;
    if (lastReport.inspectionGradeImpact <= -3 && idx > 0) idx -= 1;
    state.school.inspectionGrade = ladder[idx]!;
    // Career reputation: results + inspection swings + tenure + expectations.
    applyResultsReputation(state, lastReport);
    applyInspectionReputation(state, idx - oldIdx);
    applyTenureLength(state);
    applyExpectationsCheck(state, lastReport);
    // Build year-in-review based on snapshot vs current.
    const yr = buildYearInReview(state, lastReport);
    state.headteacher.yearInReview.push(yr);
  }

  // Move Y11 out, age everyone up.
  const survivors: typeof state.pupils = {};
  const newPupilIds: string[] = [];
  for (const p of Object.values(state.pupils)) {
    if (p.yearGroup === 11) {
      // Phase 4 will retain them as alumni records.
      continue;
    }
    const next = (p.yearGroup + 1) as 8 | 9 | 10 | 11;
    p.yearGroup = next;
    p.formGroup = `${next}${p.formGroup.slice(1)}`;
    p.incidentsThisYear = 0;
    p.behaviourPoints = 0;
    p.flagged = false;
    p.notes = [];
    // Past-year teaching-group assignments are stale once year groups shift;
    // wipe them so the next allocation pass can rebuild cleanly.
    p.groupBySubject = {};
    survivors[p.id] = p;
    newPupilIds.push(p.id);
  }

  // New Y7 intake.
  const rng = new RNG(`${state.seedLabel}:intake:${state.schoolYearStart + 1}`);
  // Carry over rngState a touch so future incident rolls remain decorrelated
  // from intake gen.
  for (let i = 0; i < 120; i++) {
    const p = generatePupil(rng, 7, state.schoolYearStart + 1);
    survivors[p.id] = p;
    newPupilIds.push(p.id);
  }

  state.pupils = survivors;
  state.school.pupilIds = newPupilIds;

  // Wipe stale teaching groups (they referenced leavers + old year structure).
  state.groups = {};

  // Allocate pupils to groups for the new year. If the Head delegated this
  // to a deputy, populate automatically; otherwise build the empty group
  // slots so the player can drag pupils in via Timetable → Sets.
  state.school.allocationDelegation.thisYear = state.school.allocationDelegation.nextYear;
  const populate = state.school.allocationDelegation.thisYear === "deputy";
  for (const yg of YEAR_GROUPS) {
    assignPupilsToGroupsForYear(rng, state, yg, populate);
  }
  assignTeachersToGroups(state);

  // Staff ageing — and a small chance of natural attrition.
  const departing: string[] = [];
  for (const s of Object.values(state.staff)) {
    s.age += 1;
    s.yearsAtSchool += 1;
    s.yearsInProfession += 1;
    s.flagged = false;
    if (s.age >= 67) {
      departing.push(s.id);
      continue;
    }
    // Morale drift toward 60.
    s.morale = Math.round(s.morale * 0.85 + 60 * 0.15);
  }
  for (const id of departing) {
    delete state.staff[id];
    state.school.staffIds = state.school.staffIds.filter((x) => x !== id);
  }
}
