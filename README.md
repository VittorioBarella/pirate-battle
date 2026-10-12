# Pirate Battle

A single-player, top-down naval shooter built with React, TypeScript and PixiJS.

## Current status

Project setup, game assets, typed gameplay configuration, input
state and the first gameplay simulation are implemented.

The simulation includes movement, weapons, enemy spawning,
Chaser and Shooter behavior, collisions, scoring and match completion.

The application still displays the Vite starter screen.
PixiJS rendering, React integration, API integration and gameplay
tests are pending. Build and lint checks pass.

## Technology stack

- React and TypeScript: interface and application code.
- Vite: development server and production build.
- PixiJS: planned game rendering.
- Axios and TanStack Query: planned ranking and match history integration.
- MSW: planned REST API simulation.
- Playwright: browser testing.
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

The initial smoke test checks the starter counter. Gameplay tests and visual
regression coverage will be added during implementation.

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
The simulation uses this configuration. Integration with the
playable interface and ranking is pending.

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
Keyboard and touch event listeners will be connected during
game integration.

Gameplay behavior still requires automated tests and playtesting.

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