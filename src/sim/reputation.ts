// Reputation movements. Public + private reputation 0-100 on the player's
// Headteacher record, driven by what the world sees vs what it whispers.

import { CONFIG } from "./config.ts";
import type {
  Application,
  ApplicationAnswer,
  GameState,
  ResolutionEffects,
  ResultsReport,
} from "./types.ts";

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function applyResultsReputation(state: GameState, report: ResultsReport): void {
  if (!state.school) return;
  const archetype = state.school.archetype;
  // Magnify swings at struggling schools, dampen at elite.
  const magnifier =
    archetype === "struggling-academy" ? 1.5 : archetype === "elite-selective" ? 0.6 : 1;
  const passRateDelta = report.passRate - 55; // 55% is "expected"
  const publicShift = (passRateDelta / 8) * magnifier;
  const privateShift = (passRateDelta / 12) * magnifier;
  state.headteacher.reputationPublic = clamp(
    state.headteacher.reputationPublic + publicShift,
  );
  state.headteacher.reputationPrivate = clamp(
    state.headteacher.reputationPrivate + privateShift,
  );
}

export function applyInspectionReputation(state: GameState, gradeDelta: number): void {
  if (gradeDelta === 0) return;
  const sign = Math.sign(gradeDelta);
  state.headteacher.reputationPublic = clamp(state.headteacher.reputationPublic + sign * 10);
  state.headteacher.reputationPrivate = clamp(state.headteacher.reputationPrivate + sign * 6);
}

export function applyIncidentReputation(state: GameState, eff: ResolutionEffects): void {
  // Large negatives or positives across multiple axes nudge private reputation;
  // very large public-facing incidents also nudge public.
  const negs = [eff.discipline, eff.parentRelations, eff.pastoral, eff.governorRelations]
    .filter((x): x is number => typeof x === "number" && x !== 0);
  const sumNeg = negs.reduce((s, x) => s + Math.min(0, x), 0);
  const sumPos = negs.reduce((s, x) => s + Math.max(0, x), 0);
  // sumNeg is negative; private reputation is sensitive to clusters of bad axes.
  if (sumNeg <= -8) {
    state.headteacher.reputationPrivate = clamp(state.headteacher.reputationPrivate + sumNeg / 4);
  }
  if (sumNeg <= -12) {
    state.headteacher.reputationPublic = clamp(state.headteacher.reputationPublic + sumNeg / 6);
  }
  if (sumPos >= 8) {
    state.headteacher.reputationPrivate = clamp(state.headteacher.reputationPrivate + sumPos / 8);
  }
}

export function applyTenureLength(state: GameState): void {
  if (state.mode !== "in-post") return;
  state.headteacher.reputationPrivate = clamp(
    state.headteacher.reputationPrivate + CONFIG.tenureRewardPerYear,
  );
}

// Compare the school's expectations vector (and any explicit interview
// promises the player made) against the year's actual outcomes. Material
// under- or over-delivery moves private reputation.
export function applyExpectationsCheck(state: GameState, report: ResultsReport): void {
  if (state.mode !== "in-post" || !state.school) return;
  const application = findHireApplication(state);
  const expectations = sectorExpectations(state);
  if (!expectations) return;

  // Headline outcomes for the year.
  const actual = {
    results: report.overallAverage / 100, // 0-1
    passRate: report.passRate / 100,
    behaviour: state.school.reputation.discipline / 100,
    budget: state.school.reserves > 0 ? 1 : 0,
  };

  // Expectation vector check (vs school's stated priorities).
  let expectationsDelta = 0;
  // resultsPressure: schools expect overall avg ≈ resultsPressure*100.
  if (expectations.resultsPressure > 0.6) {
    expectationsDelta += (actual.results - expectations.resultsPressure) * 6;
  }
  if (expectations.behaviourPressure > 0.6) {
    expectationsDelta += (actual.behaviour - expectations.behaviourPressure) * 4;
  }
  if (expectations.budgetDiscipline > 0.6 && state.school.reserves < 0) {
    expectationsDelta -= 4;
  }

  state.headteacher.reputationPrivate = clamp(
    state.headteacher.reputationPrivate +
      Math.sign(expectationsDelta) * Math.min(CONFIG.expectationsHitMagnitude, Math.abs(expectationsDelta)),
  );

  // Per-promise check.
  if (application) {
    for (const ans of application.answers) {
      const hit = scorePromise(ans, report, state);
      if (hit !== 0) {
        state.headteacher.reputationPrivate = clamp(
          state.headteacher.reputationPrivate +
            Math.sign(hit) * Math.min(CONFIG.promiseHitMagnitude, Math.abs(hit)),
        );
      }
    }
  }
}

