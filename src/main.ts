import { store } from "./ui/store.ts";
import { h, mount } from "./ui/dom.ts";
import { renderStartScreen } from "./ui/views/start.ts";
import { renderDashboard } from "./ui/views/dashboard.ts";
import { renderInbox } from "./ui/views/inbox.ts";
import { renderPupils } from "./ui/views/pupils.ts";
import { renderStaff } from "./ui/views/staff.ts";
import { renderResults } from "./ui/views/results.ts";
import { renderRules } from "./ui/views/rules.ts";
import { continueUntilInterrupt, stepDay } from "./sim/engine.ts";
import {
  autosave,
  deleteBrowserSave,
  listBrowserSaves,
  loadAutosave,
  loadFromBrowser,
  saveToBrowser,
} from "./sim/save.ts";

type Tab = "dashboard" | "inbox" | "pupils" | "staff" | "results" | "rules";

let activeTab: Tab = "dashboard";

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
    renderTabs(),
    h("div", { class: "panel" }, renderActiveTab()),
  );
}

function renderHeader(): HTMLElement {
  const s = store.require();
  return h(
    "div",
    { class: "header" },
    h(
      "div",
      {},
      h("h1", {}, s.school.name),
      h(
        "div",
        { class: "crest" },
        `${s.school.town} · ${s.headteacher.givenName} ${s.headteacher.surname}, Headteacher${s.ironman ? " · IRONMAN" : ""}`,
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
            const next = loadFromBrowser(slot);
            if (next) store.setState(next);
            else alert("No such slot.");
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
          if (r.reason && r.reason.startsWith("Incident:")) activeTab = "inbox";
          else if (r.reason && r.reason.startsWith("Year ")) activeTab = "results";
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
          activeTab = "results";
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
  const tabs: Array<[Tab, string]> = [
    ["dashboard", "Dashboard"],
    ["inbox", "Inbox"],
    ["pupils", "Pupils"],
    ["staff", "Staff"],
    ["results", "Results"],
    ["rules", "Rules"],
  ];
  return h(
    "div",
    { class: "tabs" },
    ...tabs.map(([key, label]) =>
      h(
        "button",
        {
          class: "tab" + (activeTab === key ? " active" : ""),
          onclick: () => {
            activeTab = key;
            store.emit();
          },
        },
        label,
        key === "inbox" && store.require().inbox.length > 0
          ? h("span", { class: "tag", style: { marginLeft: "6px" } }, String(store.require().inbox.length))
          : null,
      ),
    ),
  );
}

function renderActiveTab(): HTMLElement {
  switch (activeTab) {
    case "dashboard":
      return renderDashboard();
    case "inbox":
      return renderInbox();
    case "pupils":
      return renderPupils();
    case "staff":
      return renderStaff();
    case "results":
      return renderResults();
    case "rules":
      return renderRules();
  }
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
