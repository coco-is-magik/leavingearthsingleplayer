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
rockets to fire. Successful expendable rockets are consumed; minor failures
damage rockets without thrust; major failures destroy the spacecraft.
The engine handles thrust, outcomes, travel, upkeep and mission scoring.

Try the mission planner first: add Earth orbit, Moon orbit, and Moon, then
calculate a probe mission. It computes stages backwards to include later
rockets in earlier payload mass. Procurement may span multiple years. Each
new year resets funding to $25, rather than adding $25. Testing requires real
purchased hardware: underpowered maneuvers are allowed, but remain in place.
A capsule is required when assembling crew;
crew away from Earth need researched life support and one supply per five crew per year.

### Technology prerequisites and outcome decisions

Research and procurement display their requirements and disable unavailable
actions; the engine enforces them independently. Proton requires Soyuz,
Aerobraking requires Reentry, Synthesis requires Life Support, and Space Shuttle
requires both Reentry and Atlas. Habitats require Synthesis. Expansion-only
advancements cannot be researched in a base campaign. The base rockets do not
have an invented Juno → Atlas → Soyuz → Saturn research ladder.

There is no $2 ground-test action. Research deals three hidden outcome cards,
or five for Synthesis. Each actual advancement use draws a random card from
its own stack. A browser dialog lets you return the card, or remove it for $5
(failure), $10 (success), or free (the last success). These decisions happen
sequentially for multiple rockets. Removing a failure never cancels its effects.
Damaged rockets cannot fire until repaired; Earth repairs are free.

References: base rulebook pp. 19–23, Stations p. 4, Outer Planets p. 5.
The scenario outcome supply has 60 successes, 15 minor and 15 major failures;
the supplied rulebook lists 90 cards but does not enumerate their split. Saves
contain the seeded hidden decks, so inspecting exported JSON reveals them.
Old saves with numerical reliability counters are accepted: proven technologies
remain proven; uncertain technologies receive new cards deterministically on
the next successful action. Existing researched technologies are retained even
if an older version let you acquire them without prerequisites.

### Saved and editable mission plans

Calculate a mission, name it, and choose **Save mission** or **Save as copy**.
Up to 20 plans are stored with the campaign, included in autosaves, backups and
JSON exports. Loading restores the saved stages; recalculating creates a new
draft rather than overwriting your saved mission. New campaigns clear the library.

Edit rocket counts per stage or edit the initial component manifest using
comma-separated component keys. Stage edits update that launch's manifest;
earlier stages are checked rather than silently recalculated. For an onward
orbital-assembly stage, explicitly add its changed hardware to a launch manifest.

**Check mission** recomputes mass, thrust, inventory consumption, route
connectivity, seats, food, rendezvous locations, prerequisites and arrival year.
It separates physical feasibility from readiness with current unassembled
inventory and research. It assumes successful outcomes and reports uncertain
technologies. It does not simulate procurement delays, random failure, production,
later sample collection, reusable propulsion or multi-year assembly scheduling.
Invalid but structurally well-formed plans may be saved for later correction.

The campaign runs from 1956 through 1976. Score more points than remain in the
mission pool to win. The journal records results. Saves happen automatically
after actions; export/import JSON provides portable backups. Save data is
scoped to this app, with a previous-valid-save fallback. Browser storage can
be unavailable or cleared; export important campaigns.

## Rendezvous and expansion scenario support

In Campaign archive, choose **New campaign: Stations + Outer Planets** to
enable both expansion scenarios. Existing saves retain their original rules.
Expansion campaigns end in 1986; Stations uses $30 annual funding.

- Dock stationary spacecraft at the same off-Earth location; separate selected
  components even during transit. Both children retain the travel time. Crew
  must retain seats, and samples retain their source when transferred.
- The planner compares all available expendable-rocket technology subsets,
  prioritizing the fewest **new** advancements (including prerequisites and
  maneuver hazards), then hardware cost. Hardware-first is also selectable.
  Orbital assembly is evaluated as a separate multi-launch strategy; the result
  reports its comparison even when a direct launch is better. Assembly uses
  independently launched modules followed by docking at Earth orbit.
- Outer-system scenario destinations include Jupiter, Saturn, Uranus, Neptune,
  the Galilean moons, Titan and Enceladus. Proton and Aerobraking enforce their
  Soyuz and Reentry prerequisites. Scientists can study samples remotely;
  combined expansion games require a science module for this.
- Stations adds habitats/seats, ground habitat construction by mechanics,
  food (one unit feeds five crew), hydroponics, atmospheric fuel generators,
  reusable Shuttle/Daedalus rockets with matching tanks, and experiments.
  Production occurs at the beginning of a new year, after the previous year's
  upkeep. Constructed ground habitats cannot move.

Rules references used: base PDF pp. 27–30 (rendezvous), Outer Planets pp. 5–6,
9 and 16 (prerequisites, calendar, aerobraking, scientists), Stations pp. 17–20
and 25–26 (habitats, reusable propulsion, production and food). BoardGameGeek
blocked automated access (HTTP 403); no reference photos were imported.

**These are partial expansion implementations, not complete expansion decks.**
Added component prices/masses/thrust and outer-system routes/objectives are
explicit provisional scenario data, not verified printed-card transcriptions.
Experiments can be performed but do not yet have return/scoring objectives.
Galileo and Explorer are purchasable payloads, but their special survey,
radiation and discard missions are not implemented. Missing expansion rules
include features/rovers, medical/repair components and damage, radiation,
slingshot windows, mental health, occupation and astronaut-death scoring,
and original mission selection. Joint ventures are not used in solitaire.

The planner searches single-type expendable stages, not mixed-engine or
reusable propulsion, and does not search lunar-orbit lander rendezvous,
arbitrary separation schedules or launch windows. Hardware selection within
each technology subset is heuristic. It does not supply crew food automatically.

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
- Research now uses outcome decks and paid removal after actual uses. Rocket
  minor/major failures and damage are implemented. Other advancement failure
  effects remain simplified: failed landing/reentry destroys the craft,
  rendezvous does not yet damage a chosen component, and production failures
  do not yet damage modules. Full rendezvous testing is not implemented.
- Planets have fixed known conditions. Surveys, hazards from hidden location
  cards, most astronaut skills, ion drives and variable-speed travel remain
  unavailable. Expansion and rendezvous coverage is described above.
- The planner reports research separately from hardware, excludes failures
  and upkeep costs, and does not infer supply or sample requirements.

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
