import { h } from "../../dom.ts";
import { store } from "../../store.ts";
import { RNG } from "../../../sim/rng.ts";
import {
  pickInterviewQuestions,
  submitApplication,
  type InterviewQuestion,
  type StanceChoice,
} from "../../../sim/career.ts";
import { autosave } from "../../../sim/save.ts";
import { tabState } from "../../tabs.ts";
import type { ApplicationAnswer, ID, Vacancy } from "../../../sim/types.ts";

interface FocusState {
  vacancyId: ID | null;
  questions: InterviewQuestion[];
  answers: Record<string, StanceChoice>;
  submitted: boolean;
}

export const interviewFocus: FocusState = {
  vacancyId: null,
  questions: [],
  answers: {},
  submitted: false,
};

export function renderInterview(): HTMLElement {
  const s = store.require();
  if (!interviewFocus.vacancyId) {
    return h(
      "div",
      {},
      h("h2", {}, "Interview"),
      h("p", { class: "muted" }, "Pick a vacancy first to start an interview."),
    );
  }
  const vacancy = s.sector.vacancies[interviewFocus.vacancyId];
  const ss = vacancy ? s.sector.schools[vacancy.schoolId] : null;
  if (!vacancy || !ss) {
    return h(
      "div",
      {},
      h("h2", {}, "Interview"),
      h("p", { class: "muted" }, "Vacancy no longer available."),
    );
  }

  // Lazy-build questions if needed.
  if (interviewFocus.questions.length === 0) {
    const rng = new RNG(`${s.seedLabel}:interview:${vacancy.id}`);
    interviewFocus.questions = pickInterviewQuestions(rng, vacancy);
    interviewFocus.answers = {};
    interviewFocus.submitted = false;
  }

  if (interviewFocus.submitted) {
    return h(
      "div",
      {},
      h("h2", {}, `Interview submitted — ${ss.name}`),
      h(
        "p",
        {},
        "Application on file. You'll hear back at the next interview deadline. ",
        "Continue time to find out.",
      ),
      h(
        "button",
        {
          class: "primary",
          onclick: () => {
            interviewFocus.vacancyId = null;
            interviewFocus.questions = [];
            interviewFocus.answers = {};
            interviewFocus.submitted = false;
            tabState.sub.career = "applications";
            store.emit();
          },
        },
        "Done",
      ),
    );
  }

  const progress = `${Object.keys(interviewFocus.answers).length}/${interviewFocus.questions.length}`;
  const allAnswered = Object.keys(interviewFocus.answers).length === interviewFocus.questions.length;

  return h(
    "div",
    { class: "interview-modal" },
    h("h2", {}, `Interview — ${ss.name}`),
    h(
      "p",
      { class: "dim" },
      `${ss.town} · ${ss.archetype} · tier ${ss.reputationTier} · ${ss.currentGrade}. Progress: ${progress}.`,
    ),
    h(
      "p",
      { style: { fontStyle: "italic", margin: "8px 0" } },
      ss.signature,
    ),
    h(
      "div",
      {},
      ...interviewFocus.questions.map((q, idx) => renderQuestion(q, idx, vacancy)),
    ),
    h(
      "div",
      { style: { marginTop: "12px", display: "flex", gap: "8px" } },
      h(
        "button",
        {
          class: "primary",
          disabled: !allAnswered,
          onclick: () => submit(),
        },
        allAnswered ? "Submit application" : `Answer all ${interviewFocus.questions.length} questions`,
      ),
      h(
        "button",
        {
          onclick: () => {
            interviewFocus.vacancyId = null;
            interviewFocus.questions = [];
            interviewFocus.answers = {};
            tabState.sub.career = "vacancies";
            store.emit();
          },
        },
        "Cancel",
      ),
    ),
  );
}

function renderQuestion(q: InterviewQuestion, idx: number, vacancy: Vacancy): HTMLElement {
  const chosen = interviewFocus.answers[q.id];
  return h(
    "div",
    { class: "panel interview-question" },
    h("div", { class: "dim", style: { fontSize: "12px" } }, `Q${idx + 1}`),
    h("p", { style: { margin: "4px 0" } }, h("strong", {}, q.prompt)),
    h(
      "div",
      { class: "interview-choices" },
      ...q.choices.map((c) =>
        h(
          "button",
          {
            class: chosen?.id === c.id ? "primary" : "",
            style: { display: "block", textAlign: "left", width: "100%", margin: "2px 0" },
            onclick: () => {
              interviewFocus.answers[q.id] = c;
              store.emit();
            },
          },
          c.label,
          c.promiseTag
            ? h(
                "span",
                { class: "dim", style: { fontSize: "11px", marginLeft: "6px" } },
                `(commits you: ${formatPromise(c)})`,
              )
            : null,
        ),
      ),
    ),
    void vacancy,
  );
}

function formatPromise(c: StanceChoice): string {
  switch (c.promiseTag) {
    case "results-floor":
      return `${c.promiseValue}% Y11 pass`;
    case "ofsted-grade": {
      const labels = ["", "Inadequate", "RI", "Good", "Outstanding"];
      return `${labels[c.promiseValue ?? 0] ?? "?"} grade`;
    }
    case "budget-surplus":
      return "balanced books";
    case "exclusions-cap":
      return `max ${c.promiseValue} exclusions/yr`;
    case "no-staff-cuts":
      return "no staff cuts";
    default:
      return "";
  }
}

function submit(): void {
  const s = store.require();
  const vacancyId = interviewFocus.vacancyId;
  if (!vacancyId) return;
  const answers: ApplicationAnswer[] = [];
  for (const q of interviewFocus.questions) {
    const choice = interviewFocus.answers[q.id];
    if (!choice) continue;
    const ans: ApplicationAnswer = {
      questionId: q.id,
      choiceId: choice.id,
      fitDelta: choice.fitDelta,
    };
    if (choice.promiseTag) ans.promiseTag = choice.promiseTag;
    if (choice.promiseValue !== undefined) ans.promiseValue = choice.promiseValue;
    answers.push(ans);
  }
  const app = submitApplication(s, vacancyId, answers);
  const vac = s.sector.vacancies[vacancyId];
  if (vac) app.submittedWave = vac.openedWave;
  interviewFocus.submitted = true;
  autosave(s);
  store.emit();
}
