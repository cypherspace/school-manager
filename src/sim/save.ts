// Save/load. JSON to localStorage in the browser; pure JSON helpers also
// exported so the headless harness can persist to disk if it wants. The
// simulation core is deterministic, so the only state that matters is
// captured by GameState verbatim.

import type { GameState } from "./types.ts";

const SAVE_KEY_PREFIX = "school-manager:save:";
const AUTOSAVE_KEY = "school-manager:autosave";
const VERSION = 2;

interface SaveEnvelope {
  version: number;
  savedAt: string;
  label: string;
  state: GameState;
}

export function serialize(state: GameState, label = "save"): string {
  const env: SaveEnvelope = {
    version: VERSION,
    savedAt: new Date().toISOString(),
    label,
    state,
  };
  return JSON.stringify(env);
}

export class SaveVersionError extends Error {
  readonly found: unknown;
  readonly expected: number;
  constructor(found: unknown) {
    super(
      `Save was written by an earlier version of the game (v${String(found)}) and can't be opened by v${VERSION}. ` +
        `Start a new career — Phase 2 changed the data model.`,
    );
    this.name = "SaveVersionError";
    this.found = found;
    this.expected = VERSION;
  }
}

export function deserialize(json: string): GameState {
  const env = JSON.parse(json) as SaveEnvelope;
  if (!env || typeof env !== "object" || typeof env.version !== "number") {
    throw new Error("Save file is malformed — could not parse envelope.");
  }
  if (env.version !== VERSION) {
    throw new SaveVersionError(env.version);
  }
  return env.state;
}

// Browser-localStorage helpers ------------------------------------------------

function hasStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function saveToBrowser(state: GameState, slot: string): void {
  if (!hasStorage()) throw new Error("No localStorage available.");
  window.localStorage.setItem(SAVE_KEY_PREFIX + slot, serialize(state, slot));
}

export function loadFromBrowser(slot: string): GameState | null {
  if (!hasStorage()) return null;
  const raw = window.localStorage.getItem(SAVE_KEY_PREFIX + slot);
  return raw ? deserialize(raw) : null;
}

// Same as deserialize but distinguishes "no save" from "save is the wrong
// version". Returns the version found if it's a known-bad version.
export function probeSaveVersion(json: string): number | null {
  try {
    const env = JSON.parse(json) as SaveEnvelope;
    return typeof env?.version === "number" ? env.version : null;
  } catch {
    return null;
  }
}

export function listBrowserSaves(): string[] {
  if (!hasStorage()) return [];
  const slots: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(SAVE_KEY_PREFIX)) slots.push(k.slice(SAVE_KEY_PREFIX.length));
  }
  return slots.sort();
}

export function deleteBrowserSave(slot: string): void {
  if (!hasStorage()) return;
  window.localStorage.removeItem(SAVE_KEY_PREFIX + slot);
}

export function autosave(state: GameState): void {
  if (!hasStorage()) return;
  window.localStorage.setItem(AUTOSAVE_KEY, serialize(state, "autosave"));
}

export function loadAutosave(): GameState | null {
  if (!hasStorage()) return null;
  const raw = window.localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) return null;
  try {
    return deserialize(raw);
  } catch (err) {
    if (err instanceof SaveVersionError) {
      // Autosave is from an earlier version — discard so the start screen
      // is clean. The user's named saves remain (they can see them listed
      // and get a friendly error if they try to load).
      window.localStorage.removeItem(AUTOSAVE_KEY);
      return null;
    }
    throw err;
  }
}
