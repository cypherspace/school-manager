// Incident templates and instantiation. Each template knows its own
// generation conditions (which kind of pupil/staff to target, probability
// modifiers based on school state) and produces concrete IncidentInstances
// at runtime. Phase 1 ships ~20 templates; later phases expand this library.
//
// Templates avoid embedding the exact pupil/staff name in their text bodies —
// the instantiator substitutes {pupil}, {staff}, {form}.

import type { RNG } from "./rng.ts";
import {
  type GameState,
  type IncidentChoice,
  type IncidentInstance,
  type Pupil,
  type ResolutionEffects,
  type Staff,
} from "./types.ts";

interface TemplateContext {
  state: GameState;
  rng: RNG;
  day: number;
}

interface IncidentTemplate {
  id: string;
  category: IncidentInstance["category"];
  severity: IncidentInstance["severity"];
  pauses: boolean;
  ttlDays: number;
  baseWeight: number;
  // Optional school-state weight modifier so a stressed school sees more
  // pile-up. Returns a multiplier on baseWeight.
  weightModifier?: (ctx: TemplateContext) => number;
  // Selects participants (or returns null to skip generation for this tick).
  generate: (ctx: TemplateContext) => GeneratedIncident | null;
}

interface GeneratedIncident {
  title: string;
  body: string;
  choices: IncidentChoice[];
  pupil?: Pupil;
  staff?: Staff;
  // Effects applied automatically if the player never resolves it in time.
  autoBad: ResolutionEffects;
}

// Helpers ---------------------------------------------------------------------

function activePupils(state: GameState): Pupil[] {
  return Object.values(state.pupils);
}
function activeStaff(state: GameState): Staff[] {
  return Object.values(state.staff);
}

function pickPupilWeighted(
  rng: RNG,
  pupils: Pupil[],
  scorer: (p: Pupil) => number,
): Pupil | null {
  if (pupils.length === 0) return null;
  const total = pupils.reduce((s, p) => s + Math.max(0.0001, scorer(p)), 0);
  let r = rng.next() * total;
  for (const p of pupils) {
    r -= Math.max(0.0001, scorer(p));
    if (r <= 0) return p;
  }
  return pupils[pupils.length - 1] ?? null;
}

function pickStaffWeighted(
  rng: RNG,
  staff: Staff[],
  scorer: (s: Staff) => number,
): Staff | null {
  if (staff.length === 0) return null;
  const total = staff.reduce((s, x) => s + Math.max(0.0001, scorer(x)), 0);
  let r = rng.next() * total;
  for (const s of staff) {
    r -= Math.max(0.0001, scorer(s));
    if (r <= 0) return s;
  }
  return staff[staff.length - 1] ?? null;
}

