# Step-by-step animated solution playback

## Scope and user workflow

The manual-input workflow now supports **turn/scramble → find solution → execute animated steps**. A found solution does not move the puzzle by itself. “Execute next step” starts exactly one move from the verified world-frame sequence. There is no automatic play-all mode or queued user input.

The panel shows the total sequence length, completed count, current step, face, direction/angle, and orientation guidance in English and Ukrainian. The current list row has an amber accent, a textual label, and `aria-current="step"`; completed rows have a textual completion label. Live regions announce progress. The bounded, keyboard-scrollable list reveals its current row without scrolling the page away from the cube.

Clockwise is viewed directly at the named face, including hidden L/D/B faces. The frame remains fixed: U on top, F toward the user, and R on the right; in the isometric view F is the left visible side and R the right. Keep that orientation throughout the sequence. Starting a step brings an offscreen canvas into view using the same behavior as manual turns.

The renderer highlights and rotates the four current-layer pieces, then displays their exact resulting pose. Timing, reduced motion, camera framing, and interpolation are unchanged. A half-turn counts as one solution step.

Both input routes share this mechanism: the current manual workflow and future confirmed photo-derived states. Photo input and physical capture/orientation calibration are **not implemented**. This stage does not claim recognition or physical-puzzle capture verification.

## Transaction model

`src/interaction/turnSession.ts` adds `SolutionPlayback` alongside search and animation state:

- `moves`: an independently copied sequence from an accepted nonempty solution;
- `completed`: the number of committed solution steps, initially zero;
- `expectedState`: the immutable committed puzzle reference to which the next step applies;
- `status`: `ready`, `complete`, or `failed`.

An empty solution remains an already-solved search result and has no playback controls. Search failures and budget limits do not create a plan. The existing worker identity/request/snapshot checks still govern which search result may be accepted.

`solution-next` is accepted only with a ready scene, no active turn or search, a ready plan, an exact snapshot-reference match, and a remaining move. It creates a `PendingTurn` with kind `solution` and a new monotonic turn ID. The move comes from the plan's cursor, **not** the manual angle selector. Starting changes neither puzzle nor history nor completed count.

The renderer uses the existing animation path, unchanged. A matching `complete` action:

1. Checks that the expected committed snapshot still matches.
2. Applies the pending move with the exact domain `applyMove` rules.
3. Appends that move to chronological history.
4. Advances `completed` and `expectedState` atomically with the puzzle update.
5. Clears the active turn and waits for another explicit activation.
6. After the last move, requires exact `isSolved(puzzle)` before setting `complete`.

The normal worker has already verified the sequence. The final predicate is an additional safeguard against falsely announcing success merely because a cursor reached the end. It accepts all 24 proper whole-cube orientations; the goal need not have the initial global orientation. A snapshot mismatch or unsolved final state yields a localized playback failure, never a success announcement or an automatic repair/search.

The original search result describes the original solution, not a new solution from each intermediate state. Playback owns the cursor and expected state; it never restarts that result at index zero or runs the worker for each step. Duplicate/obsolete worker responses and animation completions cannot reset or advance playback.

## History, interruptions, and controls

During a step, next-step, manual turns/angle selection, undo, scramble, and search controls are disabled. The reducer also rejects conflicting actions. Language switching changes only text; it preserves the pending turn ID, exact state, progress, and scene instance.

Between steps, ordinary controls remain available:

- a manual turn or scramble clears the plan when the new animation starts;
- undo clears the plan, then animates the inverse of the latest recorded move, including a solution step;
- a new search clears the plan and searches the current partially solved snapshot.

There is no dedicated backward-step/resume-after-undo behavior: find a new solution after undoing. Failed/no-op requests, such as an empty scramble, do not discard a plan. Completed solution moves remain ordinary history entries; no merging or cancellation is introduced.

Scene/context failure discards the plan and unfinished turn, preserving exactly the committed puzzle and history prefix. Late completion callbacks are ignored. Reload resets the entire session. There is no recovery of a pending visual turn, persistent progress, autoplay, adjustable speed, or mid-turn pause/cancel control.

## Files and boundaries

- `src/interaction/turnSession.ts`: pure playback transaction, snapshot checks, history commits, and final exact goal check.
- `src/components/SolutionPanel.tsx`: localized controls, instructions, progress, row labels, and list-local scrolling; it does not compute moves.
- `src/App.tsx`: typed action wiring, current-step scene status, and existing canvas visibility behavior.
- `src/i18n/messages.ts` and `src/styles.css`: bilingual copy and current-step presentation.

The solver/worker, puzzle move rules, geometry, and Three.js animation implementation are unchanged. No dependencies or separate playback animation engine were added.

## Verification

Automated tests cover all 18 face/angle choices, immutable pre-completion state, exactly-once commits, increasing turn IDs, no auto-advance, active-operation locks, plan invalidation, undo, snapshot mismatches before start and commit, and scene failure after each prefix of a mixed solution. Actual history-free depth-eleven solver results are played through all 24 global frames and checked with `isSolved`. An injected incorrect sequence cannot trigger a completed/solved announcement.

UI tests cover current/completed row markers, English/Ukrainian instructions and final messages, preserved animation/progress across language changes, history counts, ignored duplicate callbacks, worker reuse without per-step requests, partial undo/re-search, empty solutions, and failure handling. jsdom uses controlled scene/worker stubs, not GPU animation.

Chrome checks in both Vite development and production preview at 1280, 390, and 320 px exercise native workers and real animation: keyboard activation, amber moving-layer highlights, locks, language changes during motion, explicit pauses between steps, and exact history increments. For R, U′, F2 followed by its solution, the final canvas is pixel-identical to the initial solved view. Separate cases check mapped negative world faces, an eleven-step reduced-motion solution, current-row visibility inside the scrollable list, partial undo/re-search, and context loss during a pending step. Final committed snapshots are independently checked by exact domain replay and a subsequent empty solver result. No horizontal overflow or uncaught exceptions was observed. These are local checks, not a committed cross-browser end-to-end suite.

Run `npm test`, `npm run typecheck`, and `npm run build`. For manual review, scramble, find a solution, and execute each step while switching languages. Confirm that the count and history advance only after each animation, the app waits between steps, and the solved message appears only at completion. Undo a completed step and confirm that the old plan is removed before finding a fresh solution.

The manual solve/playback route is implemented locally. Deployment remains deferred and requires separate approval; the complete planned release includes both input routes. The next proposed stage is to agree and validate the guided photo-capture/reconstruction/confirmation protocol on the owner's puzzle, before choosing recognition tools or implementing photo input.
