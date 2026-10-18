# Incremental development roadmap

## Stage workflow

Each stage delivers one small, complete behavior change or a focused infrastructure task. Before starting, agree on the behavior, affected files, and approach. Afterward, summarize the result, checks, and limitations, then wait for permission to continue.

The roadmap can change based on earlier results. It is not permission to start the next stage automatically. Commits and pushes require explicit permission from the owner.

## Completed foundation: documentation and GitHub

English documentation and collaboration rules are available in the public repository `deysan/mirror-cube`, with `main` as the default branch. Free Netlify hosting is the deployment target but has not been connected.

## Completed stage: solved puzzle model

The TypeScript model and its geometry tests are committed and published. The default parameters use the owner's confirmed Cayro cube dimensions: a 50 mm edge and splits at 22, 20, and 17 mm along X, Y, and Z respectively.

## Completed stage: initial static view

The initial React + Vite page used a fixed isometric SVG view derived from the model's dimensions. That stage is committed and published. Its solved-only renderer was replaced in the Three.js stage.

## Completed stage: multilingual interface

English and Ukrainian dictionaries and a language switcher are committed and published. The language affects text, accessibility labels, and document metadata, not the puzzle model or geometry. Tests verify switching in both directions and model preservation.

Limitations: English is the initial language; selection is not persisted across reloads. Solution-progress preservation cannot be tested until solutions and playback exist.

## Completed stage: exact move rules

Separate discrete state and complete face turns are implemented and committed locally. See the [move-model guide](moves.md) for coordinate conventions and API details. Tests verify known directions, inverses, repeated turns, layer selection, and exact geometric invariants from solved and mixed states.

## Completed stage: static Three.js scene

The SVG renderer was replaced by Three.js with React Three Fiber and committed locally. Eight boxes use exact model dimensions and pose matrices, with depth testing, bilingual accessibility descriptions, and an initialization-failure fallback.

## Completed stage: animated manual turns

Six face buttons and three angle/direction choices control a highlighted moving layer. A separate session reducer guards starts and commits the exact move only after animation completion. See the [animated-turn guide](animated-turns.md).

Completion criteria:

- all 18 face/angle combinations animate around the correct pivot and direction;
- exactly four moving pieces are highlighted and the other four remain still;
- controls reject overlapping turns and are disabled before scene readiness;
- duplicate or stale completion callbacks cannot apply a move twice;
- animation endpoints agree with the discrete model;
- the camera contains protruding pieces throughout movement;
- changing language does not reset or restart a pending turn;
- reduced motion and scene/context failure are handled without a stuck pending move;
- automated tests, type checking, production build, and browser checks pass.

The manual-turn stage is committed locally. Its fixed camera and larger graphics bundle remain unchanged; Vite's bundle-size warning is not suppressed.

## Completed stage: history and animated undo

Completed manual moves enter a chronological history. The bilingual list shows the newest entries first with notation and full move descriptions. Undo animates the inverse of the final entry through the existing scene and completion contract; no rendering or domain dependencies were added.

Completion criteria:

- puzzle and history update together only after a matching completion;
- manual turns append entries, while undo removes the final entry without recording the inverse;
- every undo restores the exact prior state, including all angles and mixed sequences;
- empty history, loading/failure, and active animations block undo;
- duplicate/stale completions and failure cannot remove an extra history entry;
- language switching preserves both history and a pending undo;
- long lists remain bounded and keyboard-scrollable;
- automated tests, type checking, production build, and browser checks pass.

The history/undo stage is committed locally. Undo remains a reversal of recorded moves, not a general solution-search algorithm.

## Current stage: animated scrambling

A separate generator creates twelve legal turns with different axes on adjacent moves. The session animates them sequentially from the current state (initially solved), preserving previous history rather than silently resetting it. Each completion commits one move and schedules the next atomically.

Completion criteria:

- injected RNGs produce reproducible valid sequences without retry loops;
- the renderer animates each turn through the existing completion contract;
- controls stay locked for the entire sequence, including between turns;
- exactly the completed prefix is applied and recorded, even on failure;
- duplicate/stale completions cannot skip or repeat sequence steps;
- recorded history replays to the same exact state;
- undo restores the pre-scramble state, and repeated scrambling preserves history;
- language switching preserves the sequence, progress, and animation;
- automated tests, type checking, production build, and browser checks pass.

