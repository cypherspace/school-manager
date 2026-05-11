import { h } from "../../dom.ts";
import { store } from "../../store.ts";
import { availableVacancies } from "../../../sim/career.ts";
import { tabState } from "../../tabs.ts";
import { interviewFocus } from "./interview.ts";

export function renderVacancies(): HTMLElement {
  const s = store.require();
  const vacancies = availableVacancies(s).sort((a, b) =>
    a.openedWave === b.openedWave
      ? (s.sector.schools[b.schoolId]?.reputationTier ?? 0) -
        (s.sector.schools[a.schoolId]?.reputationTier ?? 0)
      : a.openedWave.localeCompare(b.openedWave),
  );

  if (vacancies.length === 0) {
    return h(
      "div",
      {},
      h("h2", {}, "Vacancies"),
      h(
        "p",
        { class: "muted" },
        "No live vacancies. They open after Christmas, after Easter, and (the biggest wave) in the summer term.",
      ),
    );
  }

  return h(
    "div",
    {},
    h("h2", {}, "Vacancies"),
    h(
      "p",
      { class: "dim" },
      "Apply with care — your answers are kept on file and you'll be judged against them in post.",
    ),
    h(
      "div",
      {},
      ...vacancies.map((v) => {
        const ss = s.sector.schools[v.schoolId];
        if (!ss) return h("div", {});
        const reachable =
          s.headteacher.reputationPublic >= v.minPublicReputation ||
          s.headteacher.reputationPrivate >= v.minPrivateReputation;
        return h(
          "div",
          { class: "panel vacancy-row" + (reachable ? "" : " out-of-reach") },
          h("strong", {}, ss.name),
          h("span", { class: "tag" }, ss.archetype),
          h("span", { class: "tag" }, `Tier ${ss.reputationTier}`),
          h("span", { class: "tag" }, `Wave: ${v.openedWave}`),
          h("span", { class: "tag" }, `Start: ${v.startTerm}`),
          h(
            "div",
            { class: "dim", style: { fontSize: "12px", margin: "4px 0" } },
            `${ss.town} · ${ss.currentGrade} · £${v.salaryBand.toLocaleString()} salary`,
          ),
          h(
            "div",
            { style: { fontSize: "12px" } },
            `Required reputation: ${v.minPublicReputation} public / ${v.minPrivateReputation} private. ` +
              `You: ${s.headteacher.reputationPublic} / ${s.headteacher.reputationPrivate}.`,
          ),
          h(
            "div",
            { style: { fontSize: "12px", marginTop: "4px", fontStyle: "italic" } },
            ss.signature,
          ),
          h(
            "div",
            { style: { marginTop: "8px" } },
            h(
              "button",
              {
                class: "primary",
                onclick: () => {
                  interviewFocus.vacancyId = v.id;
                  tabState.top = "career";
                  tabState.sub.career = "interview";
                  store.emit();
                },
              },
              "Apply / interview",
            ),
            !reachable
              ? h(
                  "span",
                  { class: "dim", style: { marginLeft: "8px", fontSize: "12px" } },
                  "(below the bar — apply anyway, but expect a polite no)",
                )
              : null,
          ),
        );
      }),
    ),
  );
}
