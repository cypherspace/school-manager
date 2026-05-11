import { h } from "../dom.ts";
import { generateNewGame } from "../../sim/generators.ts";
import { generateSector } from "../../sim/sector.ts";
import { fireVacancyWave } from "../../sim/career.ts";
import { RNG } from "../../sim/rng.ts";
import { BACKGROUNDS, PERKS, listBackgrounds, listPerks } from "../../sim/perks.ts";
import { store } from "../store.ts";
import {
  SaveVersionError,
  autosave,
  listBrowserSaves,
  loadFromBrowser,
} from "../../sim/save.ts";
import type { BackgroundArchetype, PerkId, Sector, SectorSchool } from "../../sim/types.ts";

interface DraftCharacter {
  seed: string;
  givenName: string;
  surname: string;
  age: number;
  sex: "f" | "m";
  background: BackgroundArchetype;
  perks: PerkId[];
  ironman: boolean;
  // Entry route
  startUnemployed: boolean;
  chosenSchoolId: string | null;
  // Cached sector preview built from the seed for tier-matched slate.
  sector: Sector | null;
}

const draft: DraftCharacter = {
  seed: `head-${Math.floor(Math.random() * 1e6)}`,
  givenName: "",
  surname: "",
  age: 42,
  sex: "f",
  background: "career-teacher",
  perks: [],
  ironman: false,
  startUnemployed: false,
  chosenSchoolId: null,
  sector: null,
};

function rebuildSectorPreview(): void {
  draft.sector = generateSector(new RNG(`${draft.seed}:sector:initial`));
}

export function renderStartScreen(): HTMLElement {
  if (!draft.sector) rebuildSectorPreview();

  const root = h("div", { class: "start-screen" });
  const title = h(
    "div",
    { class: "header" },
    h("h1", {}, "School Manager"),
    h("span", { class: "crest" }, "a long-career headteacher simulator"),
  );

  // ----- Identity ---------------------------------------------------------

  const seedInput = h("input", { type: "text", value: draft.seed }) as HTMLInputElement;
  seedInput.addEventListener("input", () => {
    draft.seed = seedInput.value;
    rebuildSectorPreview();
    rerender();
  });

  const givenInput = h("input", { type: "text", value: draft.givenName, placeholder: "Given name" }) as HTMLInputElement;
  givenInput.addEventListener("input", () => (draft.givenName = givenInput.value));
  const surInput = h("input", { type: "text", value: draft.surname, placeholder: "Surname" }) as HTMLInputElement;
  surInput.addEventListener("input", () => (draft.surname = surInput.value));

  const ageInput = h("input", {
    type: "number",
    min: "28",
    max: "60",
    value: String(draft.age),
  }) as HTMLInputElement;
  ageInput.addEventListener("input", () => (draft.age = clampInt(ageInput.value, 28, 60)));

  const sexSelect = h(
    "select",
    {},
    h("option", { value: "f", selected: draft.sex === "f" }, "She/her"),
    h("option", { value: "m", selected: draft.sex === "m" }, "He/him"),
  ) as HTMLSelectElement;
  sexSelect.addEventListener("change", () => {
    draft.sex = sexSelect.value as "f" | "m";
  });

  // ----- Background -------------------------------------------------------

  const bgPanel = h(
    "div",
    { class: "panel" },
    h("h3", {}, "Background"),
    ...listBackgrounds().map((b) =>
      h(
        "label",
        { class: "bg-row" + (draft.background === b.id ? " active" : "") },
        h("input", {
          type: "radio",
          name: "bg",
          checked: draft.background === b.id,
          onchange: () => {
            draft.background = b.id;
            rerender();
          },
        }),
        " ",
        h("strong", {}, b.label),
        h("div", { class: "dim", style: { fontSize: "12px" } }, b.blurb),
      ),
    ),
  );

  // ----- Perks ------------------------------------------------------------

  const perkPanel = h(
    "div",
    { class: "panel" },
    h("h3", {}, `Perks (pick up to 2 — ${draft.perks.length}/2)`),
    h(
      "div",
      { class: "perk-grid" },
      ...listPerks().map((p) => {
        const selected = draft.perks.includes(p.id);
        return h(
          "div",
          {
            class: "perk-card" + (selected ? " active" : ""),
            onclick: () => {
              if (selected) {
                draft.perks = draft.perks.filter((x) => x !== p.id);
              } else if (draft.perks.length < 2) {
                draft.perks = [...draft.perks, p.id];
              }
              rerender();
            },
          },
          h("strong", {}, p.label),
          h("div", { class: "dim", style: { fontSize: "12px", margin: "2px 0" } }, p.flavour),
          h("div", { style: { fontSize: "12px" } }, p.effect),
        );
      }),
    ),
  );

  // ----- Entry route ------------------------------------------------------

  const bg = BACKGROUNDS[draft.background];
  const startingTier = tierForReputation(bg.startingPublicRep);
  const slate = pickEntrySlate(draft.sector!, startingTier);

  const routePanel = h(
    "div",
    { class: "panel" },
    h("h3", {}, "How do you enter the profession?"),
    h(
      "label",
      { style: { display: "block", margin: "6px 0" } },
      h("input", {
        type: "radio",
        name: "route",
        checked: !draft.startUnemployed,
        onchange: () => {
          draft.startUnemployed = false;
          rerender();
        },
      }),
      " Pick a school now (tier-matched slate below)",
    ),
    h(
      "label",
      { style: { display: "block", margin: "6px 0" } },
      h("input", {
        type: "radio",
        name: "route",
        checked: draft.startUnemployed,
        onchange: () => {
          draft.startUnemployed = true;
          draft.chosenSchoolId = null;
          rerender();
        },
      }),
      " Start unemployed — apply through the open vacancy wave",
    ),
    !draft.startUnemployed
      ? h(
          "div",
          { class: "slate-grid" },
          ...slate.map((ss) => {
            const selected = draft.chosenSchoolId === ss.id;
            return h(
              "div",
              {
                class: "slate-card" + (selected ? " active" : ""),
                onclick: () => {
                  draft.chosenSchoolId = ss.id;
                  rerender();
                },
              },
              h("strong", {}, ss.name),
              h("div", { class: "dim", style: { fontSize: "12px" } }, `${ss.town} · ${ss.archetype} · tier ${ss.reputationTier} · ${ss.currentGrade}`),
              h("div", { style: { fontSize: "12px", marginTop: "4px" } }, ss.signature),
            );
          }),
        )
      : null,
  );

  // ----- Ironman + load ---------------------------------------------------

  const ironmanInput = h("input", { type: "checkbox", checked: draft.ironman }) as HTMLInputElement;
  ironmanInput.addEventListener("change", () => (draft.ironman = ironmanInput.checked));

  const saves = listBrowserSaves();
  const savesSelect = h(
    "select",
    {},
    h("option", { value: "" }, "— no saved games —"),
    ...saves.map((s) => h("option", { value: s }, s)),
  ) as HTMLSelectElement;

  root.appendChild(title);
  root.appendChild(
    h(
      "div",
      {},
      h(
        "p",
        { class: "dim" },
        "Phase 3 build. Character creation, a 20-school sector, and the job market. Save anywhere.",
      ),
      h("label", {}, "Seed (deterministic — same seed, same sector)"),
      seedInput,
      h(
        "div",
        { class: "row" },
        h("div", {}, h("label", {}, "Given name"), givenInput),
        h("div", {}, h("label", {}, "Surname"), surInput),
      ),
      h(
        "div",
        { class: "row" },
        h("div", {}, h("label", {}, "Age (28-60)"), ageInput),
        h("div", {}, h("label", {}, "Sex"), sexSelect),
      ),
      bgPanel,
      perkPanel,
      routePanel,
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
            onclick: () => {
              const slot = savesSelect.value;
              if (!slot) return;
              try {
                const loaded = loadFromBrowser(slot);
                if (loaded) store.setState(loaded);
              } catch (err) {
                if (err instanceof SaveVersionError) alert(err.message);
                else alert("Could not load save: " + String(err));
              }
            },
          },
          "Load",
        ),
        h(
          "button",
          {
            class: "primary",
            disabled: !canStart(),
            onclick: () => startCareer(),
          },
          "Begin career",
        ),
      ),
    ),
  );

  return root;
}