function findHireApplication(state: GameState): Application | null {
  const schoolId = state.school?.id;
  if (!schoolId) return null;
  for (const app of Object.values(state.sector.applications)) {
    if (app.isPlayer && app.result === "accepted") {
      const vac = state.sector.vacancies[app.vacancyId];
      if (vac && vac.schoolId === schoolId) return app;
    }
  }
  return null;
}

function sectorExpectations(state: GameState) {
  if (!state.school) return null;
  return state.sector.schools[state.school.id]?.expectations ?? null;
}

function scorePromise(
  ans: ApplicationAnswer,
  report: ResultsReport,
  state: GameState,
): number {
  if (!ans.promiseTag || ans.promiseValue == null) return 0;
  switch (ans.promiseTag) {
    case "results-floor": {
      // promiseValue is target Y11 pass rate, percent points.
      return (report.passRate - ans.promiseValue) / 4;
    }
    case "ofsted-grade": {
      // promiseValue: 1=Inadequate, 2=RI, 3=Good, 4=Outstanding.
      const ladder = ["Inadequate", "Requires Improvement", "Good", "Outstanding"];
      const current = state.school ? ladder.indexOf(state.school.inspectionGrade) + 1 : 0;
      return (current - ans.promiseValue) * 4;
    }
    case "budget-surplus": {
      return (state.school?.reserves ?? 0) > 0 ? 3 : -5;
    }
    case "exclusions-cap": {
      // We don't track exclusions yet; treat behaviour reputation as a proxy.
      if (!state.school) return 0;
      return (state.school.reputation.discipline - 50) / 8;
    }
    case "no-staff-cuts": {
      // No-op for now; checked by future staff-departure aggregation.
      return 0;
    }
  }
}

// Hireability floor: when both reputations sit below thresholds, vacancies
// won't offer; long-term unhireability ends the career.
export function isHireable(state: GameState): boolean {
  return (
    state.headteacher.reputationPublic >= CONFIG.hireabilityFloorPublic ||
    state.headteacher.reputationPrivate >= CONFIG.hireabilityFloorPrivate
  );
}

export function applyHireabilityFloor(state: GameState): void {
  if (state.mode !== "unemployed") return;
  if (isHireable(state)) return;
  const yearsOut =
    state.schoolYearStart - (state.headteacher.unemployedSinceYear ?? state.schoolYearStart);
  if (yearsOut >= CONFIG.unhireableYearsToCareerEnd) {
    state.gameOver = true;
    state.gameOverReason = `Out of the game. Reputation sank below what any school would touch.`;
    state.mode = "retired";
  }
}

// Sacking hit — invoked when sackingCheck unseats the player.
export function applySackingReputationHit(state: GameState): void {
  state.headteacher.reputationPublic = clamp(
    state.headteacher.reputationPublic - CONFIG.sackingReputationHit,
  );
  state.headteacher.reputationPrivate = clamp(
    state.headteacher.reputationPrivate - CONFIG.sackingReputationHit,
  );
  state.headteacher.totalSackings += 1;
}

// Snapshot year-end reputation so year-in-review can show deltas.
export function snapshotReputation(state: GameState): void {
  state.headteacher.lastYearReputation = {
    public: state.headteacher.reputationPublic,
    private: state.headteacher.reputationPrivate,
  };
}
