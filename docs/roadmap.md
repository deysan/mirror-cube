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

Limitations: English is the initial language; selection is not persisted across reloads. Solution-progress preservation was tested later, when playback was implemented.

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

## Completed stage: animated scrambling

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

Limitations: random-walk scrambling is not uniform random-state sampling and does not guarantee difficulty or an unsolved endpoint. No scramble pause/cancel, adjustable scramble length/speed, or redo. Solution playback was added in a separate later stage. Reload resets the session. This stage is committed locally.

## Completed stage: exact solvedness and solver design

`src/puzzle/solved.ts` checks exact piece identities, orientations, and slots up to a common proper whole-cube rotation. It accepts all 24 discrete global orientations without reading move history or estimating a silhouette. The interface and rendering are unchanged.

The [solver design](solver.md) selects IDA* over normalized corner permutation/twist coordinates with admissible distance-table heuristics. It specifies validation, reference-frame normalization, move mapping back to the physical frame, and independent solution verification. This stage established the exact goal predicate and selected the search direction; validation and coordinates were implemented afterward.

Completion criteria:

- all 24 proper solved frames are accepted and reflected frames rejected;
- face turns, corner twists, inconsistent slots/orientations, and incorrect identities are not mistaken for solved states;
- checks are exact, independent of dimensions/history/array order, and do not mutate input;
- the predicate agrees with an independently enumerated goal set;
- tests, type checking, and the production build pass;
- the solver plan serves photo-derived states without relying on their generating moves.

The predicate remains separate from input validation. The original stage had no UI changes; the later solve panel now reports already-solved search results. This stage is committed locally.

## Completed stage: input validation and compact solver coordinates

The plain-data validator checks structure, identities, slot occupancy, proper rotations, pose consistency, and total corner twist. The codec normalizes around piece `---`, encodes seven-corner permutation and six independent twists, and preserves the frame for exact decoding and move mapping. See the [state-encoding guide](state-encoding.md).

Completion criteria:

- malformed or physically unreachable corner states are rejected with diagnostic codes;
- balanced twists and odd corner permutations are accepted;
- valid input becomes an independent, canonically ordered snapshot without using history;
- normalization is invariant under all 24 global frames and preserves the original frame for reconstruction;
- all permutation and twist coordinate factors round-trip without collisions;
- decoded states preserve every piece identity, slot, and orientation;
- mapped moves agree with the existing exact rules, including negative world faces;
- previous tests, type checking, and production build pass.

The codec is internal, not a versioned interchange format; its tests exhaustively cover factor ranges rather than every full-pose combination. Complete coordinate-graph BFS coverage was added later with search. This stage is committed locally.

## Completed stage: move-transition and distance tables

The normalized R/U/F move tables are generated through the exact domain rules. Breadth-first traversal computes separate permutation and twist distances. Their maximum gives an admissible, consistent lower bound in the face-turn metric. See the [solver-table guide](solver-tables.md).

Completion criteria:

- all factor rows have in-range transitions, correct inverses, and quarter/half-turn identities;
- projected transitions agree with full-state moves when the other coordinate is nonzero;
- distances cover both graphs, have zero only at the goal, and satisfy shortest-distance certificates;
- the max heuristic does not overestimate an independent shallow full-state traversal;
- table construction is explicit, deterministic, independently owned, and has measured retained buffer size;
- tests, type checking, and production build pass.

Limitations of this stage: synchronous construction is not integrated into a worker, and no search or solve button was added. Full-pose table tests are bounded, and local initialization measurements are not browser performance guarantees. Pure search was implemented in the following stage.

## Completed stage: pure IDA* search

`src/solver/search.ts` searches a validated snapshot without move history, using the existing compact tables and max-distance heuristic. It maps a shortest face-turn sequence back to the input frame and verifies it with exact domain moves and solvedness. See the [search guide](solver-search.md).

Completion criteria:

- all 24 global frames and all 18 single-turn inputs solve correctly;
- returned sequences pass exact replay against a private full-pose input snapshot;
- shortest lengths agree with independent shallow full-pose BFS, including an all-six-face, 24-goal traversal;
- a test-only complete coordinate BFS confirms all 3,674,160 states and diameter 11, with sampled/deep IDA* length comparisons;
- invalid data, already-solved inputs, cancellation, and node/time/depth limits have distinct outcomes;
- frozen inputs and table contents remain unchanged, and no history or partial-path fallback is used;
- tests, type checking, and production build pass; local timing observations are recorded without device-performance guarantees.

Limitations of the core stage: the API is synchronous; its cancellation hook cannot receive queued events during traversal. Worker interruption, stale-result safety, and solve UI were added in the following stage. Playback was added later; recognition remains deferred.

## Completed stage: worker-backed solution search

A lazy dedicated worker builds and reuses tables and searches a committed snapshot. The bilingual solution panel offers search/cancel and displays verified moves without applying them. Worker/request/snapshot guards reject obsolete results; cancellation terminates active work. See the [worker/UI guide](solver-worker.md).

Completion criteria:

- search and table initialization run outside the main thread, with a separate built worker asset;
- solve requests never overlap turns/scrambling, and manual controls remain locked for a pending request;
- results do not mutate the puzzle or history and are cleared when a new turn starts;
- language switching preserves requests, results, and worker identity;
- cancellation, scene failure, unmount, and request timeout release pending resources;
- worker failures have a localized retry path without disabling manual turns;
- duplicate/late responses cannot replace the current result, including after cancellation/retry;
- automated tests, type checking, production build, and real-worker browser checks pass.

Limitations of the worker stage: cancelled/failed workers lose their tables; retry rebuilds them. Search budgets are fixed in the UI; no search-progress percentages or automatic retries are added. Browser background throttling can delay the watchdog. Playback was implemented in the following stage; photo input is still deferred.

## Completed stage: step-by-step animated solution playback

The solution panel now offers one explicitly activated step at a time, with bilingual orientation/direction instructions, current/completed row markers, and progress. A separate snapshot-bound playback record uses the existing renderer and turn-completion contract. See the [playback guide](solution-playback.md).

Completion criteria:

- the next move comes from the verified sequence, not the manual angle selection;
- puzzle, history, and completed count update atomically only after a matching animation completion;
- duplicate callbacks and repeated requests during movement cannot advance extra steps;
- language switching preserves the active turn, exact state, and progress;
- manual turns, undo, scrambling, and new search between steps invalidate the old plan;
- scene failure preserves only the committed state/history prefix;
- final success requires exact solvedness, including globally rotated goals;
- all 18 move types and real history-free solutions through all 24 global frames are covered;
- tests, type checking, production build, and real worker/animation browser checks pass.

The initial playback stage provided single-step execution. Target navigation, backward traversal, demonstrations, and confirmed reset were added in the following owner-requested stage. Photo capture and reconstruction remain unimplemented; deployment is deferred.

## Current stage: solution navigation, demonstrations, and reset

Numbered solution rows now navigate to the state after the selected step, animating every intermediate forward or inverse turn. The plan is retained during navigation, history tracks the current solution prefix, and a start button returns to the solution's input state. A separate replay button demonstrates the last completed step without changing the committed state, history, or progress. Reset requires confirmation before restoring the default solved pose and clearing history/solution; it preserves language and monotonic operation IDs.

Completion criteria:

- every intermediate transition commits exactly once, with no unlocked gap or queued user clicks;
- backward navigation preserves input history and removes only the rewound solution prefix;
- replay ends at the unchanged committed pose, including after solved completion;
- language switching and scene failure preserve the appropriate committed state;
- reset cancellation changes nothing; confirmation clears only the intended session data;
- obsolete callbacks/results cannot affect post-reset operations;
- automated tests, type checking, build, and real-browser navigation/replay/native-dialog checks pass.

Limitations: no mid-turn pause/cancel, adjustable speed, persistent progress, or general history redo/jump. Reset is disabled during active work and when the scene is unavailable. Replay demonstrates the last completed step; reviewing another step requires navigating there first. See the [playback guide](solution-playback.md).

## Agreed rendering direction and deployment order

The current renderer uses Three.js with React Three Fiber. Correct depth and occlusion during shape-changing turns justify replacing the solved-only SVG renderer. Animation timing does not need an additional library at this point.

The manual solve/playback workflow is now available locally. Netlify deployment remains deferred and requires separate approval; the complete planned release includes photo input as well. The uncommitted deployment configuration and setup guide have been removed; no Netlify site was created.

The next proposed stage is to agree and validate the guided photo-capture, reconstruction, and confirmation protocol on the owner's puzzle before choosing recognition tools or implementing photo input. Stop for owner review before starting it. Each completed stage may be committed under the owner's current authorization; pushing still requires explicit permission.

## Final functional goal: two inputs, one solving workflow

Manual turns/scrambling and photo-based reconstruction are both first-class ways to provide a puzzle state. Complete the manual-input solve/playback workflow first, then add photos as the final functional stage. Photo-based reconstruction remains required, not an optional extension. Both routes use the same independent solver and animated instructions; manual controls are not only development tooling.

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
| 9. Solution search | Goal check, validation/encoding, tables, IDA*, and safe worker/UI integration (implemented) | Applying the returned sequence solves a valid input state without access to its generating moves |
| 10. Step-by-step solution | Localized instructions and user-paced animated playback (implemented) | Orientation cues, highlights, and state agree at every step in both languages |
| 11. Photo input | Guided photographs, candidate state reconstruction, confirmation/correction, and validation | A confirmed physical-puzzle state feeds the existing solver and playback without move history; ambiguous captures are not silently accepted |
| 12. Deployment | Publish both input-to-solution workflows on Netlify's free plan | Production build succeeds and the complete workflow is accessible over HTTPS |

Once localization is introduced, each subsequent UI stage includes English and Ukrainian text. Playback tests verify that language switching preserves solution progress.

Reversing move history must not be presented as a general solution-search algorithm. The IDA* core, worker/UI integration, and end-to-end user-paced animated playback are implemented and locally verified. Guided photo input remains a required separate stage.

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
