# Worker-backed solution search

## Scope and user behavior

“Find solution” now searches the current committed puzzle in a dedicated module Web Worker. It works after manual turns or scrambling, without reading history. The same state-based boundary will serve confirmed photo reconstruction later. Search results and controls are available in English and Ukrainian.

The solution panel shows an already-solved message, or a numbered list of moves in **execution order**, with notation, face names, and direction/angle descriptions. It also distinguishes invalid input, cancellation, depth/node/time limits, worker failure, and a request timeout. A limit never means “unsolvable.” The list is separate from newest-first move history.

Finding a solution does **not** apply any moves or append history. [Animated solution playback](solution-playback.md) is now implemented separately: the user activates one step or selects a target position; each intermediate move updates the plan only after its animation completes. Demonstration replay is display-only and never changes the committed state sent to the worker. Imported-state UI, photo recognition, and deployment remain deferred. “Ready to turn” still describes interaction readiness, not solvedness; the already-solved message appears only as a search result.

## Boundaries and data flow

- `src/solver/workerProtocol.ts` defines the private structured-clone messages: a request ID and a `PuzzleState`, followed by the same ID and a solver outcome. No language, history, renderer, callbacks, or Three.js objects cross this boundary.
- `src/solver/workerHandler.ts` creates the transition/distance tables lazily on the first request, then reuses them for that worker's lifetime. It runs the existing `solvePuzzle` defaults and translates internal exceptions to a generic worker error without exposing stack traces.
- `src/solver/solver.worker.ts` is the dedicated worker entry point. Vite emits a separate worker asset through `new Worker(new URL(..., import.meta.url), { type: "module" })`.
- `src/interaction/solverClient.ts` owns worker creation, pending callbacks, timeout, termination, and worker/request identity checks. It does not import the runtime search engine or construct tables on the main thread.
- `src/interaction/useSolverWorker.ts` connects stable request objects to that client. Unrelated React renders and language changes do not restart work. Unmount cleanup releases pending and idle workers, including under React Strict Mode.
- `src/interaction/turnSession.ts` owns the search transaction alongside existing animation transactions. Browser resources remain outside this pure reducer.
- `src/components/SolutionPanel.tsx` renders localized outcomes and a bounded, keyboard-scrollable move list. It never applies moves or starts search during rendering.

No worker is created on page load. The reducer first captures the immutable committed puzzle reference and a monotonically increasing request ID. `postMessage` then gives the worker a structured-cloned snapshot. The search core validates and keeps its own full-pose verification snapshot. Successful paths are still replayed with exact `applyMove` and checked with `isSolved` inside the worker before publication.

These are private, typed messages between code from the same application build, not a public arbitrary-message/import API. Plain puzzle-state validation remains the solver's boundary. The browser adapter does not rerun the search or fall back to reversing history if a worker fails or is unsupported.

## Transaction and stale-result safety

Search can start only when the scene is ready and no turn/scramble/search is active. During search, manual turns, angle choices, undo, scrambling, and another solve request are disabled. The reducer independently rejects conflicting actions; disabled buttons are not the correctness boundary. Language switching and cancellation remain available.

The client accepts a response only from its current worker for its pending request ID. The reducer separately requires:

1. a running request with the same ID;
2. the exact committed puzzle reference captured for that request;
3. a ready scene and no active turn.

After completion, duplicate results cannot commit again. After cancellation/retry, old IDs cannot replace a newer search. Captured callbacks from terminated workers are ignored by worker identity even if their IDs match. Search never updates puzzle poses or move history.

An accepted manual turn, undo, or scramble clears a previous result **when animation starts**, not only when it completes. Failed/no-op turn requests do not clear it. Scene failure clears search/result state and terminates pending work, preserving the committed puzzle/history. Starting a new search also discards any playback plan. Solution-step turns are a separate transaction that retains the verified sequence and advances its cursor; see the playback guide. Confirmed reset clears the session's puzzle/history/plan but preserves monotonic search IDs and a healthy idle worker. Reset is blocked during active search. Reload clears the entire session and result.

