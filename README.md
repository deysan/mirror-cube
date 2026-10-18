# MirrorCube

MirrorCube is an interactive, step-by-step guide to solving a 2×2 Mirror Cube. There are two target input workflows: **manually turn/scramble the virtual cube**, or **reconstruct and confirm a physical state from photographs**. Both lead to the same solution search and animated instructions showing how to hold and turn the puzzle.

Manual input is a full product workflow, not only a development tool. Complete its solve/playback path first, then add photo input as the final functional stage. The solver must accept a validated state without requiring move history. A single photo may be insufficient; guided views and confirmation will be designed and verified during the photo-input stage.

The interface supports **English and Ukrainian**. Solution instructions will support both languages when implemented. Repository documentation is written in English.

## Current status

The exact puzzle model, a Three.js/React Three Fiber scene, animated manual turns and scrambling, move history, animated undo, and an English/Ukrainian interface are implemented. Choose a direction/angle, then a face: four highlighted pieces rotate together and the exact state and history are committed after the movement. Undo animates the inverse of the last recorded move.

Exact solved-state detection is available in the domain layer, allowing all 24 whole-cube orientations without using move history. Plain-data validation, compact coordinates, transition/distance tables, and IDA* search now power a worker-backed “Find solution” button. Search verifies each result with exact domain moves, supports cancellation and budgets, and displays bilingual results without changing the cube or history. An already-solved state is reported after search; there is no continuously updated solved badge. There is no animated solution playback, redo, photo recognition, or public deployment yet. The original SVG renderer has been removed. Netlify deployment is deferred until solving and animated step-by-step solution playback are ready.

## Local setup and checks

Use Node.js 24.15 or later within the 24.x release line (recommended) and npm. All supported Node.js versions are listed in `package.json`; the minimum versions account for the jsdom test environment.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

```sh
npm test
npm run typecheck
npm run build
npm run preview
```

`npm run build` checks types and writes the production site to `dist`. `npm run preview` serves that build locally; it is not a production hosting service. Use `npm run test:watch` to rerun tests while editing.

## Solved puzzle model

`src/puzzle/model.ts` exports `createSolvedCube(parameters?)`, which constructs eight pieces without React or rendering dependencies. Calling it without arguments uses the owner's confirmed dimensions for their [Cayro 2×2 Mirror Cube](https://bi.ua/ukr/product/zerkalnyy-kubik-rubika-cayro-2h2-8380.html):

| Parameter | Value |
| --- | --- |
| Cube edge length | 50 mm |
| X layers | 22 / 28 mm |
| Y layers | 20 / 30 mm |
| Z layers | 17 / 33 mm |

The owner confirmed these dimensions; the product link identifies the puzzle and is not cited as a manufacturer specification for the layer sizes.

### Coordinates and pieces

All lengths and coordinates use millimeters. The three split planes intersect at `(0, 0, 0)`, so the solved cube occupies `[-22, 28] × [-20, 30] × [-17, 33]`. Its outer geometric center is not the coordinate origin.

Each piece has:

- `id`: its original negative/positive sides along X, Y, Z, such as `-++`. This identifies the piece, not its future position after moves.
- `dimensions`: separate local X, Y, Z lengths, aligned with world axes in the solved state.
- `solvedMin`: the minimum corner of its solved-state box, not its center or a mutable current position.

The maximum corner is `solvedMin + dimensions`, component by component. The resulting dimensions are:

| Piece ID | X (mm) | Y (mm) | Z (mm) |
| --- | --- | --- | --- |
| `---` | 22 | 20 | 17 |
| `--+` | 22 | 20 | 33 |
| `-+-` | 22 | 30 | 17 |
| `-++` | 22 | 30 | 33 |
| `+--` | 28 | 20 | 17 |
| `+-+` | 28 | 20 | 33 |
| `++-` | 28 | 30 | 17 |
| `+++` | 28 | 30 | 33 |

### Validation and current limitations

Parameters must be safe integers in whole millimeters. Edge length must be positive, and each split must be strictly inside the cube and off-center. Invalid numeric parameters throw `RangeError`; fractional values are rejected rather than rounded. If finer measurements are needed, introduce a finer explicit unit instead of rounding them to whole millimeters.

