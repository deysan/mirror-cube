# History-independent IDA* search

## Scope

`src/solver/search.ts` implements synchronous solution search from plain puzzle-state data. It uses the [normalized coordinates](state-encoding.md), [transition/distance tables](solver-tables.md), and [exact solvedness contract](solver.md). It has no React, Three.js, language, history, or piece-dimension dependency.

This is the common solver core for manual turns/scrambling and future confirmed photo reconstruction. Worker integration, a “Find solution” button, localized result handling, and animated solution playback are **not implemented yet**. The current UI does not import or run the search code.

## API

```ts
import { createSolverTables } from "./solver/tables";
import { solvePuzzle } from "./solver/search";

// Explicit initialization, in a test or a future worker, not a render callback.
const tables = createSolverTables();
const result = solvePuzzle(candidate, tables, {
  maxDepth: 11,
  maxNodes: 5_000_000,
  maxTimeMs: 5_000,
});
```

`candidate` is `unknown` plain structured data, subject to the validator's contract (no executable getters/proxies). No generating sequence is supplied. The function validates and keeps an independent canonical full-pose snapshot, then encodes it through the existing public codec. Validation stays at the request boundary, not in the traversal loop. Input data and tables are not mutated; extra fields, including history, are ignored.

The caller supplies an intact table set and should reuse it across requests. Search does not create tables, validate arbitrary table buffers, load assets, or retain a global cache. As with lookup helpers, callers must not modify the mutable typed-array contents.

### Results

| `status` | Payload and meaning |
| --- | --- |
| `solution` | `moves: readonly Move[]`, in the input frame, and `visitedNodes`. An empty sequence means the validated input is already solved up to a whole-cube rotation. |
| `invalid` | The validator's `error` diagnostic, including `cornerIndex` when applicable. No search is started. |
| `cancelled` | `visitedNodes`; cancellation was observed. No partial path is returned. |
| `limit` | `reason: "depth" \| "nodes" \| "time"` and `visitedNodes`. The search did not complete within the specified budget. No partial path is returned. |

Limits and cancellation are **not evidence that a state is unsolvable**. Invalid configuration throws `RangeError`, rather than pretending the puzzle is invalid. Errors thrown by caller callbacks propagate. A failed internal exact-state verification throws `Error`; an unverified solution is never returned.

Options are checked first, followed by puzzle validation and pre-cancellation. An invalid puzzle returns its diagnostic without consulting cancellation. A pre-cancelled valid puzzle returns `cancelled`, even if solved. Otherwise an already-solved input succeeds with zero visited nodes, including when all search budgets are zero; no traversal clock is needed.

### Budgets and cancellation

| Option | Default | Contract |
| --- | --- | --- |
| `maxDepth` | `11` | Integer in 0..11; maximum face-turn solution length to search. |
| `maxNodes` | `5_000_000` | Nonnegative safe integer; exact cap on visited node entries. |
| `maxTimeMs` | `5_000` | Nonnegative finite milliseconds; cooperative traversal budget. |
| `shouldCancel` | absent | Synchronous boolean callback, polled before traversal and before every node entry. |
| `now` | `performance.now` | Finite, nondecreasing millisecond clock; injectable for deterministic tests. |

The normalized graph's diameter is **11 face turns**, confirmed by the complete coordinate-graph BFS in the search tests. The depth option can reduce this bound, not extend it beyond this puzzle's search space.

`visitedNodes` includes roots repeated across IDA* iterations, heuristic-cutoff nodes, and a reached goal. It excludes entries blocked by cancellation or budget checks. Success on the final permitted node is allowed. The clock is checked before traversal, every 256 visited nodes, and at a reached goal. It excludes validation/encoding, table construction, and the final exact replay. This is not a hard wall-clock deadline: polling granularity, callback cost, scheduling, and garbage collection can cause overshoot. Nonfinite or backward clock readings throw `RangeError` when sampled.

When multiple controls apply at the same check, cancellation takes precedence, then the node cap, then time. An initial depth lower bound above `maxDepth` can stop without visiting nodes. Each call starts a fresh search; interrupted work is not resumed.

