// Game engine: ticks the calendar, fires incidents, applies player decisions,
// runs the "continue until interrupt" loop, and rolls over school years.

import { RNG } from "./rng.ts";
import { dayInfo, formatDate, findYearEndDayIndex } from "./calendar.ts";
import {
  autoResolutionEffects,
  rollIncidentForDay,
} from "./incidents.ts";
import { calculateYearEndResults, rolloverYear } from "./results.ts";
import { ALL_SUBJECTS } from "./types.ts";
import { CONFIG } from "./config.ts";
import { tickSectorYear } from "./sector.ts";
import {
  archiveCurrentSchool,
  fireVacancyWave,
  resolveInterviewsForWave,
} from "./career.ts";
import { tickFormerSchool } from "./formerSchools.ts";
import { applyIncidentReputation, applyHireabilityFloor, snapshotReputation, applySackingReputationHit } from "./reputation.ts";
import type {
  GameState,
  HistoryEntry,
  ID,
  IncidentInstance,
  ProgressSnapshot,
  Pupil,
  ResolutionEffects,
  Staff,
  Subject,
  VacancyWave,
} from "./types.ts";

const MAX_STEPS_PER_CONTINUE = 1000; // safety rail

export interface StepResult {
  paused: boolean;
  reason: string | null;
  events: string[];
}

function rngFromState(state: GameState): RNG {
  const r = new RNG(state.seedLabel);
  r.setState(state.rngState);
  return r;
}

function syncRng(state: GameState, rng: RNG): void {
  state.rngState = rng.getState();
}

function log(state: GameState, text: string): void {
  const info = dayInfo(state.schoolYearStart, state.dayIndex);
  const entry: HistoryEntry = {
    day: state.dayIndex,
    date: formatDate(info.date),
    text,
  };
  state.history.push(entry);
  // Cap history to keep saves slim.
  if (state.history.length > 2000) state.history.splice(0, state.history.length - 2000);
}