The default dimensions yield eight distinct shapes. Custom parameters are checked for valid off-center splits, but are not required to produce eight shapes distinguishable under rotation.

The model uses ideal rectangular pieces without bevels, gaps, or an internal mechanism. This definition describes the solved geometry; current poses and move rules live in separate modules. `isSolved` checks discrete poses against the exact solved arrangement; `validatePuzzleState` separately checks plain-data structure and reachability for this corner model. Data is exposed through TypeScript `readonly` types, not runtime freezing.

`src/puzzle/model.test.ts` checks piece identities, exact dimensions, containment, pairwise non-overlap, total volume, one-millimeter differences, input independence, and parameter validation. Containment, non-overlap, and equal total volume together verify that the pieces fill the cube without gaps.

## Discrete state and turns

- `src/puzzle/state.ts` creates a separate state with each piece's ID, current octant, and orientation.
- `src/puzzle/moves.ts` applies complete 90-degree clockwise/counterclockwise or 180-degree turns on any of the six faces, without mutating input state or piece dimensions.
- `src/puzzle/moves.test.ts` verifies directions, inverses, repeated turns, current-layer membership, and exact geometric invariants.
- `src/puzzle/scramble.ts` generates a 12-move random walk with different axes on adjacent moves, without UI or renderer dependencies.

Completed turns use only coordinate swaps and sign changes, not floating-point angles. The logical octant is not the piece's geometric center. See [the move-model guide](docs/moves.md) for conventions, examples, and the geometry used by animation.

## Exact solvedness and solution search

`src/puzzle/solved.ts` exports `isSolved(state)`. It requires all eight distinct piece identities, a common proper signed-axis orientation, and each slot equal to that common rotation applied to the piece's home slot. The result is independent of array order, dimensions, camera, language, and move history.

A rigid rotation of the entire assembled cube is still solved: all 24 proper orientations are accepted. Reflections, individually twisted pieces, or mismatched positions are not. No bounding-box or approximate silhouette comparison is used. This is a logical identity-and-orientation goal, not a complete validity checker for imported states; `false` can also describe impossible input. Plain-data candidates can be checked with `validatePuzzleState`; raw photo reconstruction is still a separate future stage.

The solver core uses IDA* with compact corner-permutation/twist coordinates and small admissible distance tables, independent of history. Validation, coordinate encoding, tables, pure search, and worker/UI integration are implemented; animated solution playback is not implemented yet. See [the solvedness and solver design](docs/solver.md) for the goal contract, global-frame normalization, algorithm choice, and verification plan.

### Validated solver input and compact coordinates

- `src/puzzle/validation.ts` exports `validatePuzzleState(candidate: unknown)`. It checks eight distinct identities/slots, proper orientations, pose consistency, and total corner twist. A 2×2 permits odd permutations; there is no 3×3-style edge parity constraint. Success returns a copied, canonically ordered state; failure returns a language-independent diagnostic code.
- `src/puzzle/corners.ts` defines the canonical order and a slot-aware cyclic corner-twist convention. `src/puzzle/orientation.ts` shares exact rotation math with solvedness.
- `src/solver/coordinates.ts` exports `encodeState`, `decodeState`, and `mapMoveFromFrame`. Encoding validates first, normalizes around piece `---`, and returns permutation/twist ranks plus the frame needed to recover the original pose.

There are 5,040 permutation ranks and 729 twist ranks. `{ permutation: 0, twist: 0 }` is solved in the normalized frame. All 24 global rotations share coordinates, but the saved frame preserves the original physical orientation and maps solution moves back to the correct faces. No generating move sequence is required or retained.

See [the state validation and encoding guide](docs/state-encoding.md) for the API, exact twist convention, error codes, and verification. This is a solver input boundary, not a photo importer or search engine.

### Move transitions and lower bounds

`src/solver/tables.ts` explicitly builds tables for the nine normalized R/U/F moves. `applyTableMove` performs compact-coordinate transitions, and `estimateRemainingMoves` returns the maximum of the exact permutation/twist distances. Adding those distances would overestimate the number of required turns.

