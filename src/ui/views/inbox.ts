import { h } from "../dom.ts";
import { store } from "../store.ts";
import { resolveIncident } from "../../sim/engine.ts";
import { autosave } from "../../sim/save.ts";
import type { IncidentInstance } from "../../sim/types.ts";

export function renderInbox(): HTMLElement {
  const s = store.require();

  const items = [...s.inbox];
  items.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  const list = h("div", {});

  if (items.length === 0) {
    list.appendChild(h("p", { class: "muted" }, "Empty inbox. Quiet day. Press Continue."));
  } else {
    for (const inc of items) {
      list.appendChild(renderIncident(inc));
    }
  }

  // Recent resolutions, last 8.
  const resolved = s.resolvedInbox.slice(-8).reverse();
  const history = h(
    "details",
    {},
    h("summary", {}, `Resolved this career (${s.resolvedInbox.length})`),
    ...resolved.map((r) =>
      h(
        "div",
        { style: { padding: "4px 0", borderBottom: "1px dotted var(--border)" } },
        h(
          "span",
          { class: "tag " + r.severity },
          r.severity,
        ),
        " ",
        h("strong", {}, r.title),
        " — ",
        h("span", { class: "dim" }, r.autoResolved ? "auto-resolved (parked)" : r.resolutionLabel ?? ""),
      ),
    ),
  );

  return h("div", {}, h("h2", {}, "Inbox"), list, history);
}

function renderIncident(inc: IncidentInstance): HTMLElement {
  const s = store.require();
  const pupil = inc.pupilId ? s.pupils[inc.pupilId] : null;
  const staff = inc.staffId ? s.staff[inc.staffId] : null;
  const ageDays = s.dayIndex - inc.raisedOnDay;
  const ttl = inc.expiresOnDay - s.dayIndex;

  const choices = h("div", { class: "choices" });
  inc.choices.forEach((choice, idx) => {
    const btn = h(
      "button",
      {
        onclick: () => {
          resolveIncident(s, inc.id, idx);
          autosave(s);
          store.emit();
        },
        title: choice.hint ?? "",
      },
      choice.label,
    );
    choices.appendChild(btn);
  });

  return h(
    "div",
    { class: "incident " + inc.severity },
    h(
      "div",
      {},
      h("span", { class: "tag " + inc.severity }, inc.severity),
      h("span", { class: "tag" }, inc.category),
      ageDays > 0 ? h("span", { class: "tag" }, `${ageDays}d old`) : null,
      ttl <= 2 ? h("span", { class: "tag flag" }, `expires in ${Math.max(0, ttl)}d`) : null,
      pupil
        ? h(
            "span",
            { class: "tag" },
            `${pupil.givenName} ${pupil.surname} (${pupil.formGroup})`,
          )
        : null,
      staff ? h("span", { class: "tag" }, `${staff.givenName} ${staff.surname}`) : null,
    ),
    h("h3", {}, inc.title),
    h("div", { class: "body" }, inc.body),
    choices,
  );
}

function severityRank(sev: IncidentInstance["severity"]): number {
  return { critical: 4, serious: 3, routine: 2, trivial: 1 }[sev];
}
