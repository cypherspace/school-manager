import { store } from "./ui/store.ts";
import { h, mount } from "./ui/dom.ts";
import { renderStartScreen } from "./ui/views/start.ts";
import { renderDashboard } from "./ui/views/dashboard.ts";
import { renderInbox } from "./ui/views/inbox.ts";
import { renderPupils } from "./ui/views/pupils.ts";
import { renderStaff } from "./ui/views/staff.ts";
import { renderResults } from "./ui/views/results.ts";
import { renderRules } from "./ui/views/rules.ts";
import { renderSets } from "./ui/views/timetable/sets.ts";
import { renderPlaceholder } from "./ui/views/placeholders.ts";
import { renderCV } from "./ui/views/career/cv.ts";
import { renderSectorView } from "./ui/views/career/sector.ts";
import { renderVacancies } from "./ui/views/career/vacancies.ts";
import { renderApplications } from "./ui/views/career/applications.ts";
import { renderInterview } from "./ui/views/career/interview.ts";
import { renderFormerSchool } from "./ui/views/career/formerSchool.ts";
import { continueUntilInterrupt, stepDay } from "./sim/engine.ts";
import { SUB_TABS, TOP_TABS, UNEMPLOYED_TABS, tabState } from "./ui/tabs.ts";
import {
  SaveVersionError,
  autosave,
  deleteBrowserSave,
  listBrowserSaves,
  loadAutosave,
  loadFromBrowser,
  saveToBrowser,
} from "./sim/save.ts";


const root = document.getElementById("app");
if (!root) throw new Error("No #app element in the page.");

store.subscribe(() => render());

// Try autosave on boot. Lets users refresh without losing state.
const restored = loadAutosave();
if (restored) {
  store.setState(restored);
} else {
  render();
}

function render(): void {
  if (!root) return;
  const state = store.getState();
  if (!state) {
    mount(root, renderStartScreen());
    return;
  }
  mount(root, renderApp());
}

function renderApp(): HTMLElement {
  const s = store.require();
  return h(
    "div",
    {},
    renderHeader(),
    renderToolbar(),
    s.pauseReason
      ? h("div", { class: "banner" }, h("strong", {}, "Paused: "), s.pauseReason)
      : null,
    s.gameOver
      ? h(
          "div",
          { class: "banner" },
          h("strong", {}, "Career ended: "),
          s.gameOverReason ?? "",
        )
      : null,
    renderDashboardStrip(),
    renderTabs(),
    renderSubTabs(),
    h("div", { class: "panel" }, renderActiveTab()),
  );
}

// Compact, always-visible school-state header. Click to expand to the full
// dashboard panel.
let dashboardExpanded = false;
function renderDashboardStrip(): HTMLElement {
  const s = store.require();
  const sch = s.school;
  const summary = h(
    "div",
    { class: "dashboard-strip" },
    h("span", {}, h("strong", {}, sch ? sch.name : "(no school)")),
    h("span", { class: "dim" }, sch ? sch.inspectionGrade : s.mode),
    h("span", { class: "dim" }, sch ? `${sch.pupilIds.length} pupils · ${sch.staffIds.length} staff` : "—"),
    h(
      "span",
      { class: "dim" },
      sch
        ? `Reserves £${sch.reserves.toLocaleString()} · Day ${s.dayIndex}`
        : `Day ${s.dayIndex}`,
    ),
    h(
      "button",
      {
        class: "chip" + (dashboardExpanded ? " active" : ""),
        onclick: () => {
          dashboardExpanded = !dashboardExpanded;
          store.emit();
        },
      },
      dashboardExpanded ? "Hide details" : "Show details",
    ),
  );
  return h(
    "div",
    {},
    summary,
    dashboardExpanded ? h("div", { class: "panel" }, renderDashboard()) : null,
  );
}