Limitations: random-walk scrambling is not uniform random-state sampling and does not guarantee difficulty or an unsolved endpoint. No pause/cancel, adjustable scramble length/speed, redo, solved-state detector, solver, or solution playback. Reload resets the session.

## Agreed rendering direction and deployment order

The current renderer uses Three.js with React Three Fiber. Correct depth and occlusion during shape-changing turns justify replacing the solved-only SVG renderer. Animation timing does not need an additional library at this point.

Netlify deployment is deferred until the solving workflow and animated playback are ready. The uncommitted deployment configuration and setup guide have been removed; no Netlify site was created.

The next proposed stage is exact solved-state detection and solver design, followed by an independent solution-search implementation. Stop for owner review before starting it. Each completed stage may be committed under the owner's current authorization; pushing still requires explicit permission.

## Final functional goal: photos to a solution

Photo-based reconstruction of the physical puzzle is required, not an optional extension. Implement it last among the functional stages, after independent search and animated playback are verified. The current virtual controls provide known test states and visualization for that workflow.

The solver must accept a validated discrete state without move history; recognition should be a separate input boundary, not part of search or rendering. The photo stage must establish the capture protocol on the owner's cube, handle occlusion and ambiguity, show a candidate state for confirmation/correction, and validate it before solving. One arbitrary image is not assumed sufficient. No recognition model or external service is selected yet.

## Stage sequence

| Stage | Result | Main check |
| --- | --- | --- |
| 1. Solved puzzle model | Eight pieces with exact local dimensions | Pieces fill the cube without gaps or overlapping interiors |
| 2. Static view | First React + Vite page with 3D-to-SVG projection | The solved cube is visible and the view uses the model |
| 3. Multilingual interface | English/Ukrainian language switcher and localized initial UI | Switching languages updates text without resetting puzzle state |
| 4. Move rules | Pure logic for piece slots and orientations | An inverse move and four quarter-turns restore state; dimensions remain unchanged |
| 5. Static Three.js scene | Replace SVG with a React Three Fiber scene using the model | Correct piece dimensions, placement, and depth; bilingual UI still works |
| 6. Animated manual turns | Move controls, visible rotation, and highlighted moving pieces | The final frame matches the discrete state; conflicting concurrent actions are blocked |
| 7. History and undo | Undo the latest move | The exact previous state is restored |
| 8. Scrambling | An animated legal sequence from the current state, initially solved | Replaying the recorded sequence reproduces the state |
| 9. Solution search | An algorithm independent of UI and move history | Applying the returned sequence solves a valid input state without access to its generating moves |
| 10. Step-by-step solution | Localized instructions and animated playback | Orientation cues, highlights, and state agree at every step in both languages |
| 11. Photo input | Guided photographs, candidate state reconstruction, confirmation/correction, and validation | A confirmed physical-puzzle state feeds the existing solver and playback without move history; ambiguous captures are not silently accepted |
| 12. Deployment | Publish the photo-to-solution workflow on Netlify's free plan | Production build succeeds and the complete workflow is accessible over HTTPS |

Once localization is introduced, each subsequent UI stage includes English and Ukrainian text. Verify that language switching preserves solution progress when playback is implemented.

Reversing move history must not be presented as a general solution-search algorithm. Choose the search algorithm separately once the move model is implemented and verified.

## Completed model stage: scope and checks

A pure TypeScript model of a solved 2×2 Mirror Cube without UI or turns. The parameters define the cube's edge length and three off-center split planes, one per axis, using integer millimeters.

Files: `src/puzzle/model.ts`, `src/puzzle/model.test.ts`, minimal TypeScript and Vitest configuration, the npm lockfile, and an updated README with verification commands.

Completion criteria:

- exactly eight pieces with unique identifiers;
- separate dimensions along each axis match the split parameters;
- pieces lie within the cube, have no overlapping interiors, and fill it without gaps;
- the sum of piece volumes equals the cube's volume;
- a test with dimensions differing by one unit confirms that the distinction is preserved;
- invalid parameters are rejected;
- tests and type checking pass.

Original stage boundaries: solved geometry only, without turns, solved-state detection for arbitrary states, gaps, bevels, or an internal mechanism. Turns were added in a separate stage.