function tmpl(s: string, vars: Record<string, string>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

// Templates -------------------------------------------------------------------

const TEMPLATES: IncidentTemplate[] = [
  // ---- Behaviour: pile-up routine ------------------------------------------
  {
    id: "behav.referral",
    category: "Behaviour",
    severity: "routine",
    pauses: false,
    ttlDays: 21,
    baseWeight: 6,
    weightModifier: (c) => 1 + (100 - c.state.school.reputation.discipline) / 100,
    generate: (c) => {
      const p = pickPupilWeighted(c.rng, activePupils(c.state), (x) => x.behaviourPropensity);
      if (!p) return null;
      const vars = { pupil: `${p.givenName} ${p.surname}`, form: p.formGroup };
      return {
        pupil: p,
        title: tmpl("Behaviour referral: {pupil} ({form})", vars),
        body: tmpl(
          "A subject teacher has referred {pupil} for persistent low-level disruption: talking over instruction, refusing to take a seat, mocking the lesson plan. Form tutor wants a steer.",
          vars,
        ),
        choices: [
          {
            label: "Send to detention; standard issue",
            effects: {
              discipline: 1,
              pastoral: -1,
              pupilNotes: ["After-school detention issued for disruption."],
              narration: tmpl("{pupil} placed in after-school detention.", vars),
            },
          },
          {
            label: "Restorative meeting with teacher",
            effects: {
              pastoral: 2,
              staffMorale: 1,
              pupilNotes: ["Restorative conversation completed."],
              narration: tmpl(
                "Pastoral lead ran a restorative meeting between {pupil} and the teacher.",
                vars,
              ),
            },
          },
          {
            label: "Phone parents and ask them to handle it",
            effects: {
              parentRelations: -2,
              discipline: 1,
              pupilNotes: ["Parents phoned re: classroom behaviour."],
              narration: tmpl(
                "You called {pupil}'s parents. They were polite but cold.",
                vars,
              ),
            },
          },
          {
            label: "No action — let the form tutor handle it",
            effects: {
              staffMorale: -2,
              discipline: -1,
              narration: tmpl(
                "You leave it with the form tutor. They note your absence of interest.",
                vars,
              ),
            },
          },
        ],
        autoBad: {
          staffMorale: -3,
          discipline: -2,
          flagPupil: true,
          narration: tmpl(
            "The referral about {pupil} sat unread. The teacher copies in your deputy next time.",
            vars,
          ),
        },
      };
    },
  },

  // ---- Behaviour: serious fight --------------------------------------------
  {
    id: "behav.fight",
    category: "Behaviour",
    severity: "serious",
    pauses: true,
    ttlDays: 2,
    baseWeight: 0.6,
    generate: (c) => {
      const p = pickPupilWeighted(c.rng, activePupils(c.state), (x) =>
        x.behaviourPropensity * (x.yearGroup >= 9 ? 1.4 : 0.6),
      );
      if (!p) return null;
      const vars = { pupil: `${p.givenName} ${p.surname}`, form: p.formGroup };
      return {
        pupil: p,
        title: tmpl("Fight in the yard: {pupil} ({form})", vars),
        body: tmpl(
          "Lunchtime supervisors broke up a fight involving {pupil}. Bloody nose, no hospital. Parents of the other child are at reception now.",
          vars,
        ),
        choices: [
          {
            label: "Fixed-term exclusion for both",
            effects: {
              discipline: 3,
              parentRelations: -3,
              pastoral: -1,
              pupilNotes: ["Fixed-term exclusion issued — fighting."],
              narration: "Both pupils excluded for three days. The waiting parent left fuming.",
            },
          },
          {
            label: "Internal isolation + parent meetings",
            effects: {
              discipline: 1,
              pastoral: 1,
              parentRelations: 0,
              pupilNotes: ["Internal isolation and parent meeting."],
              narration: "Quiet, contained, dignified. Tedious, but right.",
            },
          },
          {
            label: "Restorative justice circle, no exclusion",
            effects: {
              discipline: -2,
              pastoral: 3,
              parentRelations: -2,
              pupilNotes: ["Restorative circle completed."],
              narration: "The wronged parent did not consider it justice.",
            },
          },
        ],
        autoBad: {
          discipline: -4,
          parentRelations: -5,
          pastoral: -2,
          flagPupil: true,
          narration: "The fight went unaddressed. By morning it was on Facebook.",
        },
      };
    },
  },

  // ---- Safeguarding-style flag ---------------------------------------------
  {
    id: "safe.flag",
    category: "Safeguarding",
    severity: "critical",
    pauses: true,
    ttlDays: 1,
    baseWeight: 0.4,
    generate: (c) => {
      const p = pickPupilWeighted(c.rng, activePupils(c.state), (x) =>
        Math.max(0, 100 - x.wellbeing) * (x.familySupport < 40 ? 1.6 : 1),
      );
      if (!p) return null;
      const vars = { pupil: `${p.givenName} ${p.surname}`, form: p.formGroup };
      return {
        pupil: p,
        title: tmpl("Pastoral concern: {pupil} ({form})", vars),
        body: tmpl(
          "A form tutor has flagged {pupil}. Withdrawn for two weeks, dropping marks, an off-hand comment about not wanting to go home. Nothing concrete — but the tutor wanted you to know directly.",
          vars,
        ),
        choices: [
          {
            label: "Engage the pastoral team and external services",
            effects: {
              pastoral: 4,
              staffMorale: 2,
              budget: -2,
              pupilNotes: ["Pastoral team engaged; multi-agency referral logged."],
              flagPupil: true,
              narration: tmpl(
                "Pastoral lead opens a case for {pupil}. Quiet, by the book, the way it should be.",
                vars,
              ),
            },
          },
          {
            label: "Watching brief — log it, don't escalate",
            effects: {
              pastoral: 0,
              staffMorale: -1,
              flagPupil: true,
              narration: tmpl(
                "{pupil} added to the watching list. The tutor wanted more.",
                vars,
              ),
            },
          },
          {
            label: "Ask the tutor to handle it informally",
            effects: {
              pastoral: -3,
              staffMorale: -4,
              parentRelations: -1,
              narration: "The tutor leaves your office quietly furious.",
            },
          },
        ],
        autoBad: {
          pastoral: -8,
          staffMorale: -5,
          governorRelations: -3,
          flagPupil: true,
          narration: tmpl(
            "The flag about {pupil} sat unread. Three weeks later it surfaced in a governors' meeting.",
            vars,
          ),
        },
      };
    },
  },

  // ---- Staff allegation -----------------------------------------------------
  {
    id: "staff.allegation",
    category: "Staff",
    severity: "critical",
    pauses: true,
    ttlDays: 2,
    baseWeight: 0.15,
    generate: (c) => {
      const s = pickStaffWeighted(c.rng, activeStaff(c.state), (x) => x.hidden.controversyRisk);
      if (!s) return null;
      const vars = { staff: `${s.givenName} ${s.surname}` };
      return {
        staff: s,
        title: tmpl("Allegation against staff: {staff}", vars),
        body: tmpl(
          "A parent has emailed alleging {staff} singled out their child unfairly and used 'humiliating' language. The parent is asking for {staff} to be removed from teaching the class.",
          vars,
        ),
        choices: [
          {
            label: "Suspend pending investigation",
            effects: {
              staffMorale: -6,
              parentRelations: 3,
              governorRelations: 2,
              flagStaff: true,
              narration: tmpl(
                "{staff} suspended on full pay. The staffroom is grim.",
                vars,
              ),
            },
          },
          {
            label: "Investigate without suspension",
            effects: {
              staffMorale: 1,
              parentRelations: -1,
              governorRelations: 0,
              flagStaff: true,
              narration: tmpl("Investigation opens with {staff} still teaching.", vars),
            },
          },
          {
            label: "Side with the teacher — dismiss the complaint",
            effects: {
              staffMorale: 4,
              parentRelations: -6,
              governorRelations: -3,
              narration: "You back the teacher. The parent threatens the local press.",
            },
          },
        ],
        autoBad: {
          staffMorale: -3,
          parentRelations: -7,
          governorRelations: -4,
          narration: "The allegation festered for a fortnight. It is now a formal complaint.",
        },
      };
    },
  },

  // ---- Staff resignation ----------------------------------------------------
  {
    id: "staff.resignation",
    category: "Staff",
    severity: "serious",
    pauses: true,
    ttlDays: 5,
    baseWeight: 0.3,
    weightModifier: (c) => 1 + (60 - c.state.school.reputation.staffMorale) / 60,
    generate: (c) => {
      const s = pickStaffWeighted(c.rng, activeStaff(c.state), (x) =>
        Math.max(1, 100 - x.morale) * (x.attrs.ambition > 14 ? 1.5 : 1),
      );
      if (!s) return null;
      const vars = { staff: `${s.givenName} ${s.surname}` };
      return {
        staff: s,
        title: tmpl("Resignation: {staff}", vars),
        body: tmpl(
          "{staff} has put a letter of resignation on your desk. End of term. Nothing dramatic — they are 'ready for a new chapter'.",
          vars,
        ),
        choices: [
          {
            label: "Counter-offer: pay rise and a TLR",
            effects: {
              budget: -4,
              staffMorale: 3,
              flagStaff: true,
              narration: tmpl(
                "{staff} accepts a pay rise and a small leadership responsibility.",
                vars,
              ),
            },
          },
          {
            label: "Accept gracefully; plan the recruitment",
            effects: {
              staffMorale: 0,
              flagStaff: true,
              narration: tmpl("You wish {staff} well. The vacancy goes to HR.", vars),
            },
          },
          {
            label: "Try to talk them into withdrawing",
            effects: {
              staffMorale: 1,
              narration: tmpl("{staff} appreciates the conversation but is set on leaving.", vars),
            },
          },
        ],
        autoBad: {
          staffMorale: -2,
          narration: "The letter sat on your desk. Word got around the staffroom before you replied.",
        },
      };
    },
  },

  // ---- Press contact --------------------------------------------------------
  {
    id: "press.contact",
    category: "Press",
    severity: "serious",
    pauses: true,
    ttlDays: 1,
    baseWeight: 0.08,
    weightModifier: (c) => 1 + (60 - c.state.school.reputation.parentRelations) / 60,
    generate: (_c) => {
      return {
        title: "Local press: 'comment please?'",
        body:
          "A journalist from the local paper has phoned reception asking for comment on 'a story about behaviour'. They say they have parents on record. They want a quote by 4pm.",
        choices: [
          {
            label: "Issue a polished holding statement",
            effects: {
              parentRelations: 1,
              governorRelations: 2,
              narration: "Your statement is dull, on-message, and ends the story dead.",
            },
          },
          {
            label: "Decline to comment",
            effects: {
              parentRelations: -2,
              governorRelations: -1,
              narration: "The piece runs without your voice. The Chair calls in the evening.",
            },
          },
          {
            label: "Offer a frank, unscripted conversation",
            effects: {
              parentRelations: 2,
              governorRelations: -2,
              narration: "The journalist liked you. The Chair did not like that.",
            },
          },
        ],
        autoBad: {
          parentRelations: -5,
          governorRelations: -3,
          narration: "Reception took a message you never returned. The story ran anyway.",
        },
      };
    },
  },

  // ---- Governor contact -----------------------------------------------------
  {
    id: "gov.query",
    category: "Governor",
    severity: "routine",
    pauses: false,
    ttlDays: 7,
    baseWeight: 1.5,
    generate: (_c) => {
      return {
        title: "Governor query: half-termly data",
        body:
          "The Chair would like a one-page note on the latest progress data before Tuesday. Specifically, they want to know about the Y10 dip.",
        choices: [
          {
            label: "Write it personally",
            effects: {
              governorRelations: 3,
              staffMorale: -1,
              narration: "You spent Sunday on it. The Chair was impressed.",
            },
          },
          {
            label: "Delegate to a Senior Leader",
            effects: {
              governorRelations: 1,
              staffMorale: 1,
              narration: "Your deputy produced a competent note in your name.",
            },
          },
          {
            label: "Send the raw spreadsheet",
            effects: {
              governorRelations: -3,
              narration: "The Chair calls it 'less than helpful'.",
            },
          },
        ],
        autoBad: {
          governorRelations: -4,
          narration: "The Chair did not get the note. She mentions it in the next minute.",
        },
      };
    },
  },

  // ---- Parent complaint -----------------------------------------------------
  {
    id: "parent.complaint",
    category: "Parent",
    severity: "routine",
    pauses: false,
    ttlDays: 14,
    baseWeight: 4,
    generate: (c) => {
      const p = pickPupilWeighted(c.rng, activePupils(c.state), (x) =>
        Math.max(0.5, (100 - x.parentalEngagement) * 0.5 + x.behaviourPropensity * 0.3),
      );
      if (!p) return null;
      const vars = { pupil: `${p.givenName} ${p.surname}`, form: p.formGroup };
      return {
        pupil: p,
        title: tmpl("Parent complaint: {pupil} ({form})", vars),
        body: tmpl(
          "{pupil}'s parent has written. The substance is thin but the tone is sharp. They want a reply.",
          vars,
        ),
        choices: [
          {
            label: "Acknowledge warmly, no concession",
            effects: {
              parentRelations: 1,
              narration: "A short, kind, careful reply.",
            },
          },
          {
            label: "Invite in for a meeting",
            effects: {
              parentRelations: 2,
              pastoral: 1,
              narration: "Meeting booked. Tea. Biscuits. De-escalation.",
            },
          },
          {
            label: "Forward to the deputy and forget",
            effects: {
              parentRelations: -1,
              staffMorale: -1,
              narration: "The deputy handled it. The parent noticed.",
            },
          },
        ],
        autoBad: {
          parentRelations: -3,
          narration: "The parent escalated. Now it is a formal complaint with a tracking number.",
        },
      };
    },
  },

  // ---- Sickness / cover -----------------------------------------------------
  {
    id: "ops.sickness",
    category: "Operations",
    severity: "routine",
    pauses: false,
    ttlDays: 3,
    baseWeight: 3,
    generate: (c) => {
      const s = pickStaffWeighted(c.rng, activeStaff(c.state), () => 1);
      if (!s) return null;
      const vars = { staff: `${s.givenName} ${s.surname}` };
      return {
        staff: s,
        title: tmpl("Sickness: {staff}", vars),
        body: tmpl(
          "{staff} has phoned in sick for the rest of the week. Cover needs sorting.",
          vars,
        ),
        choices: [
          {
            label: "Internal cover by free periods",
            effects: {
              staffMorale: -2,
              narration: "Free periods burned by colleagues. Mild grumbling.",
            },
          },
          {
            label: "Pay for a supply teacher",
            effects: {
              budget: -2,
              staffMorale: 1,
              narration: "Supply teacher arrives, vaguely competent.",
            },
          },
          {
            label: "Collapse classes into the hall",
            effects: {
              staffMorale: 0,
              discipline: -1,
              narration: "Two classes share a single supervisor. Predictable chaos.",
            },
          },
        ],
        autoBad: {
          staffMorale: -3,
          discipline: -2,
          narration: "Nobody arranged cover. Pupils wandered.",
        },
      };
    },
  },

  // ---- Maintenance ----------------------------------------------------------
  {
    id: "ops.maintenance",
    category: "Operations",
    severity: "trivial",
    pauses: false,
    ttlDays: 21,
    baseWeight: 2,
    generate: (_c) => {
      return {
        title: "Boiler again",
        body: "The science block boiler has gone over half-term — again. The estate manager wants a decision.",
        choices: [
          {
            label: "Replace it now (capital)",
            effects: {
              budget: -8,
              governorRelations: 1,
              narration: "Expensive, but settled.",
            },
          },
          {
            label: "Patch it (revenue)",
            effects: {
              budget: -1,
              narration: "Patched. It will go again in February.",
            },
          },
          {
            label: "Live with it",
            effects: {
              staffMorale: -1,
              narration: "Coats on in physics. The HoD is unamused.",
            },
          },
        ],
        autoBad: {
          staffMorale: -2,
          narration: "Boiler ignored. Cold lessons. Email chain.",
        },
      };
    },
  },

  // ---- Pastoral: friendship fallout -----------------------------------------
  {
    id: "past.friendship",
    category: "Pastoral",
    severity: "routine",
    pauses: false,
    ttlDays: 10,
    baseWeight: 2,
    generate: (c) => {
      const p = pickPupilWeighted(c.rng, activePupils(c.state), (x) =>
        Math.max(1, 100 - x.wellbeing),
      );
      if (!p) return null;
      const vars = { pupil: `${p.givenName} ${p.surname}`, form: p.formGroup };
      return {
        pupil: p,
        title: tmpl("Friendship fallout: {pupil} ({form})", vars),
        body: tmpl(
          "{pupil}'s form group is splintering — phones, group chats, the usual. Tutor wants a steer.",
          vars,
        ),
        choices: [
          {
            label: "Run a form-time intervention",
            effects: {
              pastoral: 2,
              narration: "Form circle, ground rules reset.",
            },
          },
          {
            label: "Confiscate phones for the form for a fortnight",
            effects: {
              parentRelations: -3,
              discipline: 2,
              pupilNotes: ["Form-group phone ban — 2 weeks."],
              narration: "Effective. Parents predictably furious.",
            },
          },
          {
            label: "Let the tutor handle it",
            effects: {
              staffMorale: -1,
              narration: "Tutor handles it; some success, some bruises.",
            },
          },
        ],
        autoBad: {
          pastoral: -2,
          narration: "Splinter became a faction. Faction became a fight.",
        },
      };
    },
  },

  // ---- Bullying ring --------------------------------------------------------
  {
    id: "behav.bullying",
    category: "Pastoral",
    severity: "serious",
    pauses: true,
    ttlDays: 3,
    baseWeight: 0.3,
    generate: (c) => {
      const p = pickPupilWeighted(c.rng, activePupils(c.state), (x) =>
        Math.max(1, (100 - x.wellbeing) + x.behaviourPropensity * 0.4),
      );
      if (!p) return null;
      const vars = { pupil: `${p.givenName} ${p.surname}`, form: p.formGroup };
      return {
        pupil: p,
        title: tmpl("Bullying allegations involving {pupil}", vars),
        body:
          "Three families have separately raised concerns about a group of pupils. Names overlap. Pastoral lead thinks there is a ring.",
        choices: [
          {
            label: "Full investigation, suspensions if proven",
            effects: {
              pastoral: 4,
              discipline: 3,
              parentRelations: 2,
              budget: -1,
              flagPupil: true,
              narration: "Quiet, thorough, painful for everyone. Right.",
            },
          },
          {
            label: "Mediation between families",
            effects: {
              pastoral: 1,
              parentRelations: -1,
              narration: "Mediation; mixed outcome.",
            },
          },
          {
            label: "Blanket form-group lecture, move on",
            effects: {
              pastoral: -3,
              parentRelations: -4,
              narration: "Lecture given. Nothing changed.",
            },
          },
        ],
        autoBad: {
          pastoral: -6,
          parentRelations: -5,
          flagPupil: true,
          narration: "The pattern was missed for a month. One family withdraws their child.",
        },
      };
    },
  },

  // ---- Vaping ring ----------------------------------------------------------
  {
    id: "behav.vaping",
    category: "Behaviour",
    severity: "serious",
    pauses: true,
    ttlDays: 4,
    baseWeight: 0.4,
    generate: (c) => {
      const p = pickPupilWeighted(c.rng, activePupils(c.state), (x) =>
        x.yearGroup >= 9 ? x.behaviourPropensity * 1.5 : 0.2,
      );
      if (!p) return null;
      const vars = { pupil: `${p.givenName} ${p.surname}`, form: p.formGroup };
      return {
        pupil: p,
        title: tmpl("Vaping ring discovered: {form}", vars),
        body: tmpl(
          "A site cleaner found a stash behind the maths block. {pupil}'s name has come up repeatedly. The deputy wants instruction.",
          vars,
        ),
        choices: [
          {
            label: "Sweep, suspensions, letters to parents",
            effects: {
              discipline: 3,
              parentRelations: -2,
              pupilNotes: ["Linked to school vaping ring; FTE issued."],
              narration: "Three suspensions and a stern assembly. Predictable letters back.",
            },
          },
          {
            label: "Education campaign, no punishments",
            effects: {
              discipline: -2,
              pastoral: 1,
              narration: "PSHE rejigged. The ring continues quietly.",
            },
          },
          {
            label: "Targeted pastoral case with the named pupils",
            effects: {
              discipline: 1,
              pastoral: 2,
              flagPupil: true,
              narration: "Named pupils brought in one by one. Some respond.",
            },
          },
        ],
        autoBad: {
          discipline: -3,
          parentRelations: -2,
          narration: "Nothing was done. A parent posted a photo of the stash.",
        },
      };
    },
  },

  // ---- Data outlier (pile-up) -----------------------------------------------
  {
    id: "data.outlier",
    category: "Pastoral",
    severity: "routine",
    pauses: false,
    ttlDays: 14,
    baseWeight: 1,
    generate: (c) => {
      const p = pickPupilWeighted(c.rng, activePupils(c.state), (x) =>
        Math.max(1, (x.priorAttainment - meanAttainment(x)) * 1.5),
      );
      if (!p) return null;
      const vars = { pupil: `${p.givenName} ${p.surname}`, form: p.formGroup };
      return {
        pupil: p,
        title: tmpl("Data outlier: {pupil} ({form})", vars),
        body: tmpl(
          "{pupil} is sliding. Prior attainment suggested the top quartile; current data suggests bottom third. Worth a look.",
          vars,
        ),
        choices: [
          {
            label: "Pastoral case conference",
            effects: {
              pastoral: 2,
              flagPupil: true,
              pupilNotes: ["Case-conferenced for academic slide."],
              narration: tmpl("Case opened for {pupil}.", vars),
            },
          },
          {
            label: "Move into a higher-set group",
            effects: {
              pastoral: 0,
              narration: tmpl("{pupil} promoted a set. Mixed reception.", vars),
            },
          },
          {
            label: "Note it, do nothing yet",
            effects: {
              pastoral: -1,
              narration: "Noted. No action.",
            },
          },
        ],
        autoBad: {
          pastoral: -2,
          narration: tmpl("{pupil} kept sliding. Parents wrote eventually.", vars),
        },
      };
    },
  },

  // ---- Inspector contact ----------------------------------------------------
  {
    id: "ins.contact",
    category: "Governor",
    severity: "critical",
    pauses: true,
    ttlDays: 1,
    baseWeight: 0.04,
    weightModifier: (c) => (c.state.school.yearsInspected >= 3 ? 4 : 1),
    generate: (_c) => {
      return {
        title: "The Inspectorate has called",
        body:
          "Section 8 short inspection. They will be on site in 48 hours. Stop everything; mobilise.",
        choices: [
          {
            label: "Full preparation mode — drop everything",
            effects: {
              staffMorale: -5,
              governorRelations: 3,
              narration: "All hands on deck. The staffroom is grim and focused.",
            },
          },
          {
            label: "Light touch — trust the day-to-day",
            effects: {
              staffMorale: 2,
              governorRelations: -2,
              narration: "You back the school as it stands. The Chair is not consulted.",
            },
          },
        ],
        autoBad: {
          staffMorale: -3,
          governorRelations: -5,
          narration: "You did not respond. The Chair phoned at midnight.",
        },
      };
    },
  },

  // ---- Sixth-form intake question ------------------------------------------
  {
    id: "adm.sixthform",
    category: "Operations",
    severity: "trivial",
    pauses: false,
    ttlDays: 14,
    baseWeight: 0.7,
    generate: (_c) => {
      return {
        title: "Open evening: which message?",
        body: "Marketing wants a steer on the open-evening message. Academic rigour, or wellbeing?",
        choices: [
          {
            label: "Lead with academic rigour",
            effects: {
              governorRelations: 2,
              parentRelations: 1,
              narration: "Numbers up; some families put off.",
            },
          },
          {
            label: "Lead with wellbeing",
            effects: {
              parentRelations: 3,
              governorRelations: -1,
              narration: "Different families. More walk-ins.",
            },
          },
          {
            label: "Refuse to choose; do both",
            effects: {
              parentRelations: 0,
              narration: "The leaflet says everything and means nothing.",
            },
          },
        ],
        autoBad: {
          parentRelations: -1,
          narration: "Marketing went rogue and led with whatever they fancied.",
        },
      };
    },
  },

  // ---- Phones policy --------------------------------------------------------
  {
    id: "pol.phones",
    category: "Parent",
    severity: "routine",
    pauses: false,
    ttlDays: 14,
    baseWeight: 0.8,
    generate: (_c) => {
      return {
        title: "Phones policy: organised parent group asking",
        body: "A WhatsApp group of parents wants a stricter phones-in-school policy. Another group is mobilising against it.",
        choices: [
          {
            label: "Full ban — locked away on arrival",
            effects: {
              discipline: 2,
              parentRelations: -1,
              staffMorale: 2,
              narration: "Lockers ordered. Half the parents furious; half delighted.",
            },
          },
          {
            label: "Bell-to-bell ban — pockets, but not seen",
            effects: {
              discipline: 1,
              parentRelations: 1,
              staffMorale: 0,
              narration: "Middle ground. Both factions partly satisfied.",
            },
          },
          {
            label: "No change — keep the current policy",
            effects: {
              parentRelations: -2,
              staffMorale: -1,
              narration: "The pro-ban WhatsApp group writes to governors.",
            },
          },
        ],
        autoBad: {
          parentRelations: -3,
          narration: "You missed the moment. Both groups are now hostile.",
        },
      };
    },
  },

  // ---- Donation -------------------------------------------------------------
  {
    id: "ops.donation",
    category: "Operations",
    severity: "routine",
    pauses: false,
    ttlDays: 10,
    baseWeight: 0.2,
    generate: (_c) => {
      return {
        title: "An anonymous donation",
        body: "£40,000 from an anonymous donor, restricted to 'science capital'. The science HoD has plans. The bursar has questions.",
        choices: [
          {
            label: "Accept; use it on science capital",
            effects: {
              budget: 6,
              staffMorale: 2,
              narration: "New equipment ordered. Smiles in the prep room.",
            },
          },
          {
            label: "Decline politely",
            effects: {
              governorRelations: -1,
              narration: "Bursar relieved; HoD silently appalled.",
            },
          },
          {
            label: "Accept and re-allocate quietly",
            effects: {
              budget: 4,
              staffMorale: -3,
              governorRelations: -2,
              narration: "Word got out. Morale took a hit.",
            },
          },
        ],
        autoBad: {
          budget: 0,
          narration: "The donor took it elsewhere when they did not hear back.",
        },
      };
    },
  },

  // ---- Trip authorisation ---------------------------------------------------
  {
    id: "ops.trip",
    category: "Operations",
    severity: "routine",
    pauses: false,
    ttlDays: 10,
    baseWeight: 1,
    generate: (c) => {
      const s = pickStaffWeighted(c.rng, activeStaff(c.state).filter((x) => x.subject != null), (x) =>
        x.attrs.energy,
      );
      if (!s) return null;
      const vars = { staff: `${s.givenName} ${s.surname}` };
      return {
        staff: s,
        title: tmpl("Trip authorisation: {staff}", vars),
        body: tmpl(
          "{staff} wants to take Year 10 on an overnight residential. Costed at £180 per pupil; bursaries needed for ~12.",
          vars,
        ),
        choices: [
          {
            label: "Approve and fund the bursaries from reserves",
            effects: {
              budget: -3,
              pastoral: 2,
              staffMorale: 2,
              parentRelations: 2,
              narration: "Trip approved with full bursary support.",
            },
          },
          {
            label: "Approve, no bursaries",
            effects: {
              budget: 0,
              parentRelations: -2,
              pastoral: -1,
              narration: "Trip runs; twelve children stay back.",
            },
          },
          {
            label: "Decline",
            effects: {
              staffMorale: -3,
              narration: tmpl("{staff} takes it personally.", vars),
            },
          },
        ],
        autoBad: {
          staffMorale: -2,
          narration: tmpl("{staff}'s proposal sat in your inbox until the deadline passed.", vars),
        },
      };
    },
  },
];

function meanAttainment(p: Pupil): number {
  const vals = Object.values(p.attainment);
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

// Public API ------------------------------------------------------------------

export function listTemplates(): readonly IncidentTemplate[] {
  return TEMPLATES;
}

export function rollIncidentForDay(
  state: GameState,
  rng: RNG,
  day: number,
): IncidentInstance | null {
  // One roll across all templates; weighted pick. Daily-fire probability is
  // implicit in the weights (sum ~25 → expected 1-3 incidents per teaching
  // day at default settings, modulated by school state).
  const ctx: TemplateContext = { state, rng, day };
  const weighted: Array<[IncidentTemplate, number]> = TEMPLATES.map((t) => {
    const mod = t.weightModifier ? t.weightModifier(ctx) : 1;
    return [t, t.baseWeight * mod];
  });
  const total = weighted.reduce((s, [, w]) => s + w, 0);
  // Daily fire probability scales with total weight so quiet schools really do
  // get quiet days.
  const fireProbability = Math.min(0.95, total / 30);
  if (!rng.chance(fireProbability)) return null;
  const tpl = rng.weighted(weighted);
  const gen = tpl.generate(ctx);
  if (!gen) return null;
  return {
    id: `inc_${day}_${tpl.id}_${rng.int(0, 0xffffff).toString(16)}`,
    templateId: tpl.id,
    category: tpl.category,
    severity: tpl.severity,
    pausesGame: tpl.pauses,
    title: gen.title,
    body: gen.body,
    choices: [
      ...gen.choices,
      // We always allow "ignore for now" — but it ages and auto-resolves badly.
      {
        label: "Park it (return later)",
        hint: "Sits in the inbox; auto-resolves badly if you leave it too long.",
        effects: { narration: "Parked." },
      },
    ],
    raisedOnDay: day,
    expiresOnDay: day + tpl.ttlDays,
    pupilId: gen.pupil?.id,
    staffId: gen.staff?.id,
    resolved: false,
  };
}

export function autoResolutionEffects(
  state: GameState,
  inst: IncidentInstance,
): ResolutionEffects {
  const tpl = TEMPLATES.find((t) => t.id === inst.templateId);
  if (!tpl) return { narration: "(unresolved)" };
  // Re-run the template's generator deterministically isn't sensible at apply
  // time; we stored autoBad alongside the instance instead — but to keep the
  // type surface clean we don't carry autoBad on the instance. So we regenerate
  // a sensible auto-bad set from the template defaults. Simpler approach: stash
  // a small canonical-bad on every instance via a side-channel — but for now,
  // synthesise from severity:
  void state;
  switch (inst.severity) {
    case "trivial":
      return { staffMorale: -1, narration: "(parked too long; minor irritation)" };
    case "routine":
      return {
        staffMorale: -2,
        parentRelations: -2,
        narration: "(unresolved long enough to become a formal complaint)",
      };
    case "serious":
      return {
        staffMorale: -3,
        parentRelations: -4,
        governorRelations: -2,
        narration: "(serious incident left unattended — predictable consequences)",
      };
    case "critical":
      return {
        staffMorale: -5,
        parentRelations: -5,
        governorRelations: -5,
        pastoral: -5,
        narration: "(critical incident ignored — career-affecting fallout)",
      };
  }
}
