# School Manager — Design & Build Plan

## 1. Concept

A long-career headteacher simulator, in the spirit of Football Manager applied to schools, with a light layer of Theme Hospital's incident chaos. The player is always the headteacher, never a deputy or other role. They progress through a career of 30+ years, moving between schools as their reputation grows or fails. Retirement at age 75 unless sacked.

The game is played almost entirely through spreadsheets, inboxes, dashboards and data screens. A light isometric site view exists only for estate/capital planning. There is no 3D simulation of classrooms or pupils.

**Tone**: Yes Minister / The Simpsons / Parks & Rec. Tragicomic management satire. Stress, bullying, pupil mischief, staffroom feuds, awkward governors, absurd parents. No deaths, no abuse, no Wire-style heaviness.

**Setting**: Generic Western state/independent education. The game invents its own inspectorate, qualifications structure, funding model and league tables rather than borrowing UK or US specifics.

## 2. Core design pillars

1. **Every pupil is a real entity.** Hundreds of thousands across a career. Most are invisible statistical citizens; the interesting ones surface through incidents, data outliers, staff flags or player searches.
2. **Persistence across the whole career.** Pupils, staff, alumni, and rival schools persist across every school the player works at. The Year 9 you remember becomes a parent of a Year 7 at your next school, or an NQT you hire fifteen years later.
3. **The inbox is the interface.** Daily turns, "continue until something needs you", filterable interruption rules, FM-style.
4. **The data is the depth.** Real decisions are buried in spreadsheets — moving teachers between sets, redeploying TAs, equipment upgrades, timetable tweaks, intake strategy. Surface-level play works; deep play rewards.
5. **The world is alive.** Rival schools, simulated abstractly but with named heads, real staff movement, real competition for pupils.
6. **Variable money.** Different schools have different financial textures. Multi-year reserves planning matters.
7. **No artificial rhythm.** The week isn't pre-scripted by day. Rhythm comes from reporting cycles, recruitment windows, parents' evenings, term boundaries, results, and inspections.

## 3. Career structure

