// Year-in-review composer. Pulls together the headline numbers, reputation
// movement, defining incidents, and a Yes-Minister-ish narrative line for
// the Results-day banner and the CV drilldown.

import type { GameState, IncidentInstance, ResultsReport, YearInReview } from "./types.ts";

export function buildYearInReview(state: GameState, report: ResultsReport): YearInReview {
  const lastRep = state.headteacher.lastYearReputation;
  const pubDelta = Math.round(state.headteacher.reputationPublic - lastRep.public);
  const privDelta = Math.round(state.headteacher.reputationPrivate - lastRep.private);

  const resolved = [...state.resolvedInbox]
    .filter((i) => i.resolved)
    .sort((a, b) => severityRank(b) - severityRank(a))
    .slice(0, 3);

  const staffMoved: string[] = [];
  // Inferred staff movement: anyone flagged this year + resolved with staff link.
  for (const inst of state.resolvedInbox) {
    if (inst.staffId && inst.category === "Staff" && inst.severity !== "trivial") {
      const s = state.staff[inst.staffId];
      if (s) staffMoved.push(`${s.givenName} ${s.surname}`);
    }
  }

  const pupilsToWatch = [...(report.topPerformers ?? []).slice(0, 2), ...(report.concernPupils ?? []).slice(0, 1)]
    .map((id) => state.pupils[id])
    .filter((p): p is NonNullable<typeof p> => p != null)
    .map((p) => `${p.givenName} ${p.surname} (${p.formGroup})`);

  const narrative = composeNarrative(state, report, pubDelta, privDelta);

  return {
    schoolYearLabel: report.schoolYearLabel,
    schoolName: state.school?.name ?? "(no school)",
    resultsHeadline: `Overall ${report.overallAverage.toFixed(1)}%, Y11 pass ${report.passRate.toFixed(1)}%`,
    publicReputationDelta: pubDelta,
    privateReputationDelta: privDelta,
    keyIncidents: resolved.map((i) => i.title),
    staffMoved: dedupe(staffMoved),
    pupilsToWatch,
    narrative,
  };
}

function severityRank(i: IncidentInstance): number {
  switch (i.severity) {
    case "critical":
      return 4;
    case "serious":
      return 3;
    case "routine":
      return 2;
    case "trivial":
      return 1;
  }
}

function dedupe(xs: string[]): string[] {
  return [...new Set(xs)];
}

function composeNarrative(
  state: GameState,
  report: ResultsReport,
  pubDelta: number,
  privDelta: number,
): string {
  const passing = report.passRate;
  const grade = state.school?.inspectionGrade ?? "—";
  const head = `${state.headteacher.givenName} ${state.headteacher.surname}`;
  const parts: string[] = [];
  if (passing > 75) parts.push("A good year. Quietly triumphant.");
  else if (passing > 60) parts.push("A solid year. No-one knighted yet.");
  else if (passing > 45) parts.push("A middling year. The Chair was civil.");
  else parts.push("A bruising year. The Chair did not phone first.");

  if (pubDelta >= 5) parts.push("The local paper is, on balance, on your side.");
  else if (pubDelta <= -5) parts.push("The local paper is, on balance, not on your side.");
  if (privDelta >= 5) parts.push("Within the sector, you are spoken of warmly.");
  else if (privDelta <= -5) parts.push("Within the sector, you are spoken of carefully.");

  parts.push(`Grade: ${grade}. ${head} considers the holiday earned.`);
  return parts.join(" ");
}
