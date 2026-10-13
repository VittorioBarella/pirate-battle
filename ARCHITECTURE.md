# Architecture

## Responsibilities

- `App.tsx`: React screens, persisted gameplay options, restored results
  and integration with match submission. The captain name is currently
  fixed as `Captain`.
- `components/Game.tsx`: lifecycle boundary for one game, asynchronous
  texture and renderer initialization, event listeners, fixed-step
  accumulator, 10 Hz HUD updates, test bridge and pause dialog.
- `components/Options.tsx`: gameplay option inputs, validation,
  save and cancellation.
- `components/DataPanel.tsx`: paginated ranking and history queries,
  loading states, error feedback and manual refresh.
- `hooks/useMatchSubmission.ts`: persistent completed-match queue,
  TanStack Query mutations, serialized submissions, retries and
  cache invalidation.
- `game/simulation.ts`: plain TypeScript rules, entities, collision
  checks, enemy AI, seeded spawning, combat, scoring and ending
  conditions. No React or PixiJS imports.
- `game/input.ts`: independent source-to-action map. Keyboard inputs
  and individual pointer IDs can hold multiple actions. Releasing
  one source does not cancel another source's action.
- `game/renderer.ts`: PixiJS application, shared texture loading,
  ocean, islands, sprites, health bars, cannonballs and short-lived
  effects. Maps keyed by simulation IDs retain display objects.
- `config/gameConfig.ts`: typed balance configuration, gameplay
  options and configuration identity.
- `api/`: shared contracts, Axios transport and local-storage helpers.
- `mocks/`: MSW browser worker, deterministic fixtures, scenario
  delays and persistent mock API state.
- `scripts/profile.mjs`: optimized-build profiling with real keyboard
  input, ticker measurements and post-GC heap samples.

## React / Pixi boundary

The React effect creates a private PixiJS application asynchronously.
Cancellation is checked around asynchronous initialization. If cleanup
occurs during initialization, the late application is destroyed rather
than retained by an unmounted game.

A ResizeObserver adjusts the canvas display size while preserving a
960 × 600 logical world. CSS scales the arena uniformly. Rendering
resolution uses the device pixel ratio, capped at 2.

Touch controls are semantic React buttons. They trigger movement,
rotation and weapon actions rather than screen-position aiming, so
screen-to-world aiming conversion is unnecessary.

Cleanup disconnects observers, removes keyboard, focus and visibility
listeners, clears held inputs and destroys the per-game PixiJS
application and display objects.

Textures remain shared in the asset cache to avoid repeated loading
across matches. Entities and effects reuse display objects while their
simulation IDs remain present; removed objects are destroyed.

Simulation state is not published to React every frame. HUD snapshots
are published at approximately 10 Hz. React updates also handle discrete
events such as pause, loading failure and match completion.

## Time and simulation

Ticker delta time feeds an accumulator. Incoming delta time is capped
at 100 ms per frame, and simulation updates consume fixed 1/60-second
steps.

Hidden pages and focus loss pause the game and clear held input.
Returning to the page does not automatically resume combat. The player
resumes explicitly through the pause dialog.

Paused ticks clear the accumulator. Long visible stalls discard excess
wall time to avoid a catch-up spiral. The match timer therefore measures
simulated active time rather than uninterrupted wall-clock time.

An update applies player rotation and movement, independent weapon
cooldowns, spawn timing, enemy behavior, projectile processing and
entity cleanup. Paused or ended simulations return without advancing
gameplay.

The final update is clamped to the configured session deadline.
A completion guard emits one result for each game instance. React
then unmounts combat, releasing the ticker and renderer.

Restart creates a fresh simulation and configuration snapshot.
Abandonment and page reload during active combat do not register a
completed match.

## Collisions and AI

Ships and islands use circles in logical world units. Proposed ship
movement is clamped to arena boundaries and rejected if it overlaps
an island.

Enemies turn toward the player with bounded angular velocity.
Near an obstructing island, a tangential heading provides local
avoidance. Movement rejection remains the final collision guard.
This is local steering rather than global pathfinding.

Chasers disappear on contact, damaging the player without adding score.
Shooters stop near their attack distance and fire only when aligned,
within range and off cooldown.

Cannonballs carry direction, damage, lifetime and ownership.
Swept segment-to-circle checks reduce tunneling through ships and
islands between updates.

The simulation selects a matching target and checks island obstruction
before applying damage. Target ordering uses distance to entity centers;
it does not calculate an exact geometric impact time for every candidate.

A hit removes the projectile, prevents another hit, triggers damage
feedback and awards one point only when a player projectile destroys
an enemy. Enemies with zero health are ignored by later projectile
checks and removed during cleanup.

Front shots and each broadside have separate cooldowns. Broadside
offsets are perpendicular to a shared firing direction, producing
three parallel trajectories.

