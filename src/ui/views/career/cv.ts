import { h } from "../../dom.ts";
import { store } from "../../store.ts";
import { BACKGROUNDS, PERKS } from "../../../sim/perks.ts";
import { tabState } from "../../tabs.ts";
import type { CareerPosting, ID } from "../../../sim/types.ts";

export function renderCV(): HTMLElement {
  const s = store.require();
  const ht = s.headteacher;
  const bg = BACKGROUNDS[ht.background];

  const perkChips = h(
    "div",
    { class: "chips" },
    ...ht.perks.map((p) => h("span", { class: "tag" }, PERKS[p]?.label ?? p)),
  );

  const headPanel = h(
    "div",
    { class: "panel" },
    h("h3", {}, `${ht.givenName} ${ht.surname}`),
    h("p", { class: "dim", style: { margin: "2px 0" } }, `Age ${ht.age} · ${bg.label} · ${ht.yearsAsHead} years as head`),
    h("p", { style: { margin: "4px 0" } }, h("strong", {}, "Reputation"), ` — public ${ht.reputationPublic}, private ${ht.reputationPrivate}`),
    h("p", { style: { margin: "4px 0", fontSize: "12px" } }, "Perks: ", perkChips),
    h(
      "p",
      { style: { fontSize: "12px", margin: "6px 0" } },
      "Attributes: ",
      Object.entries(ht.attrs)
        .map(([k, v]) => `${k} ${v}`)
        .join(" · "),
    ),
    ht.totalSackings > 0
      ? h("p", { class: "dim", style: { color: "var(--bad)" } }, `Sackings on record: ${ht.totalSackings}`)
      : null,
  );

  const rows = ht.careerHistory
    .slice()
    .reverse()
    .map((c) => postingRow(s, c));

  return h(
    "div",
    {},
    h("h2", {}, "CV"),
    headPanel,
    h(
      "div",
      { class: "panel" },
      h("h3", {}, "Career history"),
      ht.careerHistory.length === 0
        ? h("p", { class: "muted" }, "No postings yet.")
        : h(
            "table",
            {},
            h(
              "thead",
              {},
              h(
                "tr",
                {},
                h("th", {}, "Years"),
                h("th", {}, "School"),
                h("th", {}, "Town"),
                h("th", {}, "Grade at exit"),
                h("th", { class: "numeric" }, "Avg %"),
                h("th", {}, "Departed"),
              ),
            ),
            h("tbody", {}, ...rows),
          ),
    ),
    h(
      "div",
      { class: "panel" },
      h("h3", {}, "Year-in-review log"),
      ht.yearInReview.length === 0
        ? h("p", { class: "muted" }, "No years closed yet.")
        : h(
            "div",
            { class: "history" },
            ...ht.yearInReview
              .slice()
              .reverse()
              .map((y) =>
                h(
                  "div",
                  { style: { marginBottom: "8px" } },
                  h("div", {}, h("strong", {}, `${y.schoolYearLabel} — ${y.schoolName}`)),
                  h("div", { style: { fontSize: "12px" } }, y.resultsHeadline),
                  h(
                    "div",
                    { class: "dim", style: { fontSize: "12px" } },
                    `pub Δ ${y.publicReputationDelta >= 0 ? "+" : ""}${y.publicReputationDelta} · priv Δ ${y.privateReputationDelta >= 0 ? "+" : ""}${y.privateReputationDelta}`,
                  ),
                  h("div", { style: { fontSize: "12px" } }, y.narrative),
                ),
              ),
          ),
    ),
  );
}

function postingRow(
  state: ReturnType<typeof store.require>,
  posting: CareerPosting,
): HTMLElement {
  const years =
    posting.endYear == null
      ? `${posting.startYear}–`
      : `${posting.startYear}–${posting.endYear}`;
  return h(
    "tr",
    {
      style: { cursor: "pointer" },
      onclick: () => {
        if (posting.departureReason === "current") return;
        viewFormerSchool(state, posting.schoolId);
      },
    },
    h("td", {}, years),
    h("td", {}, posting.schoolName),
    h("td", {}, posting.town),
    h("td", {}, posting.finalGrade ?? "—"),
    h("td", { class: "numeric" }, posting.headlineResultsAvg != null ? posting.headlineResultsAvg.toFixed(1) + "%" : "—"),
    h("td", {}, departureLabel(posting.departureReason)),
  );
}

function departureLabel(r: CareerPosting["departureReason"]): string {
  switch (r) {
    case "current":
      return "Current";
    case "moved":
      return "Moved on";
    case "resigned":
      return "Resigned";
    case "retired":
      return "Retired";
    case "sacked":
      return "Sacked";
  }
}

function viewFormerSchool(
  _state: ReturnType<typeof store.require>,
  schoolId: ID,
): void {
  formerSchoolFocus.id = schoolId;
  tabState.top = "career";
  tabState.sub.career = "former";
  store.emit();
}

// Shared focus state used by the read-only formerSchool view.
export const formerSchoolFocus: { id: ID | null } = { id: null };
