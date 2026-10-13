# Pirate Battle

A single-player, top-down naval shooter built with React, TypeScript and PixiJS.

## Current status

The playable battle is integrated with React and PixiJS. It includes
ship movement, frontal and lateral attacks, Chaser and Shooter enemies,
collisions, health, scoring and match completion.

Keyboard and touch controls, manual pause, automatic pause on focus
loss, the result screen and restart are implemented. The game has
been launched and played locally.

The menu layout and Options screen have been implemented and are
awaiting validation. Options include session duration (60–180 seconds)
and enemy spawn interval (1–15 seconds), saved in browser local
storage. Each match receives a separate configuration snapshot.

MSW and the TanStack Query provider are initialized. Ranking and
history screens now use Axios and TanStack Query to request paginated
mock API records, with loading, empty, error and refresh states.

Ranking compares matches with the same gameplay configuration.
History displays the local player's registered matches.
Ranking and history have been loaded and pagination has been
checked locally.

Completed matches are now saved locally before submission.
Successful submissions invalidate ranking and history queries.
Failed submissions remain in a persistent queue, with automatic
retry on application startup and a manual retry button.

The last completed result is restored after reload. Starting another
battle preserves earlier pending submissions. Abandoned battles
are not submitted.

Manual checks completed on October 13, 2026:
- Recovery from a simulated offline API failure using Retry pending.
- The recovered match remained visible after reloading, without duplication.
- In the commit-timeout scenario, automatic retry recovered the saved
  match and the history count increased by exactly one.

These checks were performed locally in Chrome. Automated E2E coverage
for these scenarios is still pending.

Persistence currently assumes available browser local storage
and a single active application tab.

## Technology stack

- React and TypeScript: interface and application code.
- Vite: development server and production build.
- PixiJS: game rendering.
- Axios and TanStack Query: ranking and history requests and caching.
- MSW: browser-based REST API simulation.
- Playwright: automated simulation checks and browser testing.
- ESLint: static code analysis.

## Setup

The initial setup was run with Node.js 20.19.6 and npm 10.8.2.

```bash
git clone https://github.com/VittorioBarella/pirate-battle.git
cd pirate-battle
npm ci
npx playwright install chromium
```

## Development

```bash
npm run dev
```

Open the local URL printed in the terminal.

No environment variables or private services are required for the current setup.

## Build and preview

```bash
npm run build
npm run preview
```

## Code quality

```bash
npm run lint
```

The build command also runs the TypeScript checks configured by the starter.

## Automated tests
The options and pause suite covers saving and restoring options,
rejecting empty and out-of-range values, cancelling changes,
and freezing the game timer during manual and focus-loss pauses.

Latest local execution on October 13, 2026:
8 tests passed across desktop Chromium and Pixel 7 emulation.
Production build passed. ESLint reported no errors and one warning
in the generated MSW service worker.

```bash
npm test
```

Playwright starts a dedicated development server at http://127.0.0.1:5174.

The configuration includes:

- Chromium with a desktop viewport.
- Chromium with Pixel 7 emulation.
- HTML reports.
- Screenshots and traces retained on failure.

Mobile emulation does not replace testing on a physical device.

The browser smoke suite covers the main menu, game canvas startup,
ranking pagination and empty history.

Latest local execution on October 13, 2026:
8 tests passed across desktop Chromium and Pixel 7 emulation.

Broader gameplay and API recovery E2E tests, along with visual
regression coverage, are still pending.
The simulation tests are described below.

### View the latest report

```bash
npm run test:report
```

### Update visual baselines

Once screenshot assertions are implemented, review intentional visual changes
and update their baselines with:

```bash
npm run test:update
```

### Generated output

- `playwright-report/`: local HTML report.
- `test-results/`: temporary test output, including failure artifacts.
- `reports/`: reserved for delivery evidence and profiling results.

Local test output is ignored by Git. Final delivery evidence will be
preserved separately. The initial starter smoke test passed in desktop
and mobile emulation. Gameplay test reports and performance measurements
are pending.

## Documentation roadmap

The following documentation will be added alongside implementation:

- Controls, gameplay configuration and supported mobile orientation.
- Network scenarios, reset instructions and failure reproduction.
- `ARCHITECTURE.md`: simulation, rendering, input, collisions, resource cleanup,
  persistence, API contracts, cache and pending submission recovery.
- Test and performance reports, including environment details and limitations.
- Public deployment URL and clean-checkout verification.

## Gameplay configuration

Balance parameters are defined in `src/config/gameConfig.ts`.

- Default session duration: 120 seconds.
- Allowed session duration: 60–180 seconds.
- Default enemy spawn interval: 4 seconds.
- Allowed spawn interval: 1–15 seconds.
- Logical arena size: 960 × 600.
- Initial player health: 100.

Time values use seconds. Movement speeds use logical units per second.
Rotation speeds use radians per second. Distances use logical arena units.

The spawn interval limits are an initial balance decision, subject to
playtesting and performance validation.

`makeConfig` creates a separate configuration object for each match.
`configKey` serializes all configuration values for ranking comparisons.

The Options screen persists session duration and spawn interval.
The playable interface passes these settings to the simulation.
Ranking requests use the full configuration key to select
comparable matches. The ranking integration is awaiting validation.

## Assets

Game images are stored in `public/assets/`.
See [ASSET_SOURCES.md](ASSET_SOURCES.md) for provenance and license notes.

## Game simulation

Gameplay rules live in `src/game/simulation.ts`, independently
of React and PixiJS.

- `move()`: ship movement, arena bounds and island collision checks.
- `spawn()`: enemy creation and safe spawn placement.
- `fire()`: projectile creation for frontal and lateral attacks.
- `segmentHit()`: projectile segment collision checks.
- `update(dt)`: movement, cooldowns, spawning, enemy behavior,
  damage, scoring, cleanup and match completion.
- `snapshot()`: a copy of selected simulation state for inspection.

Time is supplied to `update(dt)` in seconds. Paused or completed
matches do not advance through this method.

Input state and keyboard mappings live in `src/game/input.ts`.
Keyboard and touch event listeners are connected through
`src/components/Game.tsx`.

Initial simulation tests passed, and the game has been played locally.
Broader gameplay validation and browser E2E coverage are pending.

## Simulation tests

Run the simulation checks with:

```bash
npm test -- tests/simulation.spec.ts --project=desktop
```

The four tests cover configuration isolation, paused simulation,
projectile lifetime and lethal Chaser collision without scoring,
including prevention of updates after match completion.

These tests run directly against the simulation, without a browser.
They complement the upcoming browser E2E tests.

Latest local execution: 4 tests passed.