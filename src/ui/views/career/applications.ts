import { h } from "../../dom.ts";
import { store } from "../../store.ts";
import { acceptOffer, declineOffer } from "../../../sim/career.ts";
import { autosave } from "../../../sim/save.ts";
import { tabState } from "../../tabs.ts";
import type { Application } from "../../../sim/types.ts";

export function renderApplications(): HTMLElement {
  const s = store.require();
  const player = Object.values(s.sector.applications)
    .filter((a) => a.isPlayer)
    .sort((a, b) => b.submittedYear - a.submittedYear);

  if (player.length === 0) {
    return h(
      "div",
      {},
      h("h2", {}, "Applications"),
      h("p", { class: "muted" }, "No applications submitted yet."),
    );
  }

  return h(
    "div",
    {},
    h("h2", {}, "Applications"),
    h(
      "div",
      {},
      ...player.map((app) => renderApp(s, app)),
    ),
  );
}

function renderApp(
  s: ReturnType<typeof store.require>,
  app: Application,
): HTMLElement {
  const vac = s.sector.vacancies[app.vacancyId];
  const ss = vac ? s.sector.schools[vac.schoolId] : null;
  return h(
    "div",
    { class: "panel" },
    h(
      "div",
      {},
      h("strong", {}, ss?.name ?? "(unknown school)"),
      h("span", { class: "tag" }, app.result),
      h(
        "span",
        { class: "dim", style: { marginLeft: "6px", fontSize: "12px" } },
        `Submitted ${app.submittedYear}, wave ${app.submittedWave}`,
      ),
    ),
    h(
      "details",
      { style: { marginTop: "6px" } },
      h("summary", {}, `Your answers (${app.answers.length})`),
      h(
        "ul",
        { style: { fontSize: "12px", paddingLeft: "18px" } },
        ...app.answers.map((a) =>
          h(
            "li",
            {},
            `${a.questionId}: ${a.choiceId}`,
            a.promiseTag ? h("span", { class: "dim" }, ` — promise: ${a.promiseTag}${a.promiseValue != null ? " (" + a.promiseValue + ")" : ""}`) : null,
          ),
        ),
      ),
    ),
    app.result === "offered"
      ? h(
          "div",
          { style: { marginTop: "8px" } },
          h(
            "button",
            {
              class: "primary",
              onclick: () => {
                acceptOffer(s, app.id);
                autosave(s);
                tabState.top = "inbox";
                store.emit();
              },
            },
            "Accept offer",
          ),
          h(
            "button",
            {
              style: { marginLeft: "6px" },
              onclick: () => {
                declineOffer(s, app.id);
                autosave(s);
                store.emit();
              },
            },
            "Decline",
          ),
        )
      : null,
  );
}
