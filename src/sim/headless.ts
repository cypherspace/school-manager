// Headless harness — run a school year (or several) with a naive auto-pilot
// that picks the first non-park choice for every incident. Useful for shaking
// out the deterministic core without involving the UI.
//
// Usage: pnpm sim   (or)   npx tsx src/sim/headless.ts [years] [seed]

import { advanceToNextYear, continueUntilInterrupt, resolveIncident } from "./engine.ts";
import { generateNewGame } from "./generators.ts";
import { serialize } from "./save.ts";

function main(): void {
  const years = Number(process.argv[2] ?? 1);
  const seed = process.argv[3] ?? "headless-default";

  const state = generateNewGame({
    seed,
    ironman: false,
    schoolYearStart: 2026,
    startingReputation: 55,
  });

  console.log(`School: ${state.school.name} (${state.school.town})`);
  console.log(`Pupils: ${Object.keys(state.pupils).length}; Staff: ${Object.keys(state.staff).length}`);
  console.log(`Head: ${state.headteacher.givenName} ${state.headteacher.surname}, age ${state.headteacher.age}`);
  console.log();

  for (let i = 0; i < years; i++) {
    let iterations = 0;
    while (!state.gameOver) {
      const r = continueUntilInterrupt(state);
      iterations++;
      if (r.reason && r.reason.startsWith("Year ")) {
        // Year-end pause — break out to print + roll over.
        break;
      }
      // Auto-resolve everything in the inbox by picking the first (most
      // "engaged") choice. Never the park option.
      const before = state.inbox.length;
      for (const inst of [...state.inbox]) {
        resolveIncident(state, inst.id, 0);
      }
      const after = state.inbox.length;
      if (before === after && before > 0) {
        // Stuck — bail.
        break;
      }
      if (iterations > 500) break;
    }

    const report = state.results[state.results.length - 1];
    if (report) {
      console.log(`Year ${report.schoolYearLabel}:`);
      console.log(`  overall avg: ${report.overallAverage.toFixed(1)}%`);
      console.log(`  Y11 pass rate: ${report.passRate.toFixed(1)}%`);
      console.log(`  inspection drift: ${report.inspectionGradeImpact >= 0 ? "+" : ""}${report.inspectionGradeImpact}`);
      console.log(`  notes: ${report.notes.join(" / ")}`);
      console.log(`  reputation: ${formatRep(state.school.reputation)}`);
    }

    if (state.gameOver) {
      console.log(`Game over: ${state.gameOverReason}`);
      break;
    }
    advanceToNextYear(state);
  }

  const dump = serialize(state, "headless");
  console.log(`Save size: ${dump.length.toLocaleString()} bytes`);
}

function formatRep(r: GameStateLikeRep): string {
  return [
    `disc ${r.discipline.toFixed(0)}`,
    `past ${r.pastoral.toFixed(0)}`,
    `par ${r.parentRelations.toFixed(0)}`,
    `staff ${r.staffMorale.toFixed(0)}`,
    `gov ${r.governorRelations.toFixed(0)}`,
  ].join(" / ");
}

interface GameStateLikeRep {
  discipline: number;
  pastoral: number;
  parentRelations: number;
  staffMorale: number;
  governorRelations: number;
}

main();
