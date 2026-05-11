// Sector generation + termly tick. Builds the 20-school world the player
// moves within, populates each with an NPC head, and exposes a per-year
// tick that ages heads, retires the elderly, sacks the unsuccessful, and
// fires three vacancy waves over the school year.

import { RNG } from "./rng.ts";
import { CONFIG } from "./config.ts";
import { firstName, surname, townName } from "./names.ts";
import { makeId } from "./generators.ts";
import type {
  ExpectationsVector,
  GameState,
  GovernorBias,
  ID,
  Sector,
  SectorHead,
  SectorSchool,
  SchoolArchetype,
  School,
  TrashTalkEntry,
  VacancyWave,
} from "./types.ts";

// Name pools per archetype. Deliberately small but flavourful.

const NAME_POOLS: Record<SchoolArchetype, { prefixes: string[]; suffixes: string[] }> = {
  "average-state": {
    prefixes: ["Greenfield", "Ashbridge", "Marston", "Northgate", "Eastview", "Riverside", "Oakmere", "Highfield"],
    suffixes: ["Academy", "Comprehensive", "Community School", "High School"],
  },
  "elite-selective": {
    prefixes: ["King's", "St Edmund's", "Whitfield", "Pembury", "Old Cathedral", "Hartford"],
    suffixes: ["College", "Grammar School", "School"],
  },
  "struggling-academy": {
    prefixes: ["Tilbury Park", "Beechwood", "Lower Salter's", "Drayton East", "Carrowby Vale"],
    suffixes: ["Academy", "Free School", "Academy Trust"],
  },
  faith: {
    prefixes: ["St Cuthbert's", "St Aloysius'", "Sacred Heart", "All Saints", "St Olwen's"],
    suffixes: ["Catholic College", "Church of England School", "Faith Academy"],
  },
  "rural-small": {
    prefixes: ["Combe-under-Edge", "Hollanford", "Wickham Cross", "Old Furze", "Salter's End"],
    suffixes: ["Secondary", "Community School", "Village College"],
  },
};

const SIGNATURE_BLURBS: Record<SchoolArchetype, string[]> = {
  "average-state": [
    "Steady, unspectacular, the sort the council photographs for brochures.",
    "Big roll, middle of the table, no scandal in living memory.",
    "Decent ofsted, decent results, decent staffroom biscuits.",
  ],
  "elite-selective": [
    "Cathedral-quiet corridors and a results spread that begins at A.",
    "Three former Chief Inspectors on the foundation. They visit.",
    "Parents lobby for it before their children are born.",
  ],
  "struggling-academy": [
    "Three heads in four years; the staffroom is exhausted.",
    "On a trust improvement plan since the last Inadequate.",
    "Half the windows still don't close properly.",
  ],
  faith: [
    "The chair attends mass with the bishop.",
    "Liturgy, league tables, and league cricket — in that order.",
    "Quiet, devout, attentive parents.",
  ],
  "rural-small": [
    "Eighty pupils a year and a minibus rota everyone hates.",
    "Last bus at 4:15. Clubs are short.",
    "Everyone knows everyone, for better and for worse.",
  ],
};

