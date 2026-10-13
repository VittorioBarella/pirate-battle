# Pirate Battle

A single-player, top-down naval shooter built with React, TypeScript and PixiJS.

Live game: [pirate-battle-xi.vercel.app](https://pirate-battle-xi.vercel.app/)

## Current status

The game is playable locally and deployed on Vercel. React manages the
interface and PixiJS renders the arena, ships, projectiles, health bars
and combat effects.

Implemented features include:

- Ship movement and rotation.
- Front cannon and parallel port/starboard broadsides.
- Chaser and Shooter enemies.
- Arena boundaries, island collisions, damage and scoring.
- Match completion by player death or session timeout.
- Keyboard and on-screen pointer controls.
- Manual pause and automatic pause on focus loss.
- Result display, restart and abandonment without match registration.
- Persisted gameplay options and last completed result.
- Paginated ranking and match history.
- Persistent submission queue with startup and manual retry.
- Idempotent mock registration after an ambiguous timeout.
- Asset loading failure feedback and retry.

Automated checks cover options, pause, movement, combat, enemy spawning,
Shooter damage, match lifecycle, asset failures, ranking pagination,
submission recovery, simultaneous touch input, projectile collisions
and visual regression.

The complete suite passed 66 tests, with two desktop touch tests
intentionally skipped. Performance measurements have also been recorded.

Installation, the normal production build and the complete test suite
were verified in a fresh clone of the GitHub repository.

The public deployment was opened in a Chrome incognito window without
requiring authentication. Controls, pause, match registration and history
persistence were manually checked on the published version.

Physical-device checks were performed on a Motorola G6 with Chrome
and an iPhone 13 with Safari. Their confirmed results and the unresolved
Motorola countdown issue are documented in the Controls section.

Browser persistence assumes available local storage and a single active
application tab. The mock API is browser-local, not a shared backend.

## Technology stack

- React and TypeScript: interface and application code.
- Vite: development server and production build.
- PixiJS: game rendering.
- Axios: HTTP requests.
- TanStack Query: request state, caching and mutations.
- MSW: browser-based REST API simulation.
- Playwright: simulation checks and browser tests.
- ESLint: static code analysis.

## Setup

The initial setup was run with Node.js 20.19.6 and npm 10.8.2.

```bash
git clone https://github.com/VittorioBarella/pirate-battle.git
cd pirate-battle
npm ci
npx playwright install chromium
```

No private backend or credentials are required.

MSW requires localhost or HTTPS and browser service worker support.
The mock worker starts in both development and production.

## Development

```bash
npm run dev
```

Open the local URL printed in the terminal.

## Build and preview

```bash
npm run build
npm run preview
```

The build command runs TypeScript checks and creates the production output
in `dist/`.

The latest confirmed normal production build passed in a clean checkout.
Vite reported a warning about a JavaScript chunk exceeding 500 kB after
minification.

The Vercel deployment uses:

- Application preset: Vite.
- Root directory: `./`.
- Install command: `npm ci`.
- Build command: `npm run build`.
- Output directory: `dist`.
- `VITE_TEST_MODE=false`.
- `VITE_PROFILE_MODE=false`.

Runtime profiling results are documented in the Performance profiling
section. Initial loading performance has not been measured separately.

## Code quality

```bash
npm run lint
```

TypeScript checks can also be run separately:

```bash
npx tsc -b
```

The clean-checkout lint execution reported zero errors and one unused
`eslint-disable` warning in the generated `public/mockServiceWorker.js`.

When `.profile-dist/` is present, its generated worker copy also produces
the same warning.

## Controls

| Action | Keyboard |
| --- | --- |
| Move forward | W / Arrow Up |
| Rotate left | A / Arrow Left |
| Rotate right | D / Arrow Right |
| Front cannon | Space |
| Port broadside | Q |
| Starboard broadside | E |
| Pause | P / Escape |

On touch devices, hold the on-screen controls to move, rotate and fire.

Pausing freezes simulation time. Losing window focus also pauses the game.
Resume explicitly through the pause dialog.

Abandoning a battle returns to the menu without submitting a result.
Reloading during combat abandons the active simulation.

Portrait (412 × 915) and landscape (915 × 412) layouts were manually
checked in Chrome's Pixel 7 emulation on October 13, 2026.
Controls remained accessible, and the paused timer remained unchanged
during the manual waiting check.

In landscape, the controls overlap a narrow strip at the bottom
of the arena.

Physical-device checks on the public deployment were performed on
October 13, 2026:

| Device | Browser | Confirmed manual observations |
| --- | --- | --- |
| Motorola G6 | Chrome | Gameplay, portrait and landscape layouts, simultaneous movement and firing with two fingers, manual pause and resume |
| iPhone 13 | Safari | Arena and controls displayed in portrait; the active countdown decreased from 120 to 112 seconds |

On the Motorola G6, the displayed countdown was reported to remain at
120 seconds while combat continued. Switching the page back from automatic
Portuguese translation to English did not resolve the reported behavior.
The cause has not been identified, and countdown behavior on this device
remains an unresolved compatibility issue.

Browser and operating system versions were not recorded for the physical
devices. These checks do not establish compatibility with all mobile devices.

## Gameplay configuration

Balance parameters are defined in `src/config/gameConfig.ts`.

| Parameter | Default | Allowed options |
| --- | --- | --- |
| Session duration | 120 seconds | 60–180 seconds |
| Enemy spawn interval | 4 seconds | 1–15 seconds |
| Logical arena size | 960 × 600 | Defined in configuration |
| Initial player health | 100 | Defined in configuration |

Time values use seconds. Movement speeds use logical units per second.
Rotation speeds use radians per second. Distances use logical arena units.

The Options screen validates and persists session duration and spawn interval.
`makeConfig` creates a separate configuration object for each match.
The simulation also copies its configuration.

`configKey` serializes all configuration values. Ranking requests use this
key to compare matches played with the same gameplay configuration.

The spawn interval limits are a balance decision subject to further
playtesting.

## Match persistence and API

Completed matches are saved locally before submission.

Successful submissions remove the acknowledged match from the pending
queue and invalidate ranking and history queries.

Failed submissions remain queued across reloads. Pending matches are
retried on application startup or through the `Retry pending` button.
Starting another battle preserves earlier pending submissions.

Each match has a unique ID used by the mock API to prevent duplicate
registration. In the `commit-timeout` scenario, the API stores the match
before delaying its response. A retry returns the existing record.

Ranking includes fixtures representing other players and confirmed matches
with the selected configuration. History displays confirmed matches for
the local player.

Endpoints:

- `GET /api/ranking?page=&config=&playerId=`
- `GET /api/history?page=&playerId=`
- `POST /api/matches`

List responses contain `items`, `total`, `page` and `pageSize`.
Pages contain up to five matches.

## Mock network scenarios

Set a scenario through the browser developer console:

```js
localStorage.setItem("pb:scenario", JSON.stringify("offline"));
```

Available scenarios:

| Scenario | Behavior |
| --- | --- |
| `success` | Successful requests |
| `empty` | Empty ranking and history responses |
| `slow` | Delayed responses |
| `variable` | Alternating response delays |
| `timeout` | Delay exceeding the Axios timeout |
| `offline` | Simulated network failure |
| `http-400` | HTTP 400 response |
| `http-500` | HTTP 503 response |
| `ranking-error` | Ranking request failure |
| `history-error` | History request failure |
| `commit-timeout` | Match stored before a delayed response |
| `unavailable` | HTTP 503 response |

For list scenarios, select the scenario and click `Refresh`.
For submission scenarios, select it before completing a battle.

To restore successful requests:

```js
localStorage.setItem("pb:scenario", JSON.stringify("success"));
```

Then refresh the list or retry pending submissions.

To reset all application persistence, run:

```js
Object.keys(localStorage)
  .filter((key) => key.startsWith("pb:"))
  .forEach((key) => localStorage.removeItem(key));

location.reload();
```

Resetting removes saved options, results, pending submissions and confirmed
mock matches. Ranking fixtures are generated separately.

## Automated tests

Run the complete suite:

```bash
npm test
```

Playwright starts a dedicated development server at
`http://127.0.0.1:5174`.

The configuration includes:

- Desktop Chromium at a 1280 × 900 viewport.
- Chromium with Pixel 7 emulation.
- HTML reports.
- Screenshots and traces retained on failure.
- `VITE_TEST_MODE=true` for the test server.

The game test bridge additionally requires the `?test` URL parameter.
Combat tests use controlled setup and fixed simulation steps while
exercising actual game rules, keyboard handlers and rendering.

### Suites and confirmed results

Results recorded locally on October 13, 2026:

| Suite | Coverage | Confirmed execution |
| --- | --- | --- |
| `setup.spec.ts` | Menu, canvas startup, ranking pagination and empty history | 8 passed |
| `options-pause.spec.ts` | Save, reload, validation, cancellation and manual/focus-loss pause | 8 passed |
| `combat.spec.ts` | Movement, weapons, damage, scoring, enemies, assets and match lifecycle | 16 passed |
| `api-recovery.spec.ts` | Submission recovery, ranking/history updates, configuration separation, interrupted requests and multiple pending matches | 14 passed |
| `simulation.spec.ts` | Configuration isolation, pause, projectile lifetime and lethal Chaser contact | 8 passed (4 checks repeated in both projects) |
| `visual.spec.ts` | Menu, initial arena and completed result screenshots | 6 passed |
| `touch.spec.ts` | Simultaneous movement/fire, touch release, cancellation and independent keyboard input | 2 passed in the mobile project |
| `collisions.spec.ts` | Island projectile blocking and single-target swept collision | 4 passed (2 checks repeated in both projects) |

The preserved complete suite execution passed 66 tests in 3.2 minutes.
A subsequent execution in a clean checkout passed 66 tests in 3.1 minutes.

Two touch tests were intentionally skipped in the desktop project
and passed in the mobile project.

The normal production build passed with test and profiling modes
disabled. Vite reported a chunk-size warning.

The clean-checkout lint execution reported zero errors and one warning
in the generated MSW worker.

### Run individual suites

```bash
npm test -- tests/setup.spec.ts
npm test -- tests/options-pause.spec.ts
npm test -- tests/combat.spec.ts
npm test -- tests/api-recovery.spec.ts
npm test -- tests/simulation.spec.ts --project=desktop
npm test -- tests/visual.spec.ts
npm test -- tests/touch.spec.ts --project=mobile
npm test -- tests/collisions.spec.ts --project=desktop
```

Simulation and collision checks run directly against TypeScript rules
without requesting a browser page. They complement browser E2E tests.

### View the latest report

```bash
npx playwright show-report playwright-report
```

The preserved delivery report can be opened with:

```bash
npx playwright show-report reports/playwright-final
```

### Visual baselines

Versioned screenshots cover the menu, initial arena and completed result
in desktop Chromium and Pixel 7 emulation.

Baselines are stored in `tests/visual.spec.ts-snapshots/`.
The current images were generated on Windows; rendering can differ across
operating systems and browser versions.

Ranking dates are masked to avoid timezone-dependent screenshot differences.

Run visual comparisons with:

```bash
npm test -- tests/visual.spec.ts
```

Review intentional layout changes before updating baselines:

```bash
npm test -- tests/visual.spec.ts --update-snapshots
```

Latest local execution on October 13, 2026: 6 tests passed.

### Generated output

- `dist/`: production build output.
- `playwright-report/`: latest local HTML report.
- `test-results/`: temporary test output and failure artifacts.
- `reports/`: profiling results and preserved delivery evidence.

Generated local build and test output is ignored by Git.
The profiling JSON and preserved delivery report are versioned
under `reports/`.

## Game simulation

Gameplay rules live in `src/game/simulation.ts`, independently of React
and PixiJS.

- `move()`: ship movement, arena bounds and island collision checks.
- `spawn()`: enemy creation and safe spawn placement.
- `fire()`: front and broadside projectile creation.
- `segmentHit()`: swept projectile segment collision checks.
- `update(dt)`: movement, cooldowns, spawning, enemy behavior, damage,
  scoring, cleanup and match completion.
- `snapshot()`: copies selected state for inspection.

`update(dt)` receives seconds. Paused or completed matches do not advance.

Input state and keyboard mappings live in `src/game/input.ts`.
Keyboard and pointer listeners are connected through
`src/components/Game.tsx`.

PixiJS rendering and shared texture loading live in `src/game/renderer.ts`.

## Assets

Game images are stored in `public/assets/`.

See [ASSET_SOURCES.md](ASSET_SOURCES.md) for provenance and license notes.

## Documentation and delivery

Public game: [pirate-battle-xi.vercel.app](https://pirate-battle-xi.vercel.app/)

Source repository:
[VittorioBarella/pirate-battle](https://github.com/VittorioBarella/pirate-battle)

[ARCHITECTURE.md](ARCHITECTURE.md) documents component responsibilities,
simulation timing, rendering lifecycle, input, collisions, API consistency,
persistence and profiling limitations.

Clean-checkout validation completed on October 13, 2026:

- `npm ci` completed successfully.
- The normal production build passed.
- ESLint reported zero errors and one warning in the generated MSW worker.
- The complete suite passed 66 tests in 3.1 minutes, with two intentional
  desktop touch skips.
- The generated worker's normalized content matched the committed file.
  Restoring that file cleared its Git modification marker.
- The working tree was clean after validation.

The public deployment and physical-device checks are documented above.
The Motorola G6 countdown issue remains unresolved.

The preserved automated test report is available in
`reports/playwright-final/`, and the profiling report is available in
`reports/profile-stress.json`.

## Performance profiling

An optimized profiling build was measured locally on October 13, 2026.

Environment:

- Windows x64.
- Intel Core i7-11800H, 16 logical CPUs.
- 15.73 GiB system memory.
- Chromium 156.0.8078.4.
- Viewport: 1280 × 900; device pixel ratio approximately 1.

The session used a 180-second duration, four-second enemy spawn
interval and held movement, rotation and all weapon inputs.

The profiling configuration increases player health to 10,000
to allow the complete session to finish. Normal builds use 100 HP.
Movement, combat and enemy behavior remain unchanged.

Results:

- Active session duration: 180 seconds.
- Wall duration until completion detection: 180.15 seconds.
- Retained ticker samples: 20,000.
- Average ticker frequency: 165.04 Hz.
- Frame interval p95: 6.2 ms.
- Maximum entities in the retained samples: 27.
- JavaScript page errors: none.

After the full session and five short restart cycles, post-GC
JavaScript heap usage increased from 8,299,248 to 8,664,384 bytes
(365,136 bytes, approximately 4.4%). No canvas elements remained
after any measured cleanup.

The observed heap growth requires further investigation before
claiming leak-free behavior. Five cycles are a limited check.

Ticker intervals do not measure GPU execution time. Only the latest
20,000 samples are retained. Heap measurements exclude total browser
and GPU memory. Completion detection uses approximately one-second
polling precision.

The machine-readable report is stored in
`reports/profile-stress.json`.

To reproduce in Git Bash:

```bash
VITE_TEST_MODE=false VITE_PROFILE_MODE=true npm run profile:build
npm run profile:preview
```

Keep the preview server running. In another terminal:

```bash
node scripts/profile.mjs
```

Keep the automated browser in the foreground until completion.
Each execution replaces the report.

The temporary `.profile-dist/` directory is ignored by Git.
Production deployment must use the normal build with profiling
and test modes disabled.