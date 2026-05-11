import { h } from "../../dom.ts";
import { store } from "../../store.ts";

export function renderSectorView(): HTMLElement {
  const s = store.require();
  const schools = Object.values(s.sector.schools).sort(
    (a, b) => b.reputationTier - a.reputationTier || a.name.localeCompare(b.name),
  );
  return h(
    "div",
    {},
    h("h2", {}, "The sector"),
    h(
      "p",
      { class: "dim" },
      `Twenty schools you might end up in. Heads age, retire, and move; vacancies open in three waves through the year.`,
    ),
    h(
      "div",
      { class: "sector-grid" },
      ...schools.map((ss) => {
        const head = ss.headId ? s.sector.sectorHeads[ss.headId] : null;
        const isPlayer = ss.headId === s.headteacher.id;
        return h(
          "div",
          { class: "sector-card" + (isPlayer ? " active" : "") },
          h("strong", {}, ss.name),
          h(
            "div",
            { class: "dim", style: { fontSize: "12px" } },
            `${ss.town} · ${ss.archetype}`,
          ),
          h(
            "div",
            { style: { fontSize: "12px", marginTop: "2px" } },
            `Tier ${ss.reputationTier} · ${ss.currentGrade}`,
          ),
          h(
            "div",
            { style: { fontSize: "12px", marginTop: "2px" } },
            isPlayer
              ? h("strong", {}, "You")
              : head
              ? `Head: ${head.givenName} ${head.surname} (age ${head.age})`
              : h("span", { style: { color: "var(--warn)" } }, "Vacant"),
          ),
          h(
            "div",
            { class: "dim", style: { fontSize: "11px", marginTop: "4px", fontStyle: "italic" } },
            ss.signature,
          ),
        );
      }),
    ),
    s.sector.trashTalk.length > 0
      ? h(
          "div",
          { class: "panel" },
          h("h3", {}, "Sector chatter"),
          h(
            "div",
            { class: "history" },
            ...s.sector.trashTalk
              .slice()
              .reverse()
              .slice(0, 12)
              .map((t) =>
                h(
                  "div",
                  { style: { marginBottom: "4px" } },
                  h("strong", {}, `${t.fromHeadName}, leaving ${t.fromSchoolName}: `),
                  h("em", {}, `"…${t.quote}…"`),
                  h("span", { class: "dim" }, ` (${t.year})`),
                ),
              ),
          ),
        )
      : null,
  );
}