function pickArchetypeName(rng: RNG, archetype: SchoolArchetype, used: Set<string>): string {
  const pool = NAME_POOLS[archetype];
  for (let i = 0; i < 8; i++) {
    const name = `${rng.pick(pool.prefixes)} ${rng.pick(pool.suffixes)}`;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  // Fallback — append a number to disambiguate.
  const name = `${rng.pick(pool.prefixes)} ${rng.pick(pool.suffixes)} ${rng.int(2, 9)}`;
  used.add(name);
  return name;
}

function tierForArchetype(rng: RNG, archetype: SchoolArchetype): number {
  switch (archetype) {
    case "elite-selective":
      return rng.weighted([[4, 0.4], [5, 0.6]]);
    case "struggling-academy":
      return rng.weighted([[1, 0.55], [2, 0.45]]);
    case "faith":
      return rng.weighted([[2, 0.15], [3, 0.45], [4, 0.4]]);
    case "rural-small":
      return rng.weighted([[2, 0.4], [3, 0.5], [4, 0.1]]);
    case "average-state":
    default:
      return rng.weighted([[2, 0.2], [3, 0.5], [4, 0.3]]);
  }
}

function gradeForTier(tier: number): School["inspectionGrade"] {
  if (tier >= 5) return "Outstanding";
  if (tier >= 4) return "Good";
  if (tier >= 2) return "Requires Improvement";
  return "Inadequate";
}

function biasForArchetype(rng: RNG, archetype: SchoolArchetype): GovernorBias {
  const base: GovernorBias = {
    business: rng.bounded(0.4, 0.15, 0.05, 0.85),
    exteacher: rng.bounded(0.4, 0.15, 0.05, 0.85),
    councillor: rng.bounded(0.4, 0.15, 0.05, 0.85),
    parent: rng.bounded(0.4, 0.15, 0.05, 0.85),
    faith: rng.bounded(0.2, 0.1, 0.0, 0.7),
    eminence: rng.bounded(0.3, 0.15, 0.05, 0.8),
  };
  switch (archetype) {
    case "elite-selective":
      base.eminence = 0.85;
      base.business = 0.6;
      base.faith = 0.4;
      break;
    case "struggling-academy":
      base.business = 0.85;
      base.councillor = 0.35;
      base.exteacher = 0.25;
      break;
    case "faith":
      base.faith = 0.9;
      base.parent = 0.7;
      break;
    case "rural-small":
      base.parent = 0.8;
      base.councillor = 0.7;
      break;
    case "average-state":
      base.parent = 0.6;
      break;
  }
  return base;
}

function expectationsForArchetype(rng: RNG, archetype: SchoolArchetype): ExpectationsVector {
  const e: ExpectationsVector = {
    resultsPressure: rng.bounded(0.5, 0.1, 0.2, 0.95),
    behaviourPressure: rng.bounded(0.5, 0.1, 0.2, 0.95),
    budgetDiscipline: rng.bounded(0.5, 0.1, 0.2, 0.95),
    innovation: rng.bounded(0.4, 0.1, 0.1, 0.85),
    communityVisibility: rng.bounded(0.4, 0.1, 0.1, 0.85),
  };
  switch (archetype) {
    case "elite-selective":
      e.resultsPressure = 0.9;
      e.behaviourPressure = 0.55;
      e.budgetDiscipline = 0.5;
      break;
    case "struggling-academy":
      e.resultsPressure = 0.85;
      e.behaviourPressure = 0.9;
      e.budgetDiscipline = 0.85;
      break;
    case "faith":
      e.behaviourPressure = 0.8;
      e.communityVisibility = 0.75;
      break;
    case "rural-small":
      e.communityVisibility = 0.85;
      e.behaviourPressure = 0.5;
      break;
    case "average-state":
      break;
  }
  return e;
}

function capacityForArchetype(rng: RNG, archetype: SchoolArchetype): number {
  switch (archetype) {
    case "rural-small":
      return rng.int(350, 500);
    case "elite-selective":
      return rng.int(700, 900);
    case "struggling-academy":
      return rng.int(800, 1100);
    case "faith":
      return rng.int(600, 800);
    default:
      return rng.int(700, 1000);
  }
}

function typeForArchetype(rng: RNG, archetype: SchoolArchetype): School["type"] {
  switch (archetype) {
    case "elite-selective":
      return rng.chance(0.6) ? "independent" : "state";
    case "struggling-academy":
      return "academy";
    case "faith":
      return rng.chance(0.4) ? "academy" : "state";
    default:
      return rng.chance(0.3) ? "academy" : "state";
  }
}

function salaryForArchetype(archetype: SchoolArchetype, tier: number): number {
  const base = 75000;
  const tierBonus = tier * 8000;
  const archetypeBonus = archetype === "elite-selective" ? 25000 : archetype === "rural-small" ? -8000 : 0;
  return base + tierBonus + archetypeBonus;
}

function makeSectorHead(rng: RNG, schoolId: ID, tier: number): SectorHead {
  const sex: "f" | "m" = rng.chance(0.5) ? "f" : "m";
  return {
    id: makeId("sh", rng),
    givenName: firstName(rng, sex),
    surname: surname(rng),
    sex,
    age: rng.int(38, 64),
    yearsAtSchool: rng.int(0, 12),
    reputationPublic: Math.round(35 + tier * 10 + rng.int(-8, 8)),
    reputationPrivate: Math.round(40 + tier * 8 + rng.int(-8, 8)),
    schoolId,
    inadequateStreak: 0,
  };
}

export function generateSector(rng: RNG): Sector {
  const sector: Sector = {
    schools: {},
    sectorHeads: {},
    vacancies: {},
    applications: {},
    memorablePupils: {},
    trashTalk: [],
    lastWaveFiredYear: {},
  };

  const usedNames = new Set<string>();
  const usedTowns = new Set<string>();

  const composition = CONFIG.sectorComposition;
  for (const [archetype, count] of Object.entries(composition) as Array<[SchoolArchetype, number]>) {
    for (let i = 0; i < count; i++) {
      const name = pickArchetypeName(rng, archetype, usedNames);
      let town = townName(rng);
      // Lightly try to diversify towns.
      for (let attempt = 0; attempt < 4 && usedTowns.has(town); attempt++) town = townName(rng);
      usedTowns.add(town);

      const tier = tierForArchetype(rng, archetype);
      const id = makeId("ss", rng);
      const head = makeSectorHead(rng, id, tier);
      const blurbs = SIGNATURE_BLURBS[archetype];
      const signature = blurbs[rng.int(0, blurbs.length - 1)]!;

      const ss: SectorSchool = {
        id,
        name,
        town,
        type: typeForArchetype(rng, archetype),
        archetype,
        capacity: capacityForArchetype(rng, archetype),
        reputationTier: tier,
        currentGrade: gradeForTier(tier),
        headId: head.id,
        yearsSinceTurnover: rng.int(0, 6),
        signature,
        governorBias: biasForArchetype(rng, archetype),
        expectations: expectationsForArchetype(rng, archetype),
        salaryBand: salaryForArchetype(archetype, tier),
      };
      sector.schools[id] = ss;
      sector.sectorHeads[head.id] = head;
    }
  }

  return sector;
}

// Year-tick. Returns the ids of SectorSchools whose head left this year
// (these become vacancies later in the year via runVacancyWave). This
// function is called once per year just before vacancy waves; voluntary
// moves and retirements are batched up front, then distributed across
// the three calendar waves.
export interface SectorYearOutcome {
  newlyVacantSchoolIds: ID[];
  retiredHeadIds: ID[];
  sackedHeadIds: ID[];
  movedHeadIds: ID[];
}

export function tickSectorYear(state: GameState, rng: RNG): SectorYearOutcome {
  const out: SectorYearOutcome = {
    newlyVacantSchoolIds: [],
    retiredHeadIds: [],
    sackedHeadIds: [],
    movedHeadIds: [],
  };

  for (const head of Object.values(state.sector.sectorHeads)) {
    head.age += 1;
    head.yearsAtSchool += 1;
  }

  // Drift sector-school grades very lightly so the world doesn't stay frozen
  // around the player. Independent of player; gates trash-talk events.
  for (const ss of Object.values(state.sector.schools)) {
    ss.yearsSinceTurnover += 1;
    // Small chance of a grade nudge.
    if (rng.chance(0.05)) {
      const ladder = ["Inadequate", "Requires Improvement", "Good", "Outstanding"] as const;
      let idx = ladder.indexOf(ss.currentGrade);
      const dir = rng.chance(0.5) ? 1 : -1;
      idx = Math.max(0, Math.min(3, idx + dir));
      ss.currentGrade = ladder[idx]!;
      // Track inadequate streak for sacking.
      const head = ss.headId ? state.sector.sectorHeads[ss.headId] : null;
      if (head) {
        if (ss.currentGrade === "Inadequate") head.inadequateStreak += 1;
        else head.inadequateStreak = 0;
      }
    }
  }

  // Retirements (age) and sackings (consecutive Inadequate).
  for (const head of Object.values(state.sector.sectorHeads)) {
    if (head.age >= CONFIG.npcRetirementAge) {
      out.retiredHeadIds.push(head.id);
      out.newlyVacantSchoolIds.push(head.schoolId);
      continue;
    }
    if (head.inadequateStreak >= CONFIG.npcInadequateSackingStreak) {
      out.sackedHeadIds.push(head.id);
      out.newlyVacantSchoolIds.push(head.schoolId);
      continue;
    }
    if (rng.chance(CONFIG.npcVoluntaryMoveChance)) {
      out.movedHeadIds.push(head.id);
      out.newlyVacantSchoolIds.push(head.schoolId);
    }
  }

  // Apply departures: remove the NPC head from the sector school and (chance)
  // emit trash-talk targeting the player.
  for (const headId of [...out.retiredHeadIds, ...out.sackedHeadIds, ...out.movedHeadIds]) {
    const head = state.sector.sectorHeads[headId];
    if (!head) continue;
    const ss = state.sector.schools[head.schoolId];
    if (ss && ss.headId === headId) {
      ss.headId = null;
      ss.yearsSinceTurnover = 0;
    }
    delete state.sector.sectorHeads[headId];
    if (rng.chance(CONFIG.trashTalkChance) && state.school != null) {
      emitTrashTalk(state, rng, head, ss);
    }
  }

  return out;
}

const TRASH_TALK_LINES: string[] = [
  "an unconventional approach to discipline, shall we say",
  "results-led, in the loosest sense of the term",
  "a Head who has, perhaps, never been in a corridor at break",
  "fond of the press, less fond of the staffroom",
  "a memorable career — and we shall remember it",
  "ambitious. The school felt it",
  "I gather the deputy did most of the heavy lifting",
];

function emitTrashTalk(
  state: GameState,
  rng: RNG,
  head: SectorHead,
  ss: SectorSchool | null | undefined,
): void {
  const line = TRASH_TALK_LINES[rng.int(0, TRASH_TALK_LINES.length - 1)]!;
  const entry: TrashTalkEntry = {
    id: makeId("tt", rng),
    fromHeadName: `${head.givenName} ${head.surname}`,
    fromSchoolName: ss?.name ?? "an unnamed school",
    year: state.schoolYearStart,
    quote: line,
    privateRepDelta: -CONFIG.trashTalkPrivateRepDing,
  };
  state.sector.trashTalk.push(entry);
  // Cap entries to keep saves slim.
  if (state.sector.trashTalk.length > 60) {
    state.sector.trashTalk.splice(0, state.sector.trashTalk.length - 60);
  }
  state.headteacher.reputationPrivate = Math.max(
    0,
    state.headteacher.reputationPrivate - CONFIG.trashTalkPrivateRepDing,
  );
}

// Choose which sector schools' vacancies surface in a given wave. We bucket
// pending vacancies (those with no head) by wave-share fractions: most land
// in the summer wave.
export function pickWaveVacancies(
  pending: ID[],
  wave: VacancyWave,
  rng: RNG,
): ID[] {
  const share = CONFIG.waveTurnoverShare[wave];
  const out: ID[] = [];
  for (const id of pending) {
    if (rng.chance(share)) out.push(id);
  }
  return out;
}

// Backfill a sector head onto a vacant school after a vacancy is filled by a
// rival NPC (i.e. the player did not win it). Creates a fresh NPC head.
export function backfillSectorHead(state: GameState, rng: RNG, schoolId: ID): void {
  const ss = state.sector.schools[schoolId];
  if (!ss || ss.headId != null) return;
  const head = makeSectorHead(rng, schoolId, ss.reputationTier);
  ss.headId = head.id;
  ss.yearsSinceTurnover = 0;
  state.sector.sectorHeads[head.id] = head;
}
