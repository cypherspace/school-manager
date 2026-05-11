// Save/load. JSON to localStorage in the browser; pure JSON helpers also
// exported so the headless harness can persist to disk if it wants. The
// simulation core is deterministic, so the only state that matters is
// captured by GameState verbatim.

import type { GameState } from "./types.ts";

const SAVE_KEY_PREFIX = "school-manager:save:";
const AUTOSAVE_KEY = "school-manager:autosave";
const VERSION = 1;

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

export function deserialize(json: string): GameState {
  const env = JSON.parse(json) as SaveEnvelope;
  if (!env || typeof env !== "object" || env.version !== VERSION) {
    throw new Error("Save format mismatch — only version 1 is supported.");
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
  return raw ? deserialize(raw) : null;
}