**A synchronous callback is not yet browser cancellation.** Normal timers, `AbortSignal` events, and queued worker messages cannot run while this synchronous DFS occupies their event loop. Worker integration must implement a real interruption strategy, such as worker termination or yielding search, and guard stale results by request/snapshot identity. Do not wire a queued “cancel” message to a flag and assume it can interrupt this call. No worker, shared-memory configuration, or asynchronous scheduler is added here.

## Search and correctness

1. Normalize around piece `---`, saving its frame; normalization is not an animated move.
2. Start the IDA* threshold at `max(permutationDistance, twistDistance)`.
3. Depth-first search in stable `R R′ R2 U U′ U2 F F′ F2` order. A node is cut off when depth plus its admissible lower bound exceeds the threshold.
4. Skip consecutive turns of the same face: they can always combine into one supported turn or cancel. No other pruning or transposition cache is used.
5. After an unsuccessful iteration, raise the threshold to the smallest exceeded score. Stop on a found goal, cancellation, or a budget limit.
6. Map the path through the saved frame, without changing outside-view turn signs. The returned values are ordinary world-frame `Move` records.
7. Apply those moves with `applyMove` to the private **original full-pose snapshot** and require `isSolved`. Verification does not reconstruct its expected input with the compact decoder.

All supported turns, including 180°, cost one. With intact factory tables, successful search returns a shortest sequence in this face-turn metric modulo whole-cube rotation. This is not minimum quarter-turn count, minimum animation time, or necessarily a return to the initial global orientation. The admissible max heuristic and minimum-exceeded threshold preserve IDA* optimality; same-face pruning cannot remove a shortest path.

Traversal reads integer transitions directly without allocating full states or coordinate records at every node. Working storage is a short recursion stack and path, in addition to the existing approximately 107 KiB table buffers and boundary snapshots. There is no runtime full-state distance database or visited-state graph.

## Verification

`src/solver/search.test.ts` checks:

- empty solutions in all 24 solved frames, and one-move solutions for all 18 face/angle choices;
- mixed and depth-eleven inputs through every global frame, including moves mapped to negative world faces;
- shortest solutions on an independent full-pose R/U/F BFS through depth four: **2,232 states**, using domain moves rather than table transitions;
- shortest solutions on an independent all-six-face, 24-goal full-pose BFS through depth two: **1,536 states**;
- a complete **3,674,160-state coordinate-graph BFS**, without IDA* or its heuristic, confirming connectivity and diameter 11; IDA* lengths are compared with this oracle for 110 seeded/deep cases, with exact domain replay for each result;
- rejected malformed and unreachable inputs, history-free/deserialized/reordered inputs, close-dimension identities, frozen-input/table non-mutation, and private snapshot ownership;
- pre-cancellation, cancellation during traversal and retry, exact node-cap boundaries, depth limits before and after traversal, deterministic timeout checks, and invalid budgets/clocks;
- rejection of a deliberately corrupted-table result by the final exact-state verification.

The complete BFS uses a byte distance array and a `Uint32Array` queue only in tests, about 17.5 MiB of temporary buffers. It shares transition tables with search, so it is an independent **search algorithm oracle**, not an exhaustive independent proof of every full-pose transition. Domain move/encoding/table tests and the separate full-pose BFS checks provide that complementary coverage. IDA* itself is not run against every possible state.

The complete graph's distance histogram, at depths 0 through 11, is:

```text
1, 9, 54, 321, 1847, 9992, 50136, 227536, 870072, 1887748, 623800, 2644
```

A local Node.js v24.19.0 run, using a non-minified Vite library bundle and already-built tables, solved and checked 101 cases: the depth-eleven fixture `{ permutation: 7, twist: 22 }` plus 100 deterministic samples (LCG seed 42, multiplier 1664525, increment 1013904223, unsigned 32-bit output modulo 3,674,160). Total search-call time was approximately **53 ms**; the slowest call took **14.2 ms**, visiting **704,205 nodes**. Every length matched the complete BFS oracle, and every result passed exact domain replay. These are development-machine observations, not browser/mobile guarantees, exhaustive worst-case measurements, or test thresholds. Table initialization is a separate cost; see the table guide.

Run `npm test`, `npm run typecheck`, and `npm run build`. No UI/rendering changes require browser review in this stage. The next proposed stage is safe worker/UI integration before animated playback; both require separate owner approval.