The retained typed-array buffers occupy 109,611 bytes (about 107 KiB). Construction is synchronous but runs only inside the lazily created solver worker, not on the main thread or on import. A healthy worker reuses its table set across requests; cancellation or worker failure discards it. See [the solver-table guide](docs/solver-tables.md) for layout, admissibility, local initialization measurements, and verification limits.

### History-independent search core

`src/solver/search.ts` exports `solvePuzzle(candidate, tables, options?)`. It returns a shortest face-turn solution in the input frame, an empty solution for an already-solved state, validation diagnostics, or an explicit cancellation/budget result. A budget limit never means “unsolvable.” Every returned path is replayed with exact `applyMove` rules and checked by `isSolved` against a copied input snapshot.

Default traversal limits are 11 moves, 5,000,000 visited nodes, and a cooperative 5-second time budget. The synchronous core must not be called directly from UI handlers; queued events cannot interrupt it. See [the search guide](docs/solver-search.md) for the API, polling contract, independent shortest-path checks, and local measurements. A test-only complete coordinate BFS covers all 3,674,160 states and confirms diameter 11; the application does not retain that full graph.

### Worker-backed solve controls

“Find solution” sends a snapshot of the current committed state to a dedicated Web Worker. Turns, undo, scrambling, and duplicate requests are blocked during search; language switching and “Cancel search” remain available. Cancellation terminates the worker, including table initialization, rather than queuing a message that synchronous search cannot process. A 15-second total-request watchdog also covers worker loading and initialization.

The result panel distinguishes already solved, a numbered solution, invalid input, cancellation, search limits, and worker failure/timeout. The list uses execution order, notation, and localized face/direction descriptions. No moves are automatically applied or recorded. Starting a turn clears the old result immediately; request IDs, worker identity, and snapshot checks reject late/duplicate replies. Search failures do not disable manual turns.

See [the worker/UI guide](docs/solver-worker.md) for lifecycle, retry costs, accessibility, and browser checks. “Ready to turn” remains an interaction status, not a solved-state announcement. Animated playback is the next separate stage.

## 3D view and manual turns

- `src/rendering/pieceTransform.ts` converts a piece's definition and orientation into a Three.js matrix. It rotates the actual solved center around the split intersection, never using slot signs as distances.
- `src/components/CubeScene.tsx` renders eight boxes and animates the selected layer around the mechanism origin. Three.js handles depth testing and hidden surfaces.
- `src/components/CubeView.tsx` provides the scene's accessible name/description and a localized fallback if the 3D scene cannot initialize.
- `src/interaction/turnSession.ts` keeps the committed puzzle and history separate from the pending animation, and guards completion by turn ID. Undo uses the same transaction with an inverse move. Scrambling schedules the next turn atomically after each completion.
- `src/components/MoveControls.tsx` selects direction/angle, requests a face turn, or starts scrambling.
- `src/components/MoveHistory.tsx` shows recorded moves, newest first, and requests undo.
- `src/App.tsx` owns the definitions and session, independently of language. Puzzle state is never reconstructed from meshes.

The fixed orthographic camera looks from positive X, Y, and Z toward the mechanism origin. Positive Y projects upward, positive X down-right, and positive Z down-left. Its zoom fits a pivot-centered sphere that contains all pieces even during turns, avoiding clipping or camera jumps. Zoom adjusts when the viewport changes. The controls explain the fixed face directions and the outside-looking-in meaning of clockwise.

Box geometry is centered on each mesh's local origin, then positioned and oriented using its pose matrix. All faces are present; a depth buffer hides the surfaces behind other pieces. Edge outlines visualize divisions without shrinking the pieces or introducing artificial gaps. Ambient and directional lighting provide neutral shading, not photorealistic mirror reflections.