function renderHeader(): HTMLElement {
  const s = store.require();
  const sch = s.school;
  return h(
    "div",
    { class: "header" },
    h(
      "div",
      {},
      h("h1", {}, sch ? sch.name : `${s.headteacher.givenName} ${s.headteacher.surname}`),
      h(
        "div",
        { class: "crest" },
        sch
          ? `${sch.town} · ${s.headteacher.givenName} ${s.headteacher.surname}, Headteacher${s.ironman ? " · IRONMAN" : ""}`
          : `Currently unemployed${s.ironman ? " · IRONMAN" : ""}`,
      ),
    ),
    h(
      "div",
      { class: "controls" },
      h(
        "button",
        {
          onclick: () => {
            const slot = prompt("Save name", "save-" + Date.now()) ?? "";
            if (!slot) return;
            saveToBrowser(s, slot);
            alert("Saved to slot: " + slot);
          },
          disabled: s.ironman,
          title: s.ironman ? "Ironman — saves auto only" : "Save to a named slot",
        },
        "Save…",
      ),
      h(
        "button",
        {
          onclick: () => {
            const slots = listBrowserSaves();
            if (slots.length === 0) {
              alert("No saved games.");
              return;
            }
            const slot = prompt("Load which slot?\n\n" + slots.join("\n"), slots[0]) ?? "";
            if (!slot) return;
            try {
              const next = loadFromBrowser(slot);
              if (next) store.setState(next);
              else alert("No such slot.");
            } catch (err) {
              if (err instanceof SaveVersionError) alert(err.message);
              else alert("Could not load: " + String(err));
            }
          },
          disabled: s.ironman,
        },
        "Load…",
      ),
      h(
        "button",
        {
          class: "danger",
          onclick: () => {
            if (!confirm("Quit to start screen? Autosave will remain.")) return;
            store.setState(null);
          },
        },
        "Quit",
      ),
    ),
  );
}

function renderToolbar(): HTMLElement {
  const s = store.require();
  const disabled = s.gameOver;

  return h(
    "div",
    { class: "toolbar" },
    h(
      "button",
      {
        class: "primary",
        disabled,
        onclick: () => {
          const r = continueUntilInterrupt(s);
          autosave(s);
          // If a critical incident dropped in, jump to inbox.
          if (r.reason && r.reason.startsWith("Incident:")) tabState.top = "inbox";
          else if (r.reason && r.reason.startsWith("Year ")) {
            tabState.top = "results";
            tabState.sub.results = "latest";
          }
          store.emit();
        },
      },
      "▶  Continue",
    ),
    h(
      "button",
      {
        disabled,
        onclick: () => {
          stepDay(s);
          autosave(s);
          store.emit();
        },
      },
      "Step one day",
    ),
    h(
      "button",
      {
        disabled,
        onclick: () => {
          // Skip to end of year, ignoring pauses but still firing incidents.
          for (let i = 0; i < 365 && !s.gameOver; i++) {
            const r = stepDay(s);
            if (r.reason && r.reason.startsWith("Year ")) break;
          }
          autosave(s);
          tabState.top = "results";
          tabState.sub.results = "latest";
          store.emit();
        },
      },
      "Run to year end",
    ),
    h("span", { class: "spacer" }),
    h(
      "span",
      { class: "dim" },
      `Inbox: ${s.inbox.length}  ·  Day ${s.dayIndex}`,
    ),
  );
}

function renderTabs(): HTMLElement {
  const s = store.require();
  const tabs = s.mode === "in-post" && s.school ? TOP_TABS : UNEMPLOYED_TABS;
  // Force the active tab onto something valid in the unemployed shell.
  if (s.mode !== "in-post" && tabState.top !== "career") {
    tabState.top = "career";
  }
  return h(
    "div",
    { class: "tabs" },
    ...tabs.map(({ key, label }) =>
      h(
        "button",
        {
          class: "tab" + (tabState.top === key ? " active" : ""),
          onclick: () => {
            tabState.top = key;
            store.emit();
          },
        },
        label,
        key === "inbox" && s.inbox.length > 0
          ? h("span", { class: "tag", style: { marginLeft: "6px" } }, String(s.inbox.length))
          : null,
      ),
    ),
  );
}

