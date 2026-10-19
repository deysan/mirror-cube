# Animated solution playback, navigation, and replay

## User workflow

The manual workflow supports **turn/scramble → find solution → execute or navigate animated steps**. Finding a solution does not move the puzzle by itself. The controls and guidance are available in English and Ukrainian.

- **Execute next step:** perform exactly one verified move and wait.
- **Select a numbered step:** reach the state **after** that step, animating every intermediate move. Selecting step 3 from the start performs steps 1, 2, and 3. Selecting step 1 from position 3 reverses steps 3 and 2, in that order. Selecting the current position is disabled.
- **Back to solution start:** reverse the completed solution prefix, without undoing the input/scramble that preceded the solution.
- **Show step again N:** demonstrate the last completed step from its starting pose. This is a visual replay, not another application of the move. It changes neither committed puzzle, history, nor progress. To review another step, first navigate to its position, then replay it.
- **Reset cube:** restore the default, canonically oriented solved state and delete history and the solution, only after an explicit browser confirmation. Cancelling leaves the session untouched. Reset preserves language, geometry definitions, the scene instance, and monotonic request/turn IDs. It is unavailable during a turn, traversal, replay, search, or scene failure/loading. Reset is not undoable and does not reload the page.

Navigation changes the virtual state; the physical cube must be kept in sync with those turns. Replay is explicitly labeled as a **demonstration**: do not repeat the physical turn if it has already been performed. Its visual starting pose is shown immediately, followed by the normal forward animation; there is no extra animated inverse turn to mistake for another instruction.

The panel shows the current move, completed count, navigation target, and a “You are here” position marker. During backward traversal, instructions describe the actual inverse move. During replay they identify the demonstrated step, not the next uncompleted step. The solved-completion announcement is withheld while a backward turn or replay is being displayed.

Rows are native keyboard-operable buttons, including their visible step numbers. The active instruction row uses `aria-current="step"`, amber styling, and a textual marker. Live regions announce progress. The bounded list reveals its current row locally, including after language changes, without pulling the page away from the cube. Starting an operation brings an offscreen canvas into view.

Clockwise is viewed directly at the named face, including hidden L/D/B faces. Keep U on top, F toward the user, and R on the right. In the fixed isometric view F is the left visible side and R the right. The renderer highlights the four current-layer pieces and preserves their exact dimensions. Existing timing, reduced-motion behavior, camera framing, and interpolation are unchanged. A half-turn counts as one step.

Both input routes share this mechanism: manual input now and future confirmed photo states. Photo reconstruction and physical capture/orientation calibration are **not implemented**.

## Interaction transaction

`src/interaction/turnSession.ts` owns `SolutionPlayback`:

- `moves`: an independent copy of the accepted nonempty, verified world-frame solution;
- `completed`: the current solution-prefix length;
- `expectedState`: the exact committed puzzle reference to which navigation/replay applies;
- `status`: `ready`, `complete`, or `failed`;
- `target`: the requested prefix length for a multi-turn traversal, or `null`.

Empty solutions remain already-solved results without playback. Search errors and limits do not create plans. Existing worker identity/request/snapshot guards still determine which result can be accepted. The original result is not re-searched or restarted from zero at intermediate positions.

`solution-next` starts one forward `solution` turn. `solution-go` validates an integer target in `0..moves.length`, selects the forward or inverse move needed to approach it, and creates a `solution` or `solution-back` pending turn. Commands require a ready scene, no active turn/search, a nonfailed plan, and a matching expected snapshot. Every turn receives a new monotonic ID.

Only a matching `complete` callback applies an exact domain move. Puzzle, history, prefix length, and expected snapshot update atomically:

- forward turns append their solution move to chronological history and increment the cursor;
- backward turns apply the inverse, remove the corresponding last history entry, and decrement the cursor;
- if a requested target remains, the next turn is scheduled in the same reducer transition, without an unlocked gap;
- reaching the target clears it and waits for another user action;
- reaching the last solution position requires exact `isSolved` before announcing success, including all 24 proper global frames.

