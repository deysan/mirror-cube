# Solver design

The solver accepts a validated state without move history. It has no React, Three.js, camera, localization, or piece-dimension dependency. Manual turns and confirmed builder input use the same path; future photo input must pass the same validation boundary. See [architecture](architecture.md) for exact pose conventions.

## Exact solvedness

`isSolved(state)` requires all eight distinct identities, a common proper signed-axis orientation `R`, and every slot equal to `R × homeSlot(pieceId)`. This accepts the 24 proper whole-cube rotations, but rejects reflections, individual twists, and inconsistent poses.

Identity matters: similar dimensions, a flush bounding box, or an approximately cubic silhouette cannot substitute for exact poses. The predicate is not an unknown-input validator; `false` does not distinguish an unsolved legal state from an invalid state.

## Coordinates and frame mapping

`encodeState` validates first and normalizes by the inverse orientation of reference piece `---`, placing that corner at home with identity orientation. This is a coordinate change, not a physical move. The saved proper rotation `frame` restores the original holding orientation.

| Coordinate | Range | Encoding |
| --- | --- | --- |
| `permutation` | 0..5039 | Lexicographic Lehmer rank of seven non-reference identities in canonical slot order |
| `twist` | 0..728 | Six base-three digits, most significant first, for slots `--+` through `++-`; final twist follows from the sum constraint |

`{permutation: 0, twist: 0}` is solved. There are **7! × 3⁶ = 3,674,160** normalized states. All 24 global frames share coordinates. `decodeState(coordinates, frame?)` returns an independent full state and rejects out-of-range coordinates or improper frames. The encoding is internal, not a versioned import/export format.

Search uses `R R′ R2 U U′ U2 F F′ F2`, which leave the reference corner fixed. `mapMoveFromFrame` rotates face normals through the saved frame while preserving outside-view turn direction, including when the destination is a negative-side face.

## Tables and heuristic

`createSolverTables()` explicitly builds independently owned tables through exact domain moves and coordinate encoding. Importing the module does not initialize them.

| Buffer | Type | Entries |
| --- | --- | --- |
| Permutation transitions | `Uint16Array` | 5040 × 9 |
| Twist transitions | `Uint16Array` | 729 × 9 |
| Permutation distances | `Uint8Array` | 5040 |
| Twist distances | `Uint8Array` | 729 |

Transition indexing is `rank * 9 + moveIndex`. The factors evolve independently; tests compare nonzero cross-factor combinations with full poses. BFS supplies exact projected distances, with maximum depths 7 and 6 respectively. The buffers total **109,611 bytes**, excluding temporary allocations and object overhead. Callers must treat typed-array contents as read-only.

The admissible, consistent heuristic is `max(permutationDistance, twistDistance)`, **not their sum**: one move may improve both. `applyTableMove` and `estimateRemainingMoves` expect intact factory tables and reject invalid coordinate/move indices.

## IDA* search

`solvePuzzle(candidate, tables, options?)` keeps a private canonical input snapshot. It runs iterative-deepening A* with increasing minimum-exceeded bounds and prunes consecutive turns of the same face. There is no runtime full-state graph or transposition cache.

All supported turns, including 180°, cost one move. A successful search returns a shortest sequence in this face-turn metric, modulo whole-cube rotation—not necessarily the fewest quarter-turns, shortest animation, or initial global orientation.

Before returning a result, it maps moves to the input frame, replays them with exact `applyMove` against the **original full-pose snapshot**, and requires `isSolved`. It never publishes a partial or unverified path or falls back to reversing history.

| Result | Meaning |
| --- | --- |
| `solution` | World-frame moves and visited-node count; an empty sequence means already solved |
| `invalid` | Validation diagnostic; no search |
| `cancelled` | Cancellation observed; no partial path |
| `limit` | Depth, node, or time budget exhausted; **not proof of unsolvability** |

Defaults are depth **11**, **5,000,000** node entries, and **5,000 ms** traversal time. Depth accepts integers 0..11; nodes must be nonnegative safe integers; time must be finite/nonnegative. Invalid options throw `RangeError`. Inputs and tables are not mutated.

An optional synchronous `shouldCancel` callback is checked before traversal and each node. The injectable clock must be finite and nondecreasing; it is sampled before traversal, every 256 nodes, and at a reached goal. Cancellation takes precedence over node and time limits. Traversal timing excludes validation, table construction, and final replay; it is not a hard wall-clock deadline. Valid already-solved input needs no traversal, unless pre-cancelled.

## Worker boundary

`solver.worker.ts` delegates to `workerHandler.ts`; `SolverClient` owns browser resources and `useSolverWorker` connects requests to the session. Vite builds a separate module-worker asset. No worker or table set is created on initial page load; a healthy worker lazily builds and reuses tables after the first request.

Messages contain a request ID and structured-cloned puzzle snapshot, not history, language, React objects, or camera state. This is a private protocol between code from the same build, not a public message/import API.

The client accepts only its current worker's pending request ID. The reducer additionally requires the original snapshot and a ready idle scene. Duplicate/stale replies cannot replace newer results. Search does not move the puzzle automatically.

**Cancellation terminates the worker**, because a queued message cannot interrupt synchronous table building or search. Cancelled/failed workers are discarded; retry rebuilds tables. A **15-second watchdog** covers loading, initialization, and search; browser suspension can delay it. All timers/workers are cleaned up on completion as appropriate, cancellation, failure, or unmount. There is no main-thread search fallback.

Manual turns, undo, scrambling, and new search invalidate an old plan; solution navigation retains its snapshot-bound plan. Language changes do not restart requests. Worker-only failure leaves manual controls usable. Scene failure terminates pending work and preserves the committed puzzle/history.

## Verification

Automated checks include all 24 proper global frames, all 18 face/angle choices, invalid inputs, exact result replay, factor round-trips, transition invariants, distance certificates, budgets, non-mutation, and stale-result/resource guards.

Independent full-pose BFS checks cover 2,232 normalized states through depth four and 1,536 all-face/multi-goal states through depth two. A test-only complete coordinate BFS covers **3,674,160 states** and confirms diameter **11**; seeded/deep search lengths are compared against it. This oracle shares transition tables with search, so it does not independently prove every full-pose transition, and IDA* is not tested on every possible input. No full-state database is shipped.

UI tests mock WebGL and worker scheduling. Real-browser worker/playback checks complement them; they do not establish every browser's or device's performance. Follow the [development checklist](contributing.md).