function renderSubTabs(): HTMLElement | null {
  const subs = SUB_TABS[tabState.top];
  if (subs.length === 0) return null;
  const current = tabState.sub[tabState.top];
  return h(
    "div",
    { class: "subtabs" },
    ...subs.map(({ key, label }) =>
      h(
        "button",
        {
          class: "subtab" + (current === key ? " active" : ""),
          onclick: () => {
            tabState.sub[tabState.top] = key;
            store.emit();
          },
        },
        label,
      ),
    ),
  );
}

function renderActiveTab(): HTMLElement {
  const sub = tabState.sub[tabState.top];
  switch (tabState.top) {
    case "inbox":
      return renderInbox();
    case "timetable":
      if (sub === "sets") return renderSets();
      if (sub === "allocations")
        return renderPlaceholder("Staff allocations", "Phase 4+", "Per-staff timetable view will land with the Phase 4 schedule layer.");
      if (sub === "break")
        return renderPlaceholder("Break duties", "Phase 4+", "Duty rota editor — coming soon.");
      if (sub === "lunch")
        return renderPlaceholder("Lunch duties", "Phase 4+", "Duty rota editor — coming soon.");
      return renderSets();
    case "discipline":
      return renderRules();
    case "staff":
      if (sub === "leadership")
        return renderPlaceholder("Leadership team", "Phase 4+", "Deputies and assistant heads' portfolios + appraisal cycle.");
      return renderStaff();
    case "pupils":
      return renderPupils();
    case "results":
      if (sub === "history") return renderResultsHistory();
      return renderResults();
    case "career":
      if (sub === "sector") return renderSectorView();
      if (sub === "vacancies") return renderVacancies();
      if (sub === "applications") return renderApplications();
      if (sub === "interview") return renderInterview();
      if (sub === "former") return renderFormerSchool();
      return renderCV();
    case "governors":
      return renderPlaceholder("Governors", "Phase 4+", "Term-end meetings, chair relationship, audit cycle.");
    case "extra":
      return renderPlaceholder("Extra-curricular", "Phase 4+", "Clubs, trips, sports, music — and the staff time they devour.");
  }
}

function renderResultsHistory(): HTMLElement {
  const s = store.require();
  if (s.results.length === 0) {
    return h(
      "div",
      {},
      h("h2", {}, "Results — history"),
      h("p", { class: "muted" }, "No results yet."),
    );
  }
  return h(
    "div",
    {},
    h("h2", {}, "Results — history"),
    h(
      "table",
      {},
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          h("th", {}, "Year"),
          h("th", { class: "numeric" }, "Overall %"),
          h("th", { class: "numeric" }, "Y11 pass %"),
          h("th", { class: "numeric" }, "Inspection Δ"),
          h("th", { class: "numeric" }, "Budget Δ"),
        ),
      ),
      h(
        "tbody",
        {},
        ...s.results.map((r) =>
          h(
            "tr",
            {},
            h("td", {}, r.schoolYearLabel),
            h("td", { class: "numeric" }, r.overallAverage.toFixed(1) + "%"),
            h("td", { class: "numeric" }, r.passRate.toFixed(1) + "%"),
            h("td", { class: "numeric" }, (r.inspectionGradeImpact >= 0 ? "+" : "") + r.inspectionGradeImpact),
            h("td", { class: "numeric" }, "£" + r.budgetDelta.toLocaleString()),
          ),
        ),
      ),
    ),
  );
}

// Expose tiny helpers in dev so users can poke around the sim from the console.
declare global {
  interface Window {
    SM?: {
      state: () => ReturnType<typeof store.getState>;
      saves: () => string[];
      reset: () => void;
    };
  }
}
window.SM = {
  state: () => store.getState(),
  saves: () => listBrowserSaves(),
  reset: () => {
    if (!confirm("Wipe all saves and quit?")) return;
    for (const slot of listBrowserSaves()) deleteBrowserSave(slot);
    localStorage.removeItem("school-manager:autosave");
    store.setState(null);
  },
};
