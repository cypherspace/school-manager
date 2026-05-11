import { h } from "../dom.ts";
import { generateNewGame } from "../../sim/generators.ts";
import { store } from "../store.ts";
import { autosave, listBrowserSaves, loadFromBrowser } from "../../sim/save.ts";

export function renderStartScreen(): HTMLElement {
  const root = h("div", { class: "start-screen" });

  const title = h(
    "div",
    { class: "header" },
    h("h1", {}, "School Manager"),
    h("span", { class: "crest" }, "a long-career headteacher simulator"),
  );

  const seedInput = h("input", {
    type: "text",
    id: "f-seed",
    value: `head-${Math.floor(Math.random() * 1e6)}`,
  }) as HTMLInputElement;

  const repInput = h("input", {
    type: "number",
    id: "f-rep",
    min: "10",
    max: "90",
    value: "55",
  }) as HTMLInputElement;

  const ageInput = h("input", {
    type: "number",
    id: "f-age",
    min: "28",
    max: "60",
    value: "42",
  }) as HTMLInputElement;

  const ironmanInput = h("input", { type: "checkbox", id: "f-ironman" }) as HTMLInputElement;

  const saves = listBrowserSaves();
  const savesSelect = h(
    "select",
    { id: "f-saves" },
    h("option", { value: "" }, "— no saved games —"),
    ...saves.map((s) => h("option", { value: s }, s)),
  ) as HTMLSelectElement;

  root.appendChild(title);
  root.appendChild(
    h(
      "div",
      {},
      h("p", { class: "dim" }, "Phase 0 + Phase 1 vertical slice. One school, one career year, an inbox, and a results day. Save anywhere."),
      h("label", {}, "Seed (deterministic — same seed, same school)"),
      seedInput,
      h(
        "div",
        { class: "row" },
        h("div", {}, h("label", {}, "Starting reputation (10-90)"), repInput),
        h("div", {}, h("label", {}, "Headteacher age (28-60)"), ageInput),
      ),
      h(
        "label",
        { style: { marginTop: "12px", display: "flex", alignItems: "center", gap: "8px" } },
        ironmanInput,
        h("span", {}, "Ironman (one save, no reloads)"),
      ),
      h("hr", { style: { borderColor: "var(--border)", margin: "16px 0" } }),
      h("label", {}, "Or load a saved game"),
      savesSelect,
      h(
        "div",
        { class: "actions" },
        h(
          "button",
          {
            class: "primary",
            onclick: () => {
              const slot = savesSelect.value;
              if (!slot) return;
              const loaded = loadFromBrowser(slot);
              if (loaded) store.setState(loaded);
            },
          },
          "Load",
        ),
        h(
          "button",
          {
            class: "primary",
            onclick: () => {
              const seed = seedInput.value.trim() || "head";
              const rep = clampNum(repInput.value, 10, 90);
              const age = clampNum(ageInput.value, 28, 60);
              const ironman = ironmanInput.checked;
              const state = generateNewGame({
                seed,
                ironman,
                startingReputation: rep,
                headteacherAge: age,
              });
              store.setState(state);
              autosave(state);
            },
          },
          "Start new career",
        ),
      ),
    ),
  );

  return root;
}

function clampNum(raw: string, lo: number, hi: number): number {
  const n = Number(raw);
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
