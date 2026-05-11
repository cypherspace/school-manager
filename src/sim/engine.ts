// Game engine: ticks the calendar, fires incidents, applies player decisions,
// runs the "continue until interrupt" loop, and rolls over school years.

import { RNG } from "./rng.ts";
import { dayInfo, formatDate, findYearEndDayIndex } from "./calendar.ts";
import {
  autoResolutionEffects,
  rollIncidentForDay,
} from "./incidents.ts";
import { calculateYearEndResults, rolloverYear } from "./results.ts";
import type {
  GameState,
  HistoryEntry,
  IncidentInstance,
  ResolutionEffects,
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

  // Auto-resolve expired items first (so the day starts clean).
  events.push(...applyExpired(state));

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

// Pupil progression model — applied at each reporting point. Attainment drifts
// toward ability, modulated by attendance, engagement, behaviour, school
// quality (staff-morale-as-proxy for now), with a small variance term.
function progressPupilsAtReportingPoint(state: GameState, rng: RNG): void {
  const schoolFactor = (state.school.reputation.staffMorale - 50) / 100; // -0.5..+0.5
  for (const p of Object.values(state.pupils)) {
    const ambitionFactor = (p.ambition - 50) / 200;
    const attendanceFactor = (p.attendancePct - 90) / 100;
    const engagementFactor = (p.engagement - 50) / 200;
    const behaviourFactor = (50 - p.behaviourPropensity) / 200;
    const incidentDrag = -0.4 * p.incidentsThisYear;
    for (const subj of Object.keys(p.ability) as Array<keyof typeof p.ability>) {
      const ceiling = p.ability[subj];
      const current = p.attainment[subj];
      const drift = (ceiling - current) * 0.18; // pull toward ceiling
      const noise = rng.bounded(0, 3, -7, 7);
      const adj =
        drift +
        ambitionFactor * 1.5 +
        attendanceFactor * 2 +
        engagementFactor * 1.5 +
        behaviourFactor * 1.5 +
        schoolFactor * 2 +
        incidentDrag +
        noise;
      p.attainment[subj] = clamp(Math.round(current + adj), 1, 99);
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
  rolloverYear(state);
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
  state.headteacher.yearsAsHead += 1;
  state.school.yearsInspected += 1;
  state.pauseReason = undefined;
  // Force-retire at 75.
  if (state.headteacher.age >= 75) {
    state.gameOver = true;
    state.gameOverReason = "Retired at 75. A long and distinguished career.";
  }
}

// Convenience: how many days until the year ends?
export function daysRemainingInYear(state: GameState): number {
  const last = findYearEndDayIndex(state.schoolYearStart);
  return Math.max(0, last - state.dayIndex);
}