The scene renders on demand, requesting successive frames only while a turn is active. A quarter-turn takes about 0.6 seconds and a half-turn 0.9 seconds, with smooth easing and amber highlighting. The discrete puzzle changes only after completion. New commands are blocked while a turn or scramble is running; repeated clicks are not queued. A scramble's generated sequence advances only on matching animation completions. Reduced-motion preference skips interpolation. Geometry resources are memoized and disposed when replaced or unmounted. There is no drag-to-rotate camera control.

WebGL 2 is required. Initialization failure or context loss shows a localized fallback and disables turns. An unfinished move and any queued scramble remainder are canceled without changing the last committed puzzle or history. Measurements and language controls remain available; reload is required to retry. Reloading resets the puzzle and language.

See [the animated-turn guide](docs/animated-turns.md) for transaction flow, timing, safe framing, and verification. The measurements panel always describes the solved dimensions, not the current outer shape.

Three.js and React Three Fiber increase the production JavaScript bundle size. Vite currently warns about a chunk over 500 kB before compression (approximately 320 kB gzip). The warning is not suppressed; code splitting or lazy loading can be considered when needed.

### History and undo

Only completed manual or scramble turns enter history. Entries are not combined or automatically canceled: R followed by R′ is still two recorded actions. Each row shows notation and a localized face/direction explanation. The newest entry is first; a long list scrolls within a bounded, keyboard-focusable area.

“Undo last move” animates the inverse of the most recent entry, independently of the angle selected for manual turns. History and puzzle state remain unchanged during that animation; completion updates both atomically. Undo is disabled for empty history, an unavailable scene, or any active turn. Failure during undo preserves the committed state and history.

Repeated undo restores each previous state back to the session's initial state. A new manual turn after undo extends the remaining history; there is no redo stack, history-jump control, or persistence. Reload clears the history. Undo is not presented as solution search or proof of solvedness.

### Animated scrambling

“Scramble (12)” runs twelve random legal turns from the **current state**, preserving existing history. The first scramble after loading starts from solved; later scrambles continue from the current pose without an implicit reset. Each completed turn enters history and can be undone individually after the sequence finishes.

The status displays the current step (1/12 through 12/12), face, and angle. Manual controls, undo, and further scrambling stay disabled for the whole sequence, with no unlocked gap between turns. Switching language does not regenerate or restart it. On scene failure, only the completed prefix remains applied and recorded; the rest is discarded.

The generator samples different axes on neighboring moves to avoid immediate cancellations and consecutive commuting opposite faces. It uses `Math.random` by default and accepts an injected RNG for deterministic tests. This is a random walk, not a uniform random-state or competition scramble. It does not guarantee a particular difficulty or an unsolved endpoint, and does not infer solvedness from appearance.

A sequence normally takes about 7–11 seconds. There are no speed, length, pause, or cancel controls in this stage. Reduced-motion preference skips interpolation but retains sequential exact commits. Reloading resets the session rather than resuming it.

### Visual verification

1. Run `npm run dev` and open the page.
2. Confirm the initial solved cube and the 50 mm, 22/28, 20/30, and 17/33 mm reference measurements.
3. Select a direction/angle and press a face button. Four amber pieces should move; further turns are disabled until completion.
4. Perform R, U′, and F2, then undo three times. Each animation should remove only the latest entry after completion and restore the previous pose. Switch languages during undo: it must not restart or accept another command.
5. Resize to desktop and mobile widths; the puzzle should stay in frame, including its protruding pieces. On small screens an offscreen canvas is brought into view when requesting a turn.
6. Press “Scramble (12)”, switch languages during the sequence, and verify that twelve entries are appended without resetting earlier history. Undo those twelve moves to restore the pre-scramble pose.
7. Press “Find solution” after the sequence. The move list should appear without changing the cube/history. Start another turn to clear it; try cancellation during a cold search and then retry. Switch languages during search and after completion.
8. Run `npm run build` followed by `npm run preview` to check the production build locally.

`src/rendering/pieceTransform.test.ts` checks actual Three.js box vertices and bounds against the puzzle model, including mixed poses, rotations around the split intersection, absence of scaling/reflection, and a one-millimeter dimension difference. Browser/WebGL checks are currently manual, not a committed end-to-end test suite.

## Interface languages