function rerender(): void {
  store.emit();
}

function canStart(): boolean {
  if (draft.startUnemployed) return true;
  return draft.chosenSchoolId != null;
}

function tierForReputation(rep: number): number {
  if (rep >= 65) return 4;
  if (rep >= 55) return 3;
  if (rep >= 45) return 2;
  return 1;
}

function pickEntrySlate(sector: Sector, tier: number): SectorSchool[] {
  const all = Object.values(sector.schools);
  const matching = all
    .filter((s) => Math.abs(s.reputationTier - tier) <= 1)
    .sort((a, b) => a.reputationTier - b.reputationTier);
  return matching.slice(0, 5);
}

function startCareer(): void {
  const state = generateNewGame({
    seed: draft.seed,
    ironman: draft.ironman,
    headteacherAge: draft.age,
    headteacherSex: draft.sex,
    headteacherName:
      draft.givenName && draft.surname
        ? { given: draft.givenName, surname: draft.surname }
        : undefined,
    background: draft.background,
    perks: draft.perks,
    schoolYearStart: new Date().getUTCFullYear(),
    sector: draft.sector ?? undefined,
    entrySectorSchoolId: draft.startUnemployed ? null : draft.chosenSchoolId ?? null,
  });
  // Starting unemployed: surface an initial vacancy wave so there's something
  // to apply to from day one.
  if (draft.startUnemployed) {
    fireVacancyWave(state, "post-christmas", null);
  }
  store.setState(state);
  autosave(state);
}

function clampInt(raw: string, lo: number, hi: number): number {
  const n = Number(raw);
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

// Silence unused-import warnings from constants imported for the side of
// type-narrowing (PERKS is referenced indirectly via listPerks).
void PERKS;