- Player creates a character with a starting age (28-50), background, and starting reputation tier.
- Two entry routes:
  - **Pick a school directly** (harder if reputation doesn't match — a no-experience head taking on an elite school will likely fail fast)
  - **Start unemployed** and apply for advertised vacancies; interview process is a minigame (CV, vision pitch, governor Q&A)
- Career progression driven by results, inspection outcomes, and visible reputation.
- Public reputation (results history, inspections, turnarounds) and private reputation (sector whispers — were you really good, or lucky).
- As reputation grows, schools approach the player (discreet headhunting).
- Career ends at age 75 (forced retirement) or via cumulative reputation collapse making jobs unavailable.
- **Sacking** is possible (inadequate inspection, major scandal mishandled, governor vote) but is a setback, not a game over. Damages reputation, makes next job harder to find.
- Save options: **ironman** (one save, decisions stick) and **standard** (freely reloadable) both supported.

## 4. Time model

- **Daily ticks** during term time. Holidays compress (no incidents but planning/admin/recruitment still happen).
- "Continue" button advances time until an interruption fires. Player sets interruption rules ("pause on safeguarding flags, staff resignations, parent escalations, inspector contact").
- ~190 school days per year + holiday periods.
- **Rhythm comes from cycles, not days**: reporting points (half-termly data drops), recruitment windows, parents' evenings, governor meetings, term boundaries, exam results day, inspection windows. These are the heartbeat.
- A typical year takes a few hours of casual continue-pressing, plus however much time the player wants to spend digging into data and making deeper decisions.

## 5. Entity model

### 5.1 Pupils

Every pupil is a full entity from intake to leaving (and persisting afterwards as alumni records).

Core data (~30-40 fields):
- Identity: name, DOB, year group, form, photo seed
- Background: family situation flag, prior attainment, SEND profile, EAL flag, premium-eligible flag, primary school
- Academic: per-subject ability rating, per-subject current attainment, predicted grades, value-added trajectory
- Behaviour: discipline propensity, behaviour points balance, recorded incidents
- Pastoral: friendships (lightweight graph), interests, achievements, wellbeing rating
- Hidden: ambition, resilience, family support, future-life trajectory seed (used post-leaving)
- Relationship to school: attendance %, engagement rating, parental engagement rating

**Surfacing rules** determine when a pupil appears to the player:
- Incident generation
- Data outliers in regular reports
- Staff flagging
- Pastoral review meetings
- Player search/filter

### 5.2 Staff

Every staff member is a persistent entity across the whole simulated sector — they exist before the player meets them, after they leave, and may resurface at rival schools or as future hires.

Attributes (FM-style 1-20):
- Subject knowledge, classroom management, lesson planning, marking efficiency, pastoral skill, energy, ambition, loyalty, mentoring, admin tolerance, leadership potential
- Hidden: integrity, professionalism, controversy risk, union sympathy, political tendency

Career data: age, qualifications, employment history, salary, contract type, current role, performance history.

Personality archetypes (modifiers to generation): inspirational NQT, burnt-out veteran, politicking deputy, brilliant-but-difficult specialist, safe pair of hands, careerist, lifer-local, ideological warrior, etc.

### 5.3 Alumni

When a pupil leaves, their record persists. A weighted subset (based on how "memorable" they were — incidents, achievements, repeated surfacings) get **tagged for life simulation**. These can resurface as:
- Parents of future pupils
- Future staff hires
- Governors
- Local journalists
- Politicians affecting funding
- Famous-for-good or famous-for-bad news stories
- Donors (if successful and grateful)

Untagged alumni become dormant records — searchable, but no autonomous life.

### 5.4 Rival schools

Abstracted simulation. Each rival has:
- A named head with attributes and tenure
- Aggregate pupil ability/behaviour/results
- A budget state and capital state
- A small named senior staff roster (heads of department only)
- A reputation trajectory
- An incident/event generator

Rivals compete with the player for staff (headhunting, both directions), pupils (catchment intake), and reputation (local league table). They generate news, drama, and named characters who recur across the player's career.

### 5.5 The player's school

The school itself is an entity with: site layout, room inventory, capital state, maintenance backlog, financial reserves, current intake numbers, projected rolls, reputation, inspection history, results history, specialisms, designations.

## 6. System pillars

### 6.1 Inbox & incident system

The primary interface. Incidents arrive with metadata: severity, category, time-sensitivity, related pupils/staff, suggested actions.

**Pause-game incidents** (force immediate decision):
- Safeguarding-style flags (kept light: bullying, family stress, mental health concerns)
- Allegations against staff (misconduct, capability)
- Press contact
- Senior staff resignations
- Governor or inspector contact
- Serious behavioural incidents (fights, vandalism, vaping rings)

**Pile-up incidents** (collect in inbox):
- Routine behaviour referrals
- Non-escalated parent complaints
- Minor staff grievances, sickness
- Maintenance requests
- Day-to-day pastoral notes

**Pile-up consequences**: unhandled items auto-resolve badly. Three weeks of ignored complaints become a formal complaint. Patterns get missed (three separate referrals about the same pupil reveal a pattern only if read in sequence). Staff lose faith if their referrals are routinely ignored.

Each incident has 2-5 decision options with non-obvious consequences across reputation axes (discipline, pastoral, parent-relations, staff-morale, governor-relations, budget).

### 6.2 Staff management

- Hiring: post vacancies, sift applications, conduct interviews, make appointments. Or headhunt actively from rivals (cost, risk, gardening leave).
- Performance: observations, appraisals, capability proceedings, support plans.
- Politics: staffroom factions, union dynamics, gossip, grievances.
- CPD: training budgets, development plans, succession planning.
- Departures: resignations, retirements, dismissals, redundancy.
- **Recruitment cycles**: main hiring window matches academic year (Easter for September starts), with rolling smaller windows. Late summer panic-hiring is its own texture.

### 6.3 Pupil management

- Intake decisions: admissions criteria, oversubscription handling, in-year admissions.
- Set/group placement: per-subject setting decisions, mixed-ability vs setted strategies.
- Pastoral structures: form groups, year teams, house systems if used.
- Discipline: behaviour policy, exclusion decisions, restorative approaches.
- Pupil voice: student council, head pupil, complaints, surveys.
- Pupil progress tracking: half-termly data, intervention decisions, parental contact.

### 6.4 Academic results

Three reporting points per year (mock data, internal data, public results). Pupils take qualifications at end of compulsory schooling (age 16 equivalent) and again at age 18 for those staying on.

Each pupil's results are a function of: prior ability, teaching quality received per subject per year, behaviour engagement, attendance, pastoral state, family/background factors, exam-day variance.

Results day each summer is a major moment: results land subject by subject, league tables publish, governors react, local press covers, intake for next year shifts, staff recruitment power changes.

### 6.5 Inspections

A made-up inspectorate ("the Inspectorate") with its own grade scale (suggest: Outstanding / Good / Requires Improvement / Inadequate, or invent new names).

- Frequency varies by previous grade (outstanding schools inspected rarely; inadequate frequently).
- Triggered by patterns (results crash, complaints volume, governor concern).
- Multi-day events. Inspectors arrive, observe lessons, interview staff, interview pupils, review data, issue grade.
- The player makes preparation decisions (mock inspections, document readiness, staff briefings) and during-inspection decisions (which lessons to showcase, how to spin data).
- Outcome shapes future career.

### 6.6 Politics & culture

Pressure sources, all of which create heat on certain decisions:

- **Parental factions**: phones-in-school camp, more-discipline camp, less-discipline camp, academic-rigour camp, wellbeing-first camp, more-PE camp, school-dinners camp. Each can mobilise, organise, escalate.
- **Staff tendencies**: progressive vs traditional pedagogy, union-active vs union-sceptical, careerist vs lifer.
- **Governing body politics**: governors have backgrounds (business, ex-teacher, councillor, parent rep, faith rep, local-eminence). Their composition shapes the pressure they apply.
- **External weather**: occasional national stories shift sensitivities (a high-profile incident elsewhere makes everyone twitchy about something for a term).

Decisions that create heat: curriculum, discipline policy, uniform, phones, inclusion, hiring, incident responses.

The skill is reading the room — knowing when to push, defer, coalition-build, or take the hit.

### 6.7 Money & estate

**Income sources**: per-pupil funding, premium funding, sixth-form funding, capital grants, specialist designations, sponsorship/donations (alumni!), lettings, fees (if independent).

**Costs**: staff (60-80%), maintenance, energy, catering, supplies, capital depreciation.

**Multi-year reserves management** — not single-year balancing. Reserves below threshold triggers governor crisis meetings; reserves too high attracts unwelcome questions.

**Estate view**: light isometric. Room inventory, room allocation per subject, capital project planning (new buildings, refurbishments, land purchases), maintenance backlog management. Projects take terms or years and require multi-year budget commitment.

### 6.8 League tables & rankings

Published annually. Player's school ranked locally and nationally. Affects intake, reputation, recruitment power, and governor mood.

Year-in-review exportable summary at end of each year (and end of career) — designed to be screenshotable/shareable, anticipating future multiplayer/social features.

## 7. Modes

- **Career mode**: open-ended, single-character, retirement at 75.
- **Scenarios**: curated 5-10 hour challenges. Examples:
  - "Rescue Greenfield Academy in 3 years"
  - "The Inspection From Hell" (inherit a school with an inspection in 6 weeks)
  - "The Merger" (combine two schools)
  - "The Scandal" (start mid-crisis)
  - "Budget Apocalypse" (run a school through a funding cut)
- Both modes use the same underlying simulation.

## 8. Build plan — phased

### Phase 0: Foundations (skeleton only)
- Project setup, language/framework choice (recommend: Python backend + web frontend, or all-in TypeScript)
- Data model definitions for the core entities (pupil, staff, school, alumni, rival school, incident)
- Persistence layer (save/load with both ironman and standard modes)
- Time engine (daily tick, calendar, term/holiday awareness, "continue until interrupt")
- Random generators (names, backstories, personalities) with seeded reproducibility

### Phase 1: Single-school vertical slice
The smallest playable thing. One school, one player-headteacher, one school year.
- Generate a starting school with full pupil and staff rosters
- Inbox UI with incident generation (start with ~20 incident templates)
- Daily continue button with basic interruption rules
- End-of-year results calculation and display
- Save/load
- **Goal**: a player can run one school for one year and feel the loop.

### Phase 2: The data layer
- Spreadsheet-style pupil database with filtering, sorting, search
- Spreadsheet-style staff database same
- Half-termly data drops (mock results) showing pupil progress
- Class/set lists, ability to view and edit
- Basic decisions: move pupil between sets, assign teacher to class
- **Goal**: depth of decision-making is now available for the player who wants it.

### Phase 3: Career layer
- Career start screen (pick a school OR start unemployed)
- Job market: vacancies, applications, interviews
- Reputation system (public + private)
- Movement between schools across multiple years
- Year-in-review summary screen
- **Goal**: a multi-school career arc works end to end.

### Phase 4: Persistent world
- Rival school simulation (abstracted)
- Staff persistence across the sector (headhunting both ways, staff moving between rival schools autonomously)
- Alumni persistence and resurfacing (as parents, future staff, etc.)
- News/events generator drawing on the persistent cast
- Local league tables
- **Goal**: the world feels alive between and across schools.

### Phase 5: Politics and culture
- Governing body composition and dynamics
- Parental factions with mobilisation mechanics
- Staff political tendencies and staffroom dynamics
- Heat on decisions, coalition-building
- External weather events
- **Goal**: decisions have political texture, not just operational consequences.

### Phase 6: Estate management
- Isometric site view
- Room inventory and allocation
- Capital project planning with multi-year budgeting
- Maintenance backlog
- **Goal**: long-horizon estate decisions become a real strategic layer.

### Phase 7: Inspections
- Inspection trigger logic
- Multi-day inspection event flow
- Preparation decisions, during-event decisions
- Outcome and reputation consequences
- **Goal**: inspections feel like the genuine career-defining events they should be.

### Phase 8: Scenarios
- Scenario framework (initial conditions, win/lose criteria, time limits)
- 5-10 launch scenarios
- **Goal**: curated experiences alongside open career.

### Phase 9: Polish
- Year-in-review exportable summaries
- League table screens
- Career summary at retirement
- Tone pass on all generated text (Yes Minister / Simpsons register)
- Balance pass on numbers
- **Goal**: shippable.

### Phase 10 (future): multiplayer/sharing
- Out of scope for now, but architecture should not preclude it.

## 9. Technical recommendations for the prototype

- **Language**: TypeScript end-to-end is probably easiest for solo development and lets the frontend and simulation share types. Alternative: Python simulation + web frontend, more flexible long-term but more friction.
- **Architecture**: pure deterministic simulation core (seeded RNG, no I/O) with a thin presentation layer. This makes ironman saves trivial, enables replay/debug, and keeps testability high.
- **Storage**: JSON saves initially. Move to SQLite if/when save size becomes a problem (likely mid-Phase 4, when persistent world data accumulates).
- **UI**: web-based even for desktop play (Electron-style wrapping later). The interface is mostly tables, forms, inboxes — HTML is the right tool.
- **Test harness**: simulate full careers headlessly to validate balance. Should be possible to run a 30-year career in seconds with no UI.

## 10. Open questions deliberately left for later

- Specific names for the inspectorate, qualification grades, etc. (creative naming pass during Phase 9)
- Exact tone register for generated text (set during Phase 1, refined in Phase 9)
- Balance numbers throughout (will be tuned in playtesting, not designed up-front)
- Visual design and branding (later)
- Multiplayer (Phase 10+)

## 11. First task for Claude Code

Start at Phase 0 + Phase 1. Set up the project skeleton, define core data models, build the time engine and inbox loop, and produce a playable single-school single-year vertical slice.

Acceptance criteria for the first deliverable:
- A player can start a new game with a generated school
- Pupils and staff are generated with full attribute sets
- The player can press "continue" and advance through days
- Incidents fire from a template library and pause the game appropriately
- The player can resolve incidents with choices that update state
- End-of-year results are calculated and displayed
- The game can be saved and loaded
- All of the above runs in a browser or terminal — UI fidelity is secondary to system correctness in this phase