The input history is never trimmed by solution navigation. Navigating a state originally supplied without history works identically: its history consists only of the current solution prefix. Inverse navigation is a traversal of a verified plan, **not** a history-reversal solving algorithm. Duplicate/obsolete callbacks cannot commit again or advance an extra step. Repeated navigation clicks while moving are rejected, not queued or used to retarget.

## Non-committing replay

`solution-replay` requires a valid plan and at least one completed step. It creates a pending `replay` turn carrying `previewState`, computed with the exact inverse of the last completed solution move. `session.puzzle`, history, and playback remain unchanged.

`src/App.tsx` passes this temporary state to the existing renderer only while replay is active. The normal animation applies the original move visually and ends at the already committed pose. Matching completion only clears the preview turn; it never appends a move or advances progress. The expected snapshot is checked on start and completion. The worker always receives the committed puzzle, never a preview; search is blocked throughout replay.

A completed solution can be replayed without becoming unsolved in the domain state. Language changes preserve the same preview, turn ID, and progress. Context failure or a late completion cannot promote the preview to committed state.

## History, interruptions, and reset

All conflicting controls, including reset and timeline buttons, remain locked during an operation. Language switching remains available. Manual turns, ordinary undo, scrambling, or new search between operations discard the plan. Ordinary undo still reverses the latest recorded move but does not preserve the solution cursor; use solution navigation to retain the plan.

Scene failure discards the plan, unfinished turn/preview, and queued target. It retains exactly the committed puzzle/history prefix, including any completed backward transitions. No incomplete movement is applied. Reload clears the session; reset is a separate confirmed action that preserves language and healthy idle worker resources.

The UI supplies a freshly created solved snapshot for reset using the existing cube definitions. The reducer clears history/search/playback but keeps `nextTurnId` and `nextSearchId`. A delayed pre-reset animation completion or worker response therefore cannot be mistaken for a new operation.

There is no mid-turn pause/cancel, adjustable speed, persisted progress, or general history redo/jump. A selected solution target is a bounded automatic sequence; no sequence starts merely because a search finished.

## Files and boundaries

- `src/interaction/turnSession.ts`: pure transactions, snapshot guards, navigation scheduling, replay isolation, and reset.
- `src/components/SolutionPanel.tsx`: localized controls, instructions, position markers, and list-local scrolling; no move computation.
- `src/App.tsx`: actions, display-only preview selection, localized native reset confirmation, and canvas visibility.
- `src/i18n/messages.ts` and `src/styles.css`: bilingual copy and accessible presentation.

Puzzle rules, solver/worker implementation, and Three.js animation code are unchanged. No dependencies or separate animation engine were added.

## Verification

Automated tests cover all 18 move/replay types, all position pairs in a mixed solution, exact forward/backward intermediate poses and history, history-free input, duplicate callbacks, operation locks, invalid targets, snapshot mismatches, wrong-final-state rejection, and failure during forward/backward navigation and replay. Real depth-eleven solver results through all 24 global frames are tested with individual steps and full backward/forward navigation. Replay checks preserve the committed puzzle/history/progress references and verify that its visual endpoint equals the committed state.

UI tests cover clickable rows, automatic intermediate progression, inverse instructions, start navigation, replay including after final completion, language changes during operations, reset confirmation/cancellation, stable scene/geometry, and stale callback/request rejection after reset. jsdom uses controlled scene and worker stubs; it does not render WebGL.

Chrome checks in development and production preview at 1280, 390, and 320 px exercise real workers/animations and native confirmation dialogs: keyboard selection of step 3, every intermediate history commit with continuous locking, backward navigation, replay at step 2, language switching, reset cancellation/confirmation, worker reuse, and exact state comparison against independent domain replay. Canvas screenshots before/after demonstration are pixel-identical; returning to the solution start restores its original image, and reset restores the initial solved image. An eleven-step reduced-motion traversal runs forward and back; context loss during replay preserves the committed history. No horizontal overflow or uncaught exceptions was observed. These are local checks, not a committed cross-browser end-to-end suite.

Run `npm test`, `npm run typecheck`, and `npm run build`. Manually scramble, find a solution, select a later step, return to an earlier one, replay it, and compare the physical puzzle. Test both reset cancellation and confirmation in each language. Deployment and photo input remain separate deferred stages requiring owner review.
