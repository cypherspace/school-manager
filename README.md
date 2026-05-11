# School Manager

A long-career headteacher simulator. Think *Football Manager* applied to
schools, with a thin layer of *Theme Hospital*-style incident chaos. The
player is always the headteacher; the game is played almost entirely through
spreadsheets, inboxes and dashboards.

This repository contains the **Phase 0 + Phase 1 vertical slice**: project
skeleton, deterministic simulation core, one school with full pupil and
staff rosters, an inbox-driven incident loop, daily ticks with
configurable interruption rules, end-of-year results, and save/load.

See [`docs/plan.md`](./docs/plan.md) for the full design plan.

## Run

```sh
npm install
npm run dev        # http://localhost:5173
```

Other commands:

```sh
npm run typecheck  # tsc --noEmit
npm run build      # production build
npm run sim 3 my-seed   # headless 3-year auto-pilot simulation
```

Node 18+ recommended.

## Vertical-slice acceptance criteria (Phase 1)

- [x] Start a new game with a generated school
- [x] Pupils and staff are generated with full attribute sets
- [x] "Continue" advances time until something interrupts
- [x] Incidents fire from a template library and pause the game
- [x] Player resolves incidents with choices that update state
- [x] End-of-year results are calculated and displayed
- [x] Save / load (browser localStorage; ironman supported)
- [x] All of the above runs in a browser

## Architecture

```
src/
├── sim/                       # deterministic, no-I/O simulation core
│   ├── rng.ts                 # seeded Mulberry32 PRNG
│   ├── names.ts               # name generators
│   ├── types.ts               # entity types
│   ├── calendar.ts            # school year, terms, half-terms, reporting points
│   ├── generators.ts          # pupil / staff / school / new-game generation
│   ├── incidents.ts           # ~20 incident templates + the rolling engine
│   ├── engine.ts              # daily tick, continue-until-interrupt, resolution
│   ├── results.ts             # end-of-year calc and year rollover
│   ├── save.ts                # JSON serialise / deserialise + localStorage
│   └── headless.ts            # CLI harness (`npm run sim`)
├── ui/                        # thin presentation layer
│   ├── store.ts               # observable store
│   ├── dom.ts                 # tiny createElement helpers
│   └── views/
│       ├── start.ts           # start screen
│       ├── dashboard.ts       # school overview, reputation, history
│       ├── inbox.ts           # the inbox — the primary interface
│       ├── pupils.ts          # filterable / sortable pupil database
│       ├── staff.ts           # filterable / sortable staff database
│       ├── results.ts         # year-end results + advance button
│       └── rules.ts           # interruption-rule toggles
├── main.ts                    # app shell, tab routing, toolbar
└── styles.css
```

The simulation core has no DOM or storage dependencies. It can be driven
from the browser, the headless harness, or future test harnesses.

## Design choices

- **Deterministic core.** A seeded PRNG (`sim/rng.ts`) threads through all
  generation and incident rolls. Same seed → same school. The save format
  is just `GameState` JSON.
- **No framework.** The UI is plain DOM with a tiny `h()` helper. Phase 1
  data sizes (~600 pupils, ~50 staff) are well within reach of full
  re-render on every tick. If perf becomes an issue, switch to keyed
  diffing.
- **Time is rhythmic, not scripted.** The calendar (`sim/calendar.ts`)
  encodes Autumn / Spring / Summer terms split by half-terms, with three
  reporting points and a year-end results day. "Continue" stops on
  configurable interruption rules — incident severity, reporting points,
  term boundaries, or inbox pile-up.
- **Pile-up has teeth.** Unresolved incidents auto-resolve badly after
  their TTL, damaging reputation axes. Three weeks of ignored complaints
  really does become a formal complaint.

## What's not here yet

Everything from Phase 2 onward, deliberately: the full data layer (set
moves, teacher assignments), career arc across schools, persistent rivals
and alumni life-simulation, politics and culture, estate management,
inspections as multi-day events, scenarios. The plan is in
`docs/plan.md`; the architecture in `sim/` is intended to extend into
these phases without restructuring.

## Console helpers

In dev mode the page exposes a small helper:

```js
SM.state()   // current GameState
SM.saves()   // list of named save slots
SM.reset()   // wipe all saves
```
