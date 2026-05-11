// Minimal observable store. The UI subscribes to "tick" events and re-renders.
// We deliberately don't use a framework — the data is simple, the views are
// regenerated wholesale on each tick, and the cost is fine for Phase 1 sizes.

import type { GameState } from "../sim/types.ts";

type Listener = () => void;

class Store {
  private state: GameState | null = null;
  private listeners: Set<Listener> = new Set();

  setState(s: GameState | null): void {
    this.state = s;
    this.emit();
  }

  getState(): GameState | null {
    return this.state;
  }

  require(): GameState {
    if (!this.state) throw new Error("Store has no state — no active game.");
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(): void {
    for (const fn of this.listeners) fn();
  }
}

export const store = new Store();