`src/i18n/messages.ts` contains typed English (`en`) and Ukrainian (`uk`) dictionaries. A shared message shape requires both languages to provide every key, including full axis labels rather than language-dependent sentence fragments. Native language names are always shown on the switcher.

`src/App.tsx` selects a dictionary using local language state and passes the localized scene title, description, and failure message to `CubeView`. No localization context or runtime library is needed for this single-page interface. Puzzle logic and mesh transforms do not depend on the language.

Switching updates:

- all page copy, measurement labels, and unit abbreviations;
- the language switcher's accessible label and pressed state;
- scene accessible title, description, and initialization-failure message;
- the document's `lang`, title, and description meta tag.

The default is English. Language selection is not persisted or inferred from browser settings yet; a full page reload returns to English. The static HTML also starts in English, and React updates metadata on language changes. This is not server-rendered multilingual SEO.

### Language verification

1. Switch from English to Ukrainian and back. Text and units should change, while the cube and its divisions remain unchanged.
2. Use Tab to focus a language button and Enter or Space to activate it. The active language has a visible state and `aria-pressed="true"`.
3. Inspect the document's language and title, and the scene's accessible name/description, in both languages.
4. Check both languages at narrow widths; longer Ukrainian text should wrap without horizontal overflow.

`src/App.test.tsx` uses React Testing Library with jsdom to verify button clicks, localized text and metadata, stable model/state references, and error fallback behavior. `CubeScene` is mocked because jsdom cannot render WebGL, and solve UI tests use a controlled worker stub; these tests do not claim GPU output or native worker scheduling. Geometry tests use real Three.js objects in Node. Session and UI tests also verify pending-turn preservation across language changes, atomic history updates, and the exactly-once completion contract. Undo tests cover all 18 face/angle combinations, failure during undo, new moves after undo, and exact restoration of every snapshot in a 100-move sequence. Scramble checks cover seeded reproducibility, legal walks, exactly-once sequential commits, replay from recorded history, undo back to the pre-scramble state, and failure with a queued remainder. Dictionary tests check matching keys and nonempty translations. Solution-progress preservation will need its own tests once playback exists.

## Documentation

- [Product and MVP scope](docs/product.md)
- [Incremental development roadmap](docs/roadmap.md)
- [Discrete state and move rules](docs/moves.md)
- [Exact solvedness and solver design](docs/solver.md)
- [State validation and solver coordinates](docs/state-encoding.md)
- [Solver transitions and distance tables](docs/solver-tables.md)
- [History-independent IDA* search](docs/solver-search.md)
- [Worker-backed solution search](docs/solver-worker.md)
- [Animated manual turns](docs/animated-turns.md)
- [Coding agent instructions](AGENTS.md)

## Technical direction

- React and TypeScript for the interface and typed application logic.
- Vite for local development and production builds.
- Three.js and React Three Fiber for 3D rendering with correct depth and occlusion. No Drei, external model/texture assets, or animation library is needed at this stage.
- Vitest for automated checks of the puzzle model.

Puzzle state and move rules, solution search, geometry/projection/animation, and UI should remain separate responsibilities. Add modules and dependencies only when needed for the current stage.

Localization uses typed dictionaries without changing puzzle logic or state. Add translations alongside each new UI feature; introduce a localization library only if concrete needs outgrow this approach.

## Deployment on Netlify

The target is Netlify's free plan, connected to the GitHub repository, using a `*.netlify.app` address without purchasing a domain. The free plan has usage limits; verify the current terms when setting up deployment. Paid options require the owner's explicit approval.

Deployment is deferred until the solving workflow and animated step-by-step playback are ready. The uncommitted deployment preparation has been removed; Netlify is not connected and there is no verified public URL.

The application already produces a static build in `dist`. When deployment resumes, verify the current free-plan limits and configure the build for the Node.js version supported by `package.json`. Do not enable paid options or auto recharge.

## Development workflow

Work in small, reviewable stages. Agree on the scope before implementation, verify the result afterward, and stop until the owner approves continuing. Do not commit or push changes without explicit permission.

## License

No license has been selected yet. A public repository does not by itself grant an open-source license to use the code.
