// Mulberry32 — small, fast, well-distributed seeded PRNG.
// The whole sim must be deterministic for ironman saves and replay.

export class RNG {
  private state: number;

  constructor(seed: number | string) {
    this.state = typeof seed === "string" ? hashString(seed) : seed >>> 0;
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(minInclusive: number, maxInclusive: number): number {
    return Math.floor(this.next() * (maxInclusive - minInclusive + 1)) + minInclusive;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("RNG.pick on empty array");
    return items[Math.floor(this.next() * items.length)]!;
  }

  weighted<T>(items: ReadonlyArray<readonly [T, number]>): T {
    const total = items.reduce((s, [, w]) => s + w, 0);
    let r = this.next() * total;
    for (const [item, w] of items) {
      r -= w;
      if (r <= 0) return item;
    }
    return items[items.length - 1]![0];
  }

  // Box-Muller normal distribution.
  normal(mean = 0, stdDev = 1): number {
    const u1 = Math.max(this.next(), Number.MIN_VALUE);
    const u2 = this.next();
    return mean + stdDev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  // Clamp a normal into [min, max] without rejection bias for the small-tail case.
  bounded(mean: number, stdDev: number, min: number, max: number): number {
    const v = this.normal(mean, stdDev);
    return Math.max(min, Math.min(max, v));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  // Spawn a child RNG seeded deterministically from this one.
  child(label: string): RNG {
    return new RNG(hashString(label + ":" + this.state));
  }

  getState(): number {
    return this.state;
  }

  setState(s: number): void {
    this.state = s >>> 0;
  }
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
