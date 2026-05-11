// Perk registry. Each perk is a small tagged effect: attribute nudges,
// governor-bias affinities applied during interview scoring, and starting
// reputation tweaks. Adding new perks is a matter of dropping a new entry
// into PERKS — engine code references them by id only.

import type { GovernorBias, Headteacher, PerkId } from "./types.ts";

export interface PerkDef {
  id: PerkId;
  label: string;
  flavour: string;
  effect: string;
  attrBumps?: Partial<Headteacher["attrs"]>;
  governorAffinity?: Partial<GovernorBias>;
  publicRepBump?: number;
  privateRepBump?: number;
}

export const PERKS: Readonly<Record<PerkId, PerkDef>> = {
  "data-wonk": {
    id: "data-wonk",
    label: "Data wonk",
    flavour: "You know every progress-8 quartile by heart.",
    effect: "+2 pedagogy, +2 finance, governors who love evidence warm to you.",
    attrBumps: { pedagogy: 2, finance: 2 },
    governorAffinity: { business: 0.1, eminence: 0.1 },
  },
  "silver-tongue": {
    id: "silver-tongue",
    label: "Silver tongue",
    flavour: "Press calls trail off into laughter at your jokes.",
    effect: "+3 charisma, +1 politics, +5 starting public reputation.",
    attrBumps: { charisma: 3, politics: 1 },
    publicRepBump: 5,
  },
  "safe-pair-of-hands": {
    id: "safe-pair-of-hands",
    label: "Safe pair of hands",
    flavour: "You have never lost a Chair of Governors.",
    effect: "+2 leadership, +5 starting private reputation, +ex-teacher affinity.",
    attrBumps: { leadership: 2 },
    privateRepBump: 5,
    governorAffinity: { exteacher: 0.1, councillor: 0.05 },
  },
  reformer: {
    id: "reformer",
    label: "Reformer",
    flavour: "You like the word 'transformational'. Probably too much.",
    effect: "+2 leadership, +2 politics, struggling schools welcome you.",
    attrBumps: { leadership: 2, politics: 2 },
    governorAffinity: { business: 0.1, parent: 0.05 },
  },
  "old-boys-network": {
    id: "old-boys-network",
    label: "Old boys' network",
    flavour: "You know which Chair drinks with which MP.",
    effect: "+3 politics, eminent / faith governors take your calls.",
    attrBumps: { politics: 3 },
    governorAffinity: { eminence: 0.15, faith: 0.05 },
  },
  "local-hero": {
    id: "local-hero",
    label: "Local hero",
    flavour: "You went to school here. Half the staff taught you.",
    effect: "+2 pastoral, +2 charisma, parent / councillor governors love you.",
    attrBumps: { pastoral: 2, charisma: 2 },
    governorAffinity: { parent: 0.1, councillor: 0.1 },
  },
};

export function listPerks(): readonly PerkDef[] {
  return Object.values(PERKS);
}

export function applyPerks(headteacher: Headteacher): void {
  for (const id of headteacher.perks) {
    const def = PERKS[id];
    if (!def) continue;
    if (def.attrBumps) {
      for (const [k, v] of Object.entries(def.attrBumps) as Array<
        [keyof Headteacher["attrs"], number]
      >) {
        headteacher.attrs[k] = clamp1to20(headteacher.attrs[k] + v);
      }
    }
    if (def.publicRepBump)
      headteacher.reputationPublic = clamp0to100(
        headteacher.reputationPublic + def.publicRepBump,
      );
    if (def.privateRepBump)
      headteacher.reputationPrivate = clamp0to100(
        headteacher.reputationPrivate + def.privateRepBump,
      );
  }
}

export function perkAffinity(headteacher: Headteacher): GovernorBias {
  const a: GovernorBias = {
    business: 0,
    exteacher: 0,
    councillor: 0,
    parent: 0,
    faith: 0,
    eminence: 0,
  };
  for (const id of headteacher.perks) {
    const def = PERKS[id];
    if (!def || !def.governorAffinity) continue;
    for (const [k, v] of Object.entries(def.governorAffinity) as Array<
      [keyof GovernorBias, number]
    >) {
      a[k] += v;
    }
  }
  return a;
}

function clamp1to20(v: number): number {
  return Math.max(1, Math.min(20, Math.round(v)));
}
function clamp0to100(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

// Background archetypes: attribute starting points + a flavour blurb.

export interface BackgroundDef {
  id: import("./types.ts").BackgroundArchetype;
  label: string;
  blurb: string;
  attrs: Headteacher["attrs"];
  startingPublicRep: number;
  startingPrivateRep: number;
}

export const BACKGROUNDS: Readonly<
  Record<import("./types.ts").BackgroundArchetype, BackgroundDef>
> = {
  "career-teacher": {
    id: "career-teacher",
    label: "Career teacher",
    blurb: "Twenty years in a classroom before the Head's office.",
    attrs: { leadership: 11, politics: 8, pedagogy: 16, pastoral: 14, finance: 8, charisma: 11 },
    startingPublicRep: 50,
    startingPrivateRep: 55,
  },
  "politicking-deputy": {
    id: "politicking-deputy",
    label: "Politicking deputy",
    blurb: "You have managed up your whole career. It shows.",
    attrs: { leadership: 13, politics: 16, pedagogy: 11, pastoral: 10, finance: 12, charisma: 13 },
    startingPublicRep: 55,
    startingPrivateRep: 50,
  },
  "outsider-from-industry": {
    id: "outsider-from-industry",
    label: "Outsider from industry",
    blurb: "Hired for the MBA. The staffroom is wary.",
    attrs: { leadership: 14, politics: 12, pedagogy: 7, pastoral: 8, finance: 16, charisma: 12 },
    startingPublicRep: 55,
    startingPrivateRep: 40,
  },
  international: {
    id: "international",
    label: "International returnee",
    blurb: "Three British schools abroad. Now home.",
    attrs: { leadership: 13, politics: 11, pedagogy: 13, pastoral: 12, finance: 11, charisma: 13 },
    startingPublicRep: 52,
    startingPrivateRep: 50,
  },
  legacy: {
    id: "legacy",
    label: "Legacy appointment",
    blurb: "Your parent was a Chief Inspector. People remember.",
    attrs: { leadership: 12, politics: 14, pedagogy: 11, pastoral: 11, finance: 11, charisma: 14 },
    startingPublicRep: 60,
    startingPrivateRep: 55,
  },
};

export function listBackgrounds(): readonly BackgroundDef[] {
  return Object.values(BACKGROUNDS);
}