## Contracts and consistency

`GET /api/ranking?page=&config=&playerId=` returns a `Page` containing
up to five matches.

The configuration key serializes the entire typed configuration.
Configuration objects are constructed with a consistent property order.
Matches with different configuration keys are excluded from the same
ranking comparison.

Ranking ties resolve by score descending, duration ascending,
date ascending and then ID ascending. Fixtures represent other players
using the default configuration.

`GET /api/history?page=&playerId=` returns the local player's confirmed
matches, newest first.

`POST /api/matches` accepts a `Match`: UUID, player ID, player name,
ISO date, score, active duration, ending reason and configuration snapshot.

The UUID acts as the idempotency key. MSW uses one confirmed-match store
for ranking and history. A previously confirmed ID returns its existing
record, including after an ambiguous `commit-timeout` response.
Repeated submissions with that ID do not create duplicate records.

Axios uses a 1,800 ms timeout. TanStack Query keys include resource,
configuration, player ID and page. Requests receive the Query-provided
AbortSignal.

Distinct resources and pages use separate cache entries. Queries refetch
on component mount, window focus and manual refresh. Successful match
mutations invalidate ranking and history query prefixes.

Queries and mutations retry once. Once MSW has initialized, simulated
API request failures do not block gameplay initialization or simulation
updates. Failure to initialize the MSW worker itself displays the
application startup error screen.

## Persistence and pending sends

Active local-storage keys use the `pb:` prefix:

- `options`: saved session duration and spawn interval.
- `last`: last completed result.
- `pending`: matches awaiting confirmed registration.
- `confirmed`: browser-local mock API records.
- `scenario`: selected mock network scenario.

On completion, the result and pending queue are persisted before POST.
The queue supports multiple matches; starting another battle preserves
earlier pending submissions.

Successful mutations remove only the acknowledged UUID. Pending sends
are retried on application initialization or through the manual retry
button. A shared mutation scope serializes submission attempts.

Idempotent registration protects against duplicate records when
initialization or delivery is repeated. Refresh during active combat
abandons the unrecorded simulation.

The MSW store models a browser-local server rather than a shared backend.
Persistence assumes available browser storage and one active application
tab. Concurrent tabs, malformed stored data and storage quota exhaustion
are limitations. Reads have fallback handling; writes can fail if storage
is unavailable.

## Testing and observability

The controlled test bridge requires both `VITE_TEST_MODE=true` and the
`?test` URL parameter. It allows tests to inspect state, seed bodies and
advance the real simulation in fixed steps while actual input handlers
and PixiJS rendering remain connected.

Visual baselines cover the menu, initial arena and completed result.
Arena snapshots use controlled simulation state. Ranking dates are
masked to avoid timezone-dependent differences. Current baselines were
generated on Windows.

The normal build with test mode disabled does not enable controlled
state manipulation.

The optional `?profile=1` observer returns copied simulation snapshots.
It cannot advance time or modify entities. The profiling script drives
the game through real keyboard input.

Ticker interval and entity-count arrays retain at most 20,000 samples.
These bounded metrics remain available for inspection after a match.
Resource counters are diagnostic values, not proof that all memory has
been released.

`scripts/profile.mjs` records browser version, CPU, system memory,
viewport, device pixel ratio, ticker frequency, interval p95, retained
entity counts and post-GC JavaScript heap usage.

The confirmed complete test execution passed 66 tests, with two
desktop touch tests intentionally skipped. Those touch tests passed
in the mobile project. Mobile emulation does not establish physical
device compatibility.

Balance uses 100 player health, 22 Chaser contact damage,
12 Shooter projectile damage, 25 front damage and 20 broadside damage.
The opening spawns demonstrate both enemy types before seeded random
selection. Faster spawn settings increase difficulty.

For a complete three-minute profiling session, `VITE_PROFILE_MODE=true`
changes player health to 10,000. It does not change movement, weapons,
damage or enemy behavior. Normal builds use 100 HP.

`npm run profile:build` writes the optimized profiling output to
`.profile-dist/`, which is ignored by Git. The profiling environment
flags must be supplied when building. `npm run profile:preview`
serves that output, and `node scripts/profile.mjs` generates
`reports/profile-stress.json`.

The recorded session completed 180 active seconds. Its retained ticker
samples had a 6.2 ms interval p95. After five short restart cycles,
post-GC JavaScript heap usage increased by approximately 365 KB.
No canvas elements remained after the measured cleanup steps.

Ticker intervals do not measure GPU execution time, and JavaScript
heap samples exclude total browser and GPU memory. The observed heap
growth requires further investigation; these measurements do not
establish leak-free behavior.

Production deployment uses the normal build with both test and
profiling modes disabled.