## Cancellation, budgets, and failures

The synchronous core cannot process a queued cancel message while building tables or traversing nodes. Cancellation therefore calls **`worker.terminate()`**; no cooperative flag/message is falsely presented as interrupting a blocked worker event loop. It does not wait for an acknowledgement or modify the cube.

A healthy worker is retained after successful results, validation diagnostics, or search limits. Cancelled or failed workers are discarded; retry creates a new one and rebuilds tables. Idle worker errors also discard that worker without erasing an already-delivered result. Loading, construction, posting/cloning, runtime, and message-deserialization errors have a localized recoverable error path. Ordinary manual controls remain usable after solver-only failure.

The core defaults remain 11 moves, 5,000,000 visited nodes, and a cooperative 5-second traversal budget. The client additionally starts a **15-second watchdog** for the whole request, including script loading and table initialization. Expiry terminates the worker and reports a separate timeout, not a proof about reachability. Browser timer throttling and background-tab suspension can delay that watchdog; it is not a hard real-time guarantee. All pending timers are cleared on completion, cancellation, replacement, failure, and unmount.

There are no shared-memory headers, external services, new dependencies, progress percentages, adjustable budgets, automatic retries, or main-thread search fallback. Repeated retry after a deterministic node limit may reach the same limit again.

## Verification

Automated checks cover:

- request guards, atomic locks, increasing IDs, snapshot identity, duplicate/late replies, and invalidation before animation completion;
- lazy construction and healthy-worker reuse, termination on cancellation/replacement/unmount, captured old callbacks, and deterministic watchdog cleanup;
- factory, posting, runtime, message-deserialization, and internal solver failures, including retry and idle-worker failure;
- the actual handler running history-free search with reused tables and exact replay, plus exception containment;
- UI loading/turn/undo/scramble locks, Strict Mode lifecycle, worker-unavailable fallback, cancellation/retry, scene failure, and unchanged puzzle/history;
- both languages for success, already solved, cancellation, limits, invalid-state diagnostic codes/corner indices, errors, and timeouts; language switching does not recreate a worker or repost a request.

jsdom tests use a controlled worker stub and a mocked WebGL scene; they do not claim native worker scheduling or GPU coverage. The existing mathematical search tests remain unchanged.

Chrome checks in both Vite development and production preview exercised **real workers**, including the emitted production asset, at 1280, 390, and 320 px: keyboard activation, worker reuse, language switching, exact solution replay, unchanged history, pixel-identical canvas before/after search, and no horizontal overflow in either language. Main-thread timer callbacks continued during cold table construction. A depth-eleven state produced eleven verified moves; the Ukrainian mobile list stayed bounded and scrolled with the keyboard. Cold-worker cancellation/retry, WebGL context loss during search, and simulated worker-construction failure/retry were also checked. No uncaught exceptions were observed. These are local checks, not all-browser/mobile performance guarantees or a committed end-to-end suite.

For manual review:

1. Run `npm run build` and `npm run preview`; open the printed URL.
2. Find a solution from the initial state: expect an already-solved message and unchanged empty history.
3. Perform R, U′, F2 (or scramble), then find a solution. Expect a numbered result, unchanged cube/history, and no automatic animation.
4. During a cold search, switch language or cancel; retry afterward. Manual controls must stay locked only while search is active.
5. Start a new turn after a result: the old list must disappear before the turn commits.
6. Inspect both languages at narrow widths; a long list must be bounded, focusable, and keyboard-scrollable.

Run `npm test`, `npm run typecheck`, and `npm run build`. The existing large graphics-chunk warning remains; search code is a separate worker asset. Bilingual animated playback is implemented separately using snapshot-bound progress and the existing exactly-once turn-completion contract. Photo capture/reconstruction remains the next functional input boundary to design and validate.
