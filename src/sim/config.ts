// Phase-3 tunables. Centralised so playtest can ease them without a hunt
// through engine code. Anything that "feels too harsh" or "too easy" should
// be a constant here.

export const CONFIG = {
  // Pupil counts as memorable if they accumulate at least this many incidents
  // in a single year (or were ever in topPerformers/concernPupils, or were
  // manually flagged). Stored on MemorablePupil for cross-school search.
  memorablePupilIncidentThreshold: 10,

  // Sector size, by archetype. Total 20.
  sectorComposition: {
    "average-state": 10,
    "elite-selective": 3,
    "struggling-academy": 3,
    faith: 2,
    "rural-small": 2,
  } as const,

  // NPC head turnover odds per year, before age-based retirement.
  npcVoluntaryMoveChance: 0.08,
  npcRetirementAge: 75,
  npcInadequateSackingStreak: 2,

  // Per-wave fraction of pending turnovers that surface as vacancies.
  // Summer absorbs the biggest share (incl. cascading vacancies from
  // earlier-wave hires moving away).
  waveTurnoverShare: {
    "post-christmas": 0.15,
    "post-easter": 0.2,
    summer: 0.65,
  } as const,

  // Reputation thresholds for the hireability floor. Both must fall below
  // these for vacancies to refuse the player automatically. After this many
  // consecutive years unemployed, career ends.
  hireabilityFloorPublic: 18,
  hireabilityFloorPrivate: 18,
  unhireableYearsToCareerEnd: 3,

  // Sacking → reputation hit (applied to both public and private).
  sackingReputationHit: 18,

  // Trash-talk probability per NPC turnover event, and per-event ding.
  trashTalkChance: 0.18,
  trashTalkPrivateRepDing: 2,

  // Year-end reputation drift for an in-post head: tenure rewards stability.
  tenureRewardPerYear: 1.2,

  // Expectations check sensitivity.
  expectationsHitMagnitude: 8,
  promiseHitMagnitude: 12,

  // Days between submission and the panel decision. A realistic fortnight —
  // schools say "we'll let you know by the end of next week" and they do.
  interviewLeadDays: 14,

  // Days a vacancy stays open before a rival fills it (if no player
  // application is pending by then). Long enough to give the player a
  // genuine choice, short enough that the sector doesn't sit on vacancies
  // for half a year.
  vacancyOpenDays: 45,

  // Interview scoring.
  interviewQuestionCount: 11,
  interviewBaselineWeights: {
    publicRep: 0.5,
    privateRep: 0.2,
    attributeFit: 0.3,
  },

  // Force-retire age.
  forceRetireAge: 75,
} as const;