// Apply ResolutionEffects to school + pupils + staff.
function applyEffects(
  state: GameState,
  inst: IncidentInstance,
  eff: ResolutionEffects,
): void {
  if (!state.school) {
    log(state, eff.narration);
    return;
  }
  const rep = state.school.reputation;
  if (eff.discipline) rep.discipline = clamp(rep.discipline + eff.discipline, 0, 100);
  if (eff.pastoral) rep.pastoral = clamp(rep.pastoral + eff.pastoral, 0, 100);
  if (eff.parentRelations)
    rep.parentRelations = clamp(rep.parentRelations + eff.parentRelations, 0, 100);
  if (eff.staffMorale) rep.staffMorale = clamp(rep.staffMorale + eff.staffMorale, 0, 100);
  if (eff.governorRelations)
    rep.governorRelations = clamp(rep.governorRelations + eff.governorRelations, 0, 100);
  if (eff.budget) {
    // budget effect units: roughly £1k per unit.
    state.school.reserves += eff.budget * 1000;
  }
  if (eff.flagPupil && inst.pupilId) {
    const p = state.pupils[inst.pupilId];
    if (p) p.flagged = true;
  }
  if (eff.flagStaff && inst.staffId) {
    const s = state.staff[inst.staffId];
    if (s) s.flagged = true;
  }
  if (eff.pupilNotes && inst.pupilId) {
    const p = state.pupils[inst.pupilId];
    if (p) p.notes.push(...eff.pupilNotes);
  }
  applyIncidentReputation(state, eff);
  log(state, eff.narration);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Apply auto-bad resolution to anything expired.
function applyExpired(state: GameState): string[] {
  const events: string[] = [];
  const remaining: IncidentInstance[] = [];
  for (const inst of state.inbox) {
    if (state.dayIndex > inst.expiresOnDay) {
      const eff = autoResolutionEffects(state, inst);
      applyEffects(state, inst, eff);
      inst.resolved = true;
      inst.autoResolved = true;
      inst.resolutionLabel = "Auto-resolved (expired)";
      state.resolvedInbox.push(inst);
      if (state.resolvedInbox.length > 200) {
        state.resolvedInbox.splice(0, state.resolvedInbox.length - 200);
      }
      events.push(`Auto-resolved: ${inst.title}`);
    } else {
      remaining.push(inst);
    }
  }
  state.inbox = remaining;
  return events;
}

// Single-day tick. Returns events that happened.
export function stepDay(state: GameState): StepResult {
  if (state.gameOver) return { paused: true, reason: "Game over", events: [] };

  const rng = rngFromState(state);
  const info = dayInfo(state.schoolYearStart, state.dayIndex);
  const events: string[] = [];
  let pauseReason: string | null = null;

  // Unemployed shell: time still passes, but no incidents or pupil progression.
  if (state.mode !== "in-post" || !state.school) {
    fireWavesIfDue(state, info.date);
    if (info.isYearEnd) {
      pauseReason = `Year ${info.schoolYearLabel} results day`;
    }
    state.dayIndex += 1;
    syncRng(state, rng);
    if (pauseReason) state.pauseReason = pauseReason;
    return { paused: pauseReason !== null, reason: pauseReason, events };
  }

  // Auto-resolve expired items first (so the day starts clean).
  events.push(...applyExpired(state));

  // Fire vacancy waves at the right calendar points (in-post too).
  fireWavesIfDue(state, info.date);

  // Incident firing only on teaching days.
  if (info.inTerm) {
    const inc = rollIncidentForDay(state, rng, state.dayIndex);
    if (inc) {
      state.inbox.push(inc);
      events.push(`New incident: ${inc.title}`);
      // Pause checks against interruption rules.
      const r = state.interruption;
      if (
        (inc.severity === "critical" && r.pauseOnCritical) ||
        (inc.severity === "serious" && r.pauseOnSerious) ||
        (inc.severity === "routine" && r.pauseOnRoutine)
      ) {
        pauseReason = `Incident: ${inc.title}`;
      }
    }
  }

  // Reporting points and term boundaries.
  if (info.isReportingPoint) {
    events.push(`Reporting point: ${info.schoolYearLabel} ${info.termLabel} term`);
    log(state, `Reporting point: ${info.termLabel} term data drop`);
    progressPupilsAtReportingPoint(state, rng);
    if (state.interruption.pauseOnReportingPoint) {
      pauseReason = pauseReason ?? `Reporting point: ${info.termLabel} term`;
    }
  } else if (info.isTermBoundary) {
    if (state.interruption.pauseOnTermBoundary) {
      pauseReason = pauseReason ?? `Term boundary: end of ${info.termLabel} term`;
    }
  }

  // Year end: compute results, then roll over.
  if (info.isYearEnd) {
    const report = calculateYearEndResults(state);
    state.results.push(report);
    log(state, `Results day: overall average ${report.overallAverage.toFixed(1)}%, pass rate ${report.passRate.toFixed(1)}%`);
    pauseReason = pauseReason ?? `Year ${info.schoolYearLabel} results day`;
    // Roll over to next school year on the SAME tick — handled by the
    // dedicated rollover call from the UI after the player has seen results.
    // We do NOT auto-roll here, so the year-end pause is mandatory.
  }

  // Inbox pile-up pause.
  if (state.inbox.length >= state.interruption.pauseOnInboxSize) {
    pauseReason = pauseReason ?? `Inbox full (${state.inbox.length} items)`;
  }

  // Advance time.
  state.dayIndex += 1;
  syncRng(state, rng);
  if (pauseReason) state.pauseReason = pauseReason;

  return { paused: pauseReason !== null, reason: pauseReason, events };
}

// Continue stepping until something pauses us, or we hit the safety rail.
export function continueUntilInterrupt(state: GameState): StepResult {
  const aggregateEvents: string[] = [];
  for (let i = 0; i < MAX_STEPS_PER_CONTINUE; i++) {
    const r = stepDay(state);
    aggregateEvents.push(...r.events);
    if (r.paused) {
      return { paused: true, reason: r.reason, events: aggregateEvents };
    }
  }
  return { paused: true, reason: "Step limit reached (safety rail)", events: aggregateEvents };
}

// Per-teacher quality function. Returns a modifier in roughly [-1, +1] that
// scales attainment drift. Deliberately open-ended — start with the four
// obvious classroom attributes weighted, and expand later with morale,
// energy, mentoring, archetype, pupil-teacher fit, etc.
// TODO: extend with morale (low morale eats lesson quality), pupil-teacher
// fit (e.g. brilliant-but-difficult specialist underperforms with low
// behaviour-propensity pupils), and archetype-specific bonuses.
export function computeTeacherEffect(teacher: Staff): number {
  const a = teacher.attrs;
  const weighted =
    a.subjectKnowledge * 0.3 +
    a.classroomManagement * 0.3 +
    a.lessonPlanning * 0.2 +
    a.markingEfficiency * 0.2;
  // Map from 1-20 scale (midpoint 10.5) to [-1, +1].
  return clamp((weighted - 10.5) / 9.5, -1, 1);
}

// Resolve the teacher who teaches a given pupil a given subject. Returns
// null if the pupil isn't yet assigned or the group has no teacher.
function teacherFor(state: GameState, pupil: Pupil, subject: Subject): Staff | null {
  const gid = pupil.groupBySubject[subject];
  if (!gid) return null;
  const g = state.groups[gid];
  if (!g || g.teacherIds.length === 0) return null;
  // Co-teaching averaging is for a later phase; for now take the first.
  const tid = g.teacherIds[0]!;
  return state.staff[tid] ?? null;
}

// Set-position peer effect: top set + small positive drift, bottom set
// small negative. Mixed-ability is neutral. Small on purpose so setting is
// a real trade-off, not a free win.
function setPositionEffect(state: GameState, pupil: Pupil, subject: Subject): number {
  const gid = pupil.groupBySubject[subject];
  if (!gid) return 0;
  const g = state.groups[gid];
  if (!g || !g.isSetted) return 0;
  // Count groups in this (subject × year) to know how many sets there are.
  let n = 0;
  for (const other of Object.values(state.groups)) {
    if (other.subject === subject && other.yearGroup === g.yearGroup) n++;
  }
  if (n <= 1) return 0;
  // Linear from +0.5 (top set) to -0.5 (bottom set).
  const t = (g.setNumber - 1) / (n - 1);
  return 0.5 - t;
}

// Pupil progression model — applied at each reporting point. Attainment
// drifts toward ability, modulated by attendance, engagement, behaviour,
// the assigned teacher's quality (per pupil per subject), and a small
// variance term.
function progressPupilsAtReportingPoint(state: GameState, rng: RNG): void {
  // Fallback when a pupil has no teacher (manual allocation pending, or
  // missing staff): pull the school's staff-morale signal as a coarse proxy.
  const fallbackTeacherEffect = ((state.school?.reputation.staffMorale ?? 50) - 50) / 100;

  for (const p of Object.values(state.pupils)) {
    const ambitionFactor = (p.ambition - 50) / 200;
    const attendanceFactor = (p.attendancePct - 90) / 100;
    const engagementFactor = (p.engagement - 50) / 200;
    const behaviourFactor = (50 - p.behaviourPropensity) / 200;
    const incidentDrag = -0.4 * p.incidentsThisYear;
    for (const subj of ALL_SUBJECTS) {
      const ceiling = p.ability[subj];
      const current = p.attainment[subj];
      const drift = (ceiling - current) * 0.18; // pull toward ceiling
      const noise = rng.bounded(0, 3, -7, 7);
      const teacher = teacherFor(state, p, subj);
      const teacherEffect = teacher
        ? computeTeacherEffect(teacher)
        : fallbackTeacherEffect;
      const peerEffect = setPositionEffect(state, p, subj);
      const adj =
        drift +
        ambitionFactor * 1.5 +
        attendanceFactor * 2 +
        engagementFactor * 1.5 +
        behaviourFactor * 1.5 +
        teacherEffect * 3 +
        peerEffect +
        incidentDrag +
        noise;
      p.attainment[subj] = clamp(Math.round(current + adj), 1, 99);
    }
    // Snapshot this reporting point onto the pupil's history.
    const snapshot: ProgressSnapshot = {
      day: state.dayIndex,
      date: formatDate(dayInfo(state.schoolYearStart, state.dayIndex).date),
      perSubject: { ...p.attainment },
    };
    p.progressHistory.push(snapshot);
    if (p.progressHistory.length > 30) {
      p.progressHistory.splice(0, p.progressHistory.length - 30);
    }
    // Slight attendance/engagement drift toward stable mean, with shocks.
    if (rng.chance(0.05)) p.attendancePct = clamp(p.attendancePct + rng.int(-5, 2), 50, 100);
    if (rng.chance(0.05)) p.engagement = clamp(p.engagement + rng.int(-6, 4), 5, 100);
  }
}

// Resolve an inbox incident with a choice.
export function resolveIncident(
  state: GameState,
  incidentId: string,
  choiceIndex: number,
): boolean {
  const idx = state.inbox.findIndex((x) => x.id === incidentId);
  if (idx < 0) return false;
  const inst = state.inbox[idx]!;
  const choice = inst.choices[choiceIndex];
  if (!choice) return false;
  // "Park it" — last choice — keeps the incident in the inbox.
  if (choice.label.startsWith("Park")) {
    log(state, `Parked: ${inst.title}`);
    return true;
  }
  applyEffects(state, inst, choice.effects);
  inst.resolved = true;
  inst.resolutionLabel = choice.label;
  state.inbox.splice(idx, 1);
  state.resolvedInbox.push(inst);
  if (state.resolvedInbox.length > 200) {
    state.resolvedInbox.splice(0, state.resolvedInbox.length - 200);
  }
  if (inst.pupilId) {
    const p = state.pupils[inst.pupilId];
    if (p) p.incidentsThisYear += 1;
  }
  log(state, `Resolved "${inst.title}" → ${choice.label}`);
  state.pauseReason = undefined;
  return true;
}

// Roll forward into the next school year. Called by the UI after the player
// has reviewed results.
export function advanceToNextYear(state: GameState): void {
  if (state.school) {
    rolloverYear(state);
  }
  // Reset dayIndex by re-anchoring schoolYearStart and resetting inbox state.
  state.schoolYearStart += 1;
  state.dayIndex = 0;
  // Clear inbox (anything still pending decays into history with mild drag).
  for (const inst of state.inbox) {
    log(state, `Carried over: ${inst.title} — closed at year end`);
  }
  state.inbox = [];
  // Headteacher ages.
  state.headteacher.age += 1;
  if (state.mode === "in-post") state.headteacher.yearsAsHead += 1;
  if (state.school) state.school.yearsInspected += 1;
  state.pauseReason = undefined;

  // Snapshot reputation BEFORE applying expectations-check, so year-in-review
  // can show the delta from the new headline numbers.
  // (results.ts runs the expectations check during rolloverYear; we just take
  // the snapshot here at the very end.)
  snapshotReputation(state);

  // Run sacking check (in-post only). Two consecutive Inadequates triggers
  // archival as "sacked" + a large reputation hit. Career-end is gated on the
  // reputation floor, applied below.
  if (state.mode === "in-post" && state.school) {
    if (state.school.inspectionGrade === "Inadequate") {
      state.headteacher.inadequateStreak += 1;
    } else {
      state.headteacher.inadequateStreak = 0;
    }
    if (state.headteacher.inadequateStreak >= 2) {
      log(state, "No-confidence vote at governors — you are out.");
      archiveCurrentSchool(state, "sacked");
      applySackingReputationHit(state);
      state.headteacher.inadequateStreak = 0;
    }
  }

  // Sector ticks: NPC heads age, retire, get sacked, move; record pending vacancies.
  const yearRng = new RNG(`${state.seedLabel}:sector:${state.schoolYearStart}`);
  tickSectorYear(state, yearRng);

  // Tick every archived school once per year so the world doesn't freeze.
  for (const formerId of Object.keys(state.formerSchools) as ID[]) {
    tickFormerSchool(state, formerId);
  }

  // Hireability floor: end career if unhireable for too long.
  applyHireabilityFloor(state);

  // Force-retire at 75.
  if (state.headteacher.age >= CONFIG.forceRetireAge) {
    state.gameOver = true;
    state.gameOverReason = "Retired at 75. A long and distinguished career.";
    state.mode = "retired";
  }
}

// Vacancy waves: each wave fires on a specific real-world date.
// Post-Christmas → ~ Jan 8 (Spring half-term 3 start area).
// Post-Easter → ~ April 15 (Summer half-term 5 start).
// Summer → ~ June 2 (Summer half-term 6 start).
function fireWavesIfDue(state: GameState, date: Date): void {
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const checks: Array<[VacancyWave, number, number]> = [
    ["post-christmas", 0, 8],
    ["post-easter", 3, 15],
    ["summer", 5, 2],
  ];
  for (const [wave, m, d] of checks) {
    if (month === m && day === d && state.sector.lastWaveFiredYear[wave] !== state.schoolYearStart) {
      fireVacancyWave(state, wave, null);
      // Resolve any pending applications a few weeks later — we simulate by
      // resolving at the same trigger point, so player offers arrive in-band.
      const outcomes = resolveInterviewsForWave(state, wave);
      for (const out of outcomes) {
        if (out.playerOffered) {
          state.pauseReason = `Offer received from ${nameForVacancy(state, out.vacancyId)}`;
        } else if (out.playerRejected) {
          log(state, `Rejected: ${nameForVacancy(state, out.vacancyId)}`);
        }
      }
    }
  }
}

function nameForVacancy(state: GameState, vacancyId: ID): string {
  const vac = state.sector.vacancies[vacancyId];
  if (!vac) return "(unknown school)";
  return state.sector.schools[vac.schoolId]?.name ?? "(unknown school)";
}

// Convenience: how many days until the year ends?
export function daysRemainingInYear(state: GameState): number {
  const last = findYearEndDayIndex(state.schoolYearStart);
  return Math.max(0, last - state.dayIndex);
}
