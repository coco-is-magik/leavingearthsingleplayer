# Leaving Earth — local mission control prototype

## Run

Requires Node.js 22 or newer. No packages or network access are required.

```sh
npm start
```

Open `http://127.0.0.1:8080` in your browser. The server binds only to the
IPv4 loopback interface and serves an explicit allowlist of application files,
not the PDFs, repository, or save files. Stop with Ctrl+C.

```sh
npm test
```

## Playing

Start in Research & procurement. Research rocket technology, buy components,
and assemble selected inventory in Mission control. Select a maneuver and the
rockets to expend. All selected rockets are consumed, even when a burn fails.
The engine handles thrust, outcomes, travel, upkeep and mission scoring.

Try the mission planner first: add Earth orbit, Moon orbit, and Moon, then
calculate a probe mission. It computes stages backwards to include later
rockets in earlier payload mass. Procurement may span multiple years. Each
new year resets funding to $25, rather than adding $25. Ground testing improves
reliability only when a test fails. A capsule is required when assembling crew;
crew away from Earth need researched life support and one supply per year.

The campaign runs from 1956 through 1976. Score more points than remain in the
mission pool to win. The journal records results. Saves happen automatically
after actions; export/import JSON provides portable backups. Save data is
scoped to this app, with a previous-valid-save fallback. Browser storage can
be unavailable or cleared; export important campaigns.

## Important scope limitations

**This is a playable prototype, not a complete or rules-faithful implementation
of Leaving Earth.** The supplied PDFs remain unchanged. The earlier reference
recovery did not establish complete card data. No external artwork is shipped;
the Earth illustration is generated with CSS.

Implemented: research and purchases, inventory/assembly/disassembly, staged
rocket burns, a simplified inner-system route network, multi-year travel,
crew upkeep, samples, fixed missions, annual funding, scoring, deterministic
randomness, a staging planner, local saves, and a loopback-only server.

Deliberate prototype substitutions:

- The mission set and route network are simplified scenario data, not the full
  printed decks. All eight missions are active; there is no difficulty draw.
- Research uses three failure tokens and three implicit success tokens. Each
  failure permanently removes a failure token. Ground tests cost $2. This is
  **not** the original outcome-deck/research-removal system.
- Failed propulsion consumes rockets without movement; failed landing/reentry
  destroys the craft. Individual component damage is not modeled.
- Planets have fixed known conditions. Surveys, hazards from hidden location
  cards, astronaut skills, rendezvous, separation away from Earth, ion drives,
  variable-speed travel, and expansion mechanics are unavailable.
- The planner minimizes hardware cost among single-type rocket stages, not
  all mixed-engine possibilities. It excludes research, failures, and upkeep
  costs and does not infer supply or sample requirements automatically.

These gaps prevent treating the prototype as the complete game requested.
The interface repeats this limitation rather than silently presenting invented
scenario data as verified rules.

## Modules and verification

`data.js` contains scenario constants. `engine.js` contains pure transactional
actions and save validation; failed actions do not mutate the caller's state.
`planner.js` implements backward staging, `storage.js` owns namespaced browser
saves, and `app.js` renders and dispatches user actions. No runtime dependencies,
analytics, CDNs or external requests are used.

Tests cover budgets, assembly, invalid actions, burn calculations, deterministic
outcomes, time progression, life support, sample collection, executable flight
plans, save recovery/validation, and HTTP asset restrictions. Browser appearance
and real interactive browser workflows still require manual verification.
