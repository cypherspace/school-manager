// Headless harness — run a career arc with a naive auto-pilot that picks the
// first non-park choice for every incident, accepts every offer it can, and
// rolls over years until career end or the requested year cap.
//
// Usage: pnpm sim   (or)   npx tsx src/sim/headless.ts [years] [seed]

import { advanceToNextYear, continueUntilInterrupt, resolveIncident } from "./engine.ts";
import { generateNewGame, hireAtSectorSchool } from "./generators.ts";
import {
  acceptOffer,
  availableVacancies,
  fireVacancyWave,
  pendingOffer,
  pickInterviewQuestions,
  submitApplication,
} from "./career.ts";
import { RNG } from "./rng.ts";
import type { ApplicationAnswer, Vacancy } from "./types.ts";
import { serialize } from "./save.ts";

function main(): void {
  const years = Number(process.argv[2] ?? 5);
  const seed = process.argv[3] ?? "headless-default";

  const state = generateNewGame({
    seed,
    ironman: false,
    schoolYearStart: 2026,
    background: "career-teacher",
    perks: ["safe-pair-of-hands", "data-wonk"],
  });

  // Pick the highest-tier entry school to hire into.
  const bestSectorSchool = Object.values(state.sector.schools).sort(
    (a, b) => b.reputationTier - a.reputationTier,
  )[0];
  if (bestSectorSchool) {
    hireAtSectorSchool(state, bestSectorSchool.id);
  }

  console.log(`School: ${state.school?.name ?? "(none)"} (${state.school?.town ?? "—"})`);
  console.log(`Pupils: ${Object.keys(state.pupils).length}; Staff: ${Object.keys(state.staff).length}`);
  console.log(
    `Head: ${state.headteacher.givenName} ${state.headteacher.surname}, age ${state.headteacher.age} (${state.headteacher.background})`,
  );
  console.log();

  for (let i = 0; i < years; i++) {
    // Force the post-christmas wave open at year start so the auto-pilot has
    // something to apply to (in the UI, this happens organically on Jan 8).
    if (i >= 1) {
      fireVacancyWave(state, "post-christmas", null);
      const reach = availableVacancies(state)
        .filter((v) => (state.sector.schools[v.schoolId]?.reputationTier ?? 0) >= 3)
        .sort(
          (a, b) =>
            (state.sector.schools[b.schoolId]?.reputationTier ?? 0) -
            (state.sector.schools[a.schoolId]?.reputationTier ?? 0),
        );
      const pick = reach[0];
      if (pick) autoApply(state, pick);
    }
    let iterations = 0;
    while (!state.gameOver) {
      const r = continueUntilInterrupt(state);
      iterations++;
      // Accept any pending offer on the spot.
      const offer = pendingOffer(state);
      if (offer) acceptOffer(state, offer.id);
      if (r.reason && r.reason.startsWith("Year ")) break;
      // Auto-resolve everything in the inbox by picking the first choice.
      const before = state.inbox.length;
      for (const inst of [...state.inbox]) {
        resolveIncident(state, inst.id, 0);
      }
      const after = state.inbox.length;
      if (before === after && before > 0) break;
      if (iterations > 500) break;
    }

    const report = state.results[state.results.length - 1];
    if (report) {
      console.log(`Year ${report.schoolYearLabel}:`);
      console.log(`  overall avg: ${report.overallAverage.toFixed(1)}%`);
      console.log(`  Y11 pass rate: ${report.passRate.toFixed(1)}%`);
      console.log(`  inspection drift: ${report.inspectionGradeImpact >= 0 ? "+" : ""}${report.inspectionGradeImpact}`);
      console.log(`  notes: ${report.notes.join(" / ")}`);
      if (state.school) console.log(`  reputation: ${formatRep(state.school.reputation)}`);
      console.log(
        `  head reputation: public ${state.headteacher.reputationPublic} / private ${state.headteacher.reputationPrivate}`,
      );
    }

    if (state.gameOver) {
      console.log(`Game over: ${state.gameOverReason}`);
      break;
    }
    advanceToNextYear(state);

    // After roll: if unemployed and an offer is pending, accept it.
    const offer = pendingOffer(state);
    if (offer) {
      console.log(`Offer received; accepting.`);
      acceptOffer(state, offer.id);
    }
  }

  console.log();
  console.log("Career history:");
  for (const post of state.headteacher.careerHistory) {
    console.log(
      `  ${post.startYear}-${post.endYear ?? "current"}  ${post.schoolName}  (${post.departureReason})`,
    );
  }

  const dump = serialize(state, "headless");
  console.log(`Save size: ${dump.length.toLocaleString()} bytes`);
}

function autoApply(state: ReturnType<typeof generateNewGame>, vac: Vacancy): void {
  const rng = new RNG(`${state.seedLabel}:auto-apply:${vac.id}`);
  const qs = pickInterviewQuestions(rng, vac);
  const answers: ApplicationAnswer[] = [];
  for (const q of qs) {
    // Pick the choice that best aligns with the vacancy's bias.
    let best = q.choices[0]!;
    let bestScore = -Infinity;
    for (const c of q.choices) {
      let s = 0;
      for (const [axis, delta] of Object.entries(c.fitDelta) as Array<[keyof typeof vac.governorBias, number]>) {
        s += vac.governorBias[axis] * delta;
      }
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    const ans: ApplicationAnswer = {
      questionId: q.id,
      choiceId: best.id,
      fitDelta: best.fitDelta,
    };
    if (best.promiseTag) ans.promiseTag = best.promiseTag;
    if (best.promiseValue != null) ans.promiseValue = best.promiseValue;
    answers.push(ans);
  }
  const app = submitApplication(state, vac.id, answers);
  app.submittedWave = vac.openedWave;
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